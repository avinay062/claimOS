const express = require('express');
const { body, validationResult } = require('express-validator');
const { LocalAdaptation, LOCAL_ADAPTATION_STATUSES, MARKETING_CHANNELS } = require('../models/LocalAdaptation');
const { Claim } = require('../models/Claim');
const { Statement } = require('../models/Statement');
const { Location } = require('../models/Location');
const { Project } = require('../models/Project');
const { protect, requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const router = express.Router();
router.use(protect);

// ── GET /api/local-adaptations ──
router.get('/', requirePermission('claims:read'), asyncHandler(async (req, res) => {
  const { claimId, locationCode, status, locale, projectId, page = 1, limit = 30 } = req.query;

  const filter = {};
  if (claimId)      filter.claimId      = claimId;
  if (locationCode) filter.locationCode = locationCode.toUpperCase();
  if (status)       filter.status       = status;
  if (locale)       filter.locale       = locale;
  if (projectId)    filter.projectId    = projectId;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [adaptations, total] = await Promise.all([
    LocalAdaptation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('claimId', 'status riskRating statementId productId')
      .populate({ path: 'claimId', populate: [{ path: 'statementId', select: 'name' }, { path: 'productId', select: 'name brand' }] })
      .populate('createdBy', 'firstName lastName'),
    LocalAdaptation.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: adaptations,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
  });
}));

// ── GET /api/local-adaptations/:id ──
router.get('/:id', requirePermission('claims:read'), asyncHandler(async (req, res) => {
  const adaptation = await LocalAdaptation.findById(req.params.id)
    .populate({ path: 'claimId', populate: [{ path: 'statementId', select: 'name translations' }, { path: 'productId', select: 'name brand' }] })
    .populate('sourcedFromId', 'locationCode locale localText')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName')
    .populate('workflowHistory.performedBy', 'firstName lastName');

  if (!adaptation) return res.status(404).json({ success: false, message: 'Local adaptation not found.' });
  res.json({ success: true, data: adaptation });
}));

// ── POST /api/local-adaptations ── (create one)
router.post('/',
  requirePermission('claims:write'),
  [
    body('claimId').notEmpty().isMongoId().withMessage('Valid claim ID required'),
    body('locationCode').notEmpty().trim().isLength({ min: 2, max: 3 }).withMessage('Valid location code required (e.g. FR)'),
    body('locale').notEmpty().trim().withMessage('Locale required (e.g. fr-FR)'),
    body('localText').trim().notEmpty().withMessage('Local text is required'),
    body('permittedChannels').optional().isArray(),
    body('notes').optional().trim(),
    body('projectId').optional().isMongoId(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { claimId, locationCode, locale, localText, permittedChannels, notes, projectId, sourcedFromId } = req.body;

    // Validate claim exists
    const claim = await Claim.findById(claimId).populate('statementId', 'name');
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });

    // Resolve location name
    const location = await Location.findOne({ code: locationCode.toUpperCase() });

    const adaptation = await LocalAdaptation.create({
      claimId,
      locationCode: locationCode.toUpperCase(),
      locationName: location?.name || locationCode.toUpperCase(),
      locale,
      localText,
      permittedChannels: permittedChannels || [],
      notes,
      projectId: projectId || null,
      sourcedFromId: sourcedFromId || null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    // Add to project if specified
    if (projectId) {
      await Project.findByIdAndUpdate(projectId, { $addToSet: { localAdaptationIds: adaptation._id } });
    }

    await audit({
      userId: req.user._id, userEmail: req.user.email,
      action: 'local_adaptation.created',
      objectType: 'LocalAdaptation', objectId: adaptation._id,
      objectName: `${claim.statementId?.name} / ${locationCode}`,
      after: { locationCode, locale, localText }, req,
    });

    res.status(201).json({ success: true, data: adaptation });
  })
);

// ── POST /api/local-adaptations/bulk-create ── (create many at once from a claim × locations)
router.post('/bulk-create',
  requirePermission('claims:write'),
  [
    body('claimId').notEmpty().isMongoId(),
    body('locations').isArray({ min: 1 }).withMessage('locations array required'),
    body('locations.*.locationCode').notEmpty(),
    body('locations.*.locale').notEmpty(),
    body('locations.*.localText').notEmpty(),
    body('projectId').optional().isMongoId(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { claimId, locations, projectId } = req.body;
    const claim = await Claim.findById(claimId).populate('statementId', 'name');
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });

    const locationDocs = await Location.find({ code: { $in: locations.map(l => l.locationCode.toUpperCase()) } });
    const locationMap = Object.fromEntries(locationDocs.map(l => [l.code, l.name]));

    let created = 0, skipped = 0, failed = 0;
    const createdIds = [];

    for (const loc of locations) {
      try {
        const doc = await LocalAdaptation.create({
          claimId,
          locationCode: loc.locationCode.toUpperCase(),
          locationName: locationMap[loc.locationCode.toUpperCase()] || loc.locationCode,
          locale: loc.locale,
          localText: loc.localText,
          permittedChannels: loc.permittedChannels || [],
          projectId: projectId || null,
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });
        createdIds.push(doc._id);
        created++;
      } catch (err) {
        if (err.code === 11000) skipped++;
        else { console.error(err.message); failed++; }
      }
    }

    // Add all to project
    if (projectId && createdIds.length) {
      await Project.findByIdAndUpdate(projectId, { $addToSet: { localAdaptationIds: { $each: createdIds } } });
    }

    await audit({
      userId: req.user._id, userEmail: req.user.email,
      action: 'local_adaptation.bulk_created',
      objectType: 'Claim', objectId: claimId,
      objectName: claim.statementId?.name,
      after: { created, skipped, failed, total: locations.length }, req,
    });

    res.json({ success: true, results: { total: locations.length, created, skipped, failed } });
  })
);

// ── PUT /api/local-adaptations/:id ── (edit text, channels, notes)
router.put('/:id', requirePermission('claims:write'), asyncHandler(async (req, res) => {
  const adaptation = await LocalAdaptation.findById(req.params.id);
  if (!adaptation) return res.status(404).json({ success: false, message: 'Adaptation not found.' });
  if (adaptation.status === 'approved') return res.status(400).json({ success: false, message: 'Cannot edit an approved adaptation.' });

  const { localText, permittedChannels, notes } = req.body;
  const before = { localText: adaptation.localText, permittedChannels: adaptation.permittedChannels };

  if (localText !== undefined)        adaptation.localText        = localText;
  if (permittedChannels !== undefined) adaptation.permittedChannels = permittedChannels;
  if (notes !== undefined)            adaptation.notes            = notes;
  adaptation.updatedBy = req.user._id;

  await adaptation.save();

  await audit({
    userId: req.user._id, userEmail: req.user.email,
    action: 'local_adaptation.updated',
    objectType: 'LocalAdaptation', objectId: adaptation._id,
    before, after: { localText, permittedChannels }, req,
  });

  res.json({ success: true, data: adaptation });
}));

// ── POST /api/local-adaptations/:id/auto-translate ──
// Auto-populate local text from the parent claim's statement translation library
router.post('/:id/auto-translate', requirePermission('claims:write'), asyncHandler(async (req, res) => {
  const adaptation = await LocalAdaptation.findById(req.params.id)
    .populate({ path: 'claimId', populate: { path: 'statementId', select: 'name translations' } });

  if (!adaptation) return res.status(404).json({ success: false, message: 'Adaptation not found.' });

  const translations = adaptation.claimId?.statementId?.translations || [];
  const match = translations.find(t => t.locale === adaptation.locale) ||
                translations.find(t => t.locale.split('-')[0] === adaptation.locale.split('-')[0]);

  if (!match) {
    return res.status(404).json({
      success: false,
      message: `No translation found for locale '${adaptation.locale}' in the statement library. Add a translation to the statement first.`,
    });
  }

  const before = { localText: adaptation.localText };
  adaptation.localText = match.text;
  adaptation.updatedBy = req.user._id;
  await adaptation.save();

  await audit({
    userId: req.user._id, userEmail: req.user.email,
    action: 'local_adaptation.auto_translated',
    objectType: 'LocalAdaptation', objectId: adaptation._id,
    before, after: { localText: match.text, locale: match.locale }, req,
  });

  res.json({ success: true, data: adaptation, translationSource: match.locale });
}));

// ── POST /api/local-adaptations/:id/copy ── (copy to another location)
router.post('/:id/copy',
  requirePermission('claims:write'),
  [
    body('locationCode').notEmpty(),
    body('locale').notEmpty(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const source = await LocalAdaptation.findById(req.params.id);
    if (!source) return res.status(404).json({ success: false, message: 'Source adaptation not found.' });

    const location = await Location.findOne({ code: req.body.locationCode.toUpperCase() });
    const copy = await LocalAdaptation.create({
      claimId:          source.claimId,
      locationCode:     req.body.locationCode.toUpperCase(),
      locationName:     location?.name || req.body.locationCode,
      locale:           req.body.locale,
      localText:        source.localText,
      permittedChannels:source.permittedChannels,
      projectId:        source.projectId,
      sourcedFromId:    source._id,
      notes:            source.notes,
      createdBy:        req.user._id,
      updatedBy:        req.user._id,
    });

    res.status(201).json({ success: true, data: copy });
  })
);

// ── POST /api/local-adaptations/:id/transition ── (lifecycle)
router.post('/:id/transition',
  [
    body('status').isIn(LOCAL_ADAPTATION_STATUSES).withMessage('Invalid status'),
    body('comment').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const adaptation = await LocalAdaptation.findById(req.params.id);
    if (!adaptation) return res.status(404).json({ success: false, message: 'Adaptation not found.' });

    const { status: newStatus, comment } = req.body;
    if (newStatus === 'approved' && !req.user.hasPermission('claims:approve')) {
      return res.status(403).json({ success: false, message: 'Only approvers can approve local adaptations.' });
    }

    const oldStatus = adaptation.status;
    adaptation.workflowHistory.push({ fromStatus: oldStatus, toStatus: newStatus, performedBy: req.user._id, comment });
    adaptation.status = newStatus;
    adaptation.updatedBy = req.user._id;
    await adaptation.save();

    // Notify creator
    if (adaptation.createdBy.toString() !== req.user._id.toString()) {
      await notify({
        userId: adaptation.createdBy,
        type: 'claim_status_changed',
        title: `Local adaptation ${newStatus}`,
        message: `${adaptation.locationCode} adaptation was ${newStatus}`,
        link: `/local-adaptations/${adaptation._id}`,
        objectType: 'LocalAdaptation',
        objectId: adaptation._id,
      });
    }

    await audit({
      userId: req.user._id, userEmail: req.user.email,
      action: 'local_adaptation.status_changed',
      objectType: 'LocalAdaptation', objectId: adaptation._id,
      before: { status: oldStatus }, after: { status: newStatus }, req,
    });

    res.json({ success: true, data: adaptation });
  })
);

// ── DELETE /api/local-adaptations/:id ──
router.delete('/:id', requirePermission('claims:write'), asyncHandler(async (req, res) => {
  const adaptation = await LocalAdaptation.findById(req.params.id);
  if (!adaptation) return res.status(404).json({ success: false, message: 'Adaptation not found.' });
  if (adaptation.status === 'approved') return res.status(400).json({ success: false, message: 'Cannot delete approved adaptations.' });

  if (adaptation.projectId) {
    await Project.findByIdAndUpdate(adaptation.projectId, { $pull: { localAdaptationIds: adaptation._id } });
  }
  await adaptation.deleteOne();

  await audit({ userId: req.user._id, userEmail: req.user.email, action: 'local_adaptation.deleted', objectType: 'LocalAdaptation', objectId: adaptation._id, req });

  res.json({ success: true, message: 'Local adaptation deleted.' });
}));

module.exports = router;
