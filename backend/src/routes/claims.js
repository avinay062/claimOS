const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../services/auditService');
const { analyseRisk } = require('../services/riskService');
const { notify } = require('../services/notificationService');
const User = require('../models/User');

router.use(protect);

const TRANSITIONS = {
  Draft: ['Legal Review'],
  'Legal Review': ['Regulatory Review', 'Rejected'],
  'Regulatory Review': ['Approved', 'Rejected'],
  Approved: ['Retired'],
  Rejected: ['Draft'],
  Retired: [],
};

router.get('/', async (req, res) => {
  try {
    const { status, product, riskLevel, projectId, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (product) query.product = product;
    if (riskLevel) query.riskLevel = riskLevel;
    if (projectId) query.projectId = projectId;
    if (search) query.title = { $regex: search, $options: 'i' };

    const [data, total] = await Promise.all([
      Claim.find(query)
        .populate('statement', 'text category')
        .populate('product', 'name sku')
        .populate('createdBy', 'name email')
        .sort('-updatedAt')
        .skip((page - 1) * limit).limit(Number(limit)),
      Claim.countDocuments(query),
    ]);
    res.json({ data, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const c = await Claim.findById(req.params.id)
      .populate('statement', 'text category status translations')
      .populate('product', 'name sku category')
      .populate('createdBy lastModifiedBy', 'name email')
      .populate('eSignatures.user', 'name email')
      .populate('statusHistory.by', 'name email')
      .populate('parentClaimId', 'title status')
      .populate('projectId', 'name status');
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET children of a claim
router.get('/:id/children', async (req, res) => {
  try {
    const children = await Claim.find({ parentClaimId: req.params.id })
      .populate('product', 'name').select('title status product riskLevel');
    res.json(children);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { title, statement, product, channel, region, expiryDate, notes, parentClaimId, projectId, reassessmentDueDate } = req.body;

    // Run risk analysis on claim title
    const risk = await analyseRisk(title);

    const c = await Claim.create({
      title, statement, product, channel, region, expiryDate, notes, parentClaimId, projectId, reassessmentDueDate,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      flaggedWords: risk.flaggedWords,
      createdBy: req.user._id,
    });

    await log({ userId: req.user._id, action: 'CREATE', entity: 'Claim', entityId: c._id, req });
    res.status(201).json(c);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update claim (including re-run risk analysis)
router.put('/:id', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const updates = { ...req.body, lastModifiedBy: req.user._id };
    if (req.body.title) {
      const risk = await analyseRisk(req.body.title);
      updates.riskLevel = risk.riskLevel;
      updates.riskScore = risk.riskScore;
      updates.flaggedWords = risk.flaggedWords;
    }
    const c = await Claim.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!c) return res.status(404).json({ message: 'Not found' });
    await log({ userId: req.user._id, action: 'UPDATE', entity: 'Claim', entityId: c._id, changes: req.body, req });
    res.json(c);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/transition', authorize('admin', 'brand_manager', 'legal_reviewer', 'regulatory_approver'), async (req, res) => {
  try {
    const { to, comment } = req.body;
    const c = await Claim.findById(req.params.id).populate('createdBy', 'email name');
    if (!c) return res.status(404).json({ message: 'Not found' });
    if (!TRANSITIONS[c.status]?.includes(to)) {
      return res.status(400).json({ message: `Cannot transition from '${c.status}' to '${to}'` });
    }

    const prevStatus = c.status;
    c.statusHistory.push({ from: prevStatus, to, by: req.user._id, comment });
    c.status = to;
    c.lastModifiedBy = req.user._id;

    if (['Approved', 'Rejected'].includes(to)) {
      c.eSignatures.push({ user: req.user._id, role: req.user.role, comment });
    }

    await c.save();
    await log({ userId: req.user._id, action: 'TRANSITION', entity: 'Claim', entityId: c._id, changes: { from: prevStatus, to, comment }, req });

    // Notify claim creator
    if (c.createdBy?._id?.toString() !== req.user._id.toString()) {
      await notify({ userId: c.createdBy._id, type: 'claim_status_change', title: `Claim "${c.title}" moved to ${to}`, link: `/claims/${c._id}` });
    }

    res.json(c);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/copy', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { productId, title } = req.body;
    const orig = await Claim.findById(req.params.id);
    if (!orig) return res.status(404).json({ message: 'Not found' });

    const risk = await analyseRisk(title || `${orig.title} (Copy)`);
    const copy = await Claim.create({
      title: title || `${orig.title} (Copy)`,
      statement: orig.statement,
      product: productId || orig.product,
      channel: orig.channel,
      region: orig.region,
      notes: orig.notes,
      copiedFromId: orig._id,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      flaggedWords: risk.flaggedWords,
      createdBy: req.user._id,
    });

    await log({ userId: req.user._id, action: 'COPY', entity: 'Claim', entityId: copy._id, changes: { from: orig._id }, req });
    res.status(201).json(copy);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST bulk-create claims
router.post('/bulk', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { claims } = req.body; // Array of { title, statementId, productId, ... }
    if (!Array.isArray(claims) || claims.length === 0) return res.status(400).json({ message: 'claims array required' });
    if (claims.length > 100) return res.status(400).json({ message: 'Max 100 claims per bulk operation' });

    const created = [];
    for (const item of claims) {
      const risk = await analyseRisk(item.title || '');
      const c = await Claim.create({
        ...item,
        riskLevel: risk.riskLevel, riskScore: risk.riskScore, flaggedWords: risk.flaggedWords,
        createdBy: req.user._id,
      });
      created.push(c._id);
    }

    await log({ userId: req.user._id, action: 'BULK_CREATE', entity: 'Claim', entityId: created[0], changes: { count: created.length }, req });
    res.status(201).json({ created: created.length, ids: created });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Claim.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
