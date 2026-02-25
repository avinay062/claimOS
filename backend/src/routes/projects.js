const express = require('express');
const { body, validationResult } = require('express-validator');
const { Project, PROJECT_STATUSES } = require('../models/Project');
const { Claim } = require('../models/Claim');
const { LocalAdaptation } = require('../models/LocalAdaptation');
const { protect, requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { audit } = require('../services/auditService');

const router = express.Router();
router.use(protect);

// ── GET /api/projects ──
router.get('/', requirePermission('projects:read'), asyncHandler(async (req, res) => {
  const { status, managerId, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status)    filter.status    = status;
  if (managerId) filter.managerId = managerId;
  if (search)    filter.$text     = { $search: search };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('managerId', 'firstName lastName email')
      .populate('legalReviewerId', 'firstName lastName')
      .populate('regulatoryApproverId', 'firstName lastName')
      .select('-claimIds -localAdaptationIds'), // don't bloat list view
    Project.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: projects,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
  });
}));

// ── GET /api/projects/:id ── (full detail with hierarchy)
router.get('/:id', requirePermission('projects:read'), asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('managerId', 'firstName lastName email role')
    .populate('legalReviewerId', 'firstName lastName email role')
    .populate('regulatoryApproverId', 'firstName lastName email role')
    .populate('createdBy', 'firstName lastName')
    .populate({
      path: 'claimIds',
      populate: [
        { path: 'statementId', select: 'name riskLevel' },
        { path: 'productId', select: 'name brand' },
      ],
    })
    .populate({
      path: 'localAdaptationIds',
      select: 'locationCode locationName locale localText status claimId',
    });

  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
  res.json({ success: true, data: project });
}));

// ── POST /api/projects ──
router.post('/',
  requirePermission('projects:write'),
  [
    body('name').trim().notEmpty().withMessage('Project name is required'),
    body('description').optional().trim(),
    body('managerId').optional().isMongoId(),
    body('legalReviewerId').optional().isMongoId(),
    body('regulatoryApproverId').optional().isMongoId(),
    body('targetLaunchDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, description, managerId, legalReviewerId, regulatoryApproverId, targetLaunchDate } = req.body;
    const project = await Project.create({
      name, description,
      managerId:           managerId           || req.user._id,
      legalReviewerId:     legalReviewerId     || null,
      regulatoryApproverId:regulatoryApproverId|| null,
      targetLaunchDate,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await audit({
      userId: req.user._id, userEmail: req.user.email,
      action: 'project.created',
      objectType: 'Project', objectId: project._id, objectName: project.name,
      after: { name, description }, req,
    });

    res.status(201).json({ success: true, data: project });
  })
);

// ── PUT /api/projects/:id ──
router.put('/:id', requirePermission('projects:write'), asyncHandler(async (req, res) => {
  const { name, description, status, managerId, legalReviewerId, regulatoryApproverId, targetLaunchDate } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

  if (name !== undefined)                 project.name                  = name;
  if (description !== undefined)          project.description           = description;
  if (status !== undefined)               project.status                = status;
  if (managerId !== undefined)            project.managerId             = managerId;
  if (legalReviewerId !== undefined)      project.legalReviewerId       = legalReviewerId;
  if (regulatoryApproverId !== undefined) project.regulatoryApproverId  = regulatoryApproverId;
  if (targetLaunchDate !== undefined)     project.targetLaunchDate      = targetLaunchDate;
  if (status === 'completed')             project.completedAt           = new Date();

  project.updatedBy = req.user._id;
  await project.save();

  res.json({ success: true, data: project });
}));

// ── POST /api/projects/:id/claims ── (add claims to project)
router.post('/:id/claims',
  requirePermission('projects:write'),
  [body('claimIds').isArray({ min: 1 }).withMessage('claimIds array required')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { claimIds } = req.body;

    // Add claims to project (dedup)
    await Project.findByIdAndUpdate(req.params.id, {
      $addToSet: { claimIds: { $each: claimIds } },
    });

    // Back-reference: update each claim's projectId
    await Claim.updateMany(
      { _id: { $in: claimIds }, projectId: null },
      { projectId: req.params.id }
    );

    // Recalculate counts
    await recalcProjectCounts(req.params.id);

    await audit({
      userId: req.user._id, userEmail: req.user.email,
      action: 'project.claims_added',
      objectType: 'Project', objectId: project._id, objectName: project.name,
      after: { claimIds, count: claimIds.length }, req,
    });

    res.json({ success: true, message: `Added ${claimIds.length} claims to project.` });
  })
);

// ── DELETE /api/projects/:id/claims ── (remove claims from project)
router.delete('/:id/claims',
  requirePermission('projects:write'),
  [body('claimIds').isArray({ min: 1 })],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { claimIds } = req.body;
    await Project.findByIdAndUpdate(req.params.id, { $pullAll: { claimIds } });
    await Claim.updateMany({ _id: { $in: claimIds }, projectId: req.params.id }, { projectId: null });
    await recalcProjectCounts(req.params.id);

    res.json({ success: true, message: `Removed ${claimIds.length} claims from project.` });
  })
);

// ── POST /api/projects/:id/milestones ──
router.post('/:id/milestones',
  requirePermission('projects:write'),
  [body('title').trim().notEmpty()],
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    project.milestones.push({ title: req.body.title, dueDate: req.body.dueDate, notes: req.body.notes });
    await project.save();

    res.json({ success: true, data: project });
  })
);

// ── PUT /api/projects/:id/milestones/:milestoneId ── (complete a milestone)
router.put('/:id/milestones/:milestoneId', requirePermission('projects:write'), asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

  const milestone = project.milestones.id(req.params.milestoneId);
  if (!milestone) return res.status(404).json({ success: false, message: 'Milestone not found.' });

  if (req.body.title)       milestone.title       = req.body.title;
  if (req.body.dueDate)     milestone.dueDate     = req.body.dueDate;
  if (req.body.notes)       milestone.notes       = req.body.notes;
  if (req.body.completed)   milestone.completedAt = new Date();
  if (req.body.completed === false) milestone.completedAt = null;

  await project.save();
  res.json({ success: true, data: project });
}));

// ── DELETE /api/projects/:id ──
router.delete('/:id', requirePermission('projects:write'), asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

  // Detach claims
  await Claim.updateMany({ projectId: req.params.id }, { projectId: null });
  await LocalAdaptation.updateMany({ projectId: req.params.id }, { projectId: null });

  await project.deleteOne();
  await audit({ userId: req.user._id, userEmail: req.user.email, action: 'project.deleted', objectType: 'Project', objectId: project._id, objectName: project.name, req });

  res.json({ success: true, message: 'Project deleted.' });
}));

// Helper: recalculate denormalized claim counts on a project
const recalcProjectCounts = async (projectId) => {
  const project = await Project.findById(projectId).select('claimIds');
  if (!project) return;
  const claimIds = project.claimIds;
  const approvedCount = await Claim.countDocuments({ _id: { $in: claimIds }, status: { $in: ['approved', 'in_market'] } });
  await Project.findByIdAndUpdate(projectId, {
    claimsCount: claimIds.length,
    approvedClaimsCount: approvedCount,
  });
};

module.exports = router;
