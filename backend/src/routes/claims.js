const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../services/auditService');

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
    const { status, product, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (product) query.product = product;
    const [data, total] = await Promise.all([
      Claim.find(query)
        .populate('statement', 'text category')
        .populate('product', 'name')
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
      .populate('statement', 'text category status')
      .populate('product', 'name sku')
      .populate('createdBy lastModifiedBy', 'name email')
      .populate('eSignatures.user', 'name email')
      .populate('statusHistory.by', 'name email');
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const c = await Claim.create({ ...req.body, createdBy: req.user._id });
    await log({ userId: req.user._id, action: 'CREATE', entity: 'Claim', entityId: c._id, req });
    res.status(201).json(c);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/transition', authorize('admin', 'brand_manager', 'legal_reviewer', 'regulatory_approver'), async (req, res) => {
  try {
    const { to, comment } = req.body;
    const c = await Claim.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    if (!TRANSITIONS[c.status]?.includes(to)) {
      return res.status(400).json({ message: `Cannot transition from ${c.status} to ${to}` });
    }

    const prevStatus = c.status;
    c.statusHistory.push({ from: prevStatus, to, by: req.user._id, comment });
    c.status = to;
    c.lastModifiedBy = req.user._id;

    // Add e-signature for approval/rejection
    if (['Approved', 'Rejected'].includes(to)) {
      c.eSignatures.push({ user: req.user._id, role: req.user.role, comment });
    }
    await c.save();
    await log({ userId: req.user._id, action: 'TRANSITION', entity: 'Claim', entityId: c._id, changes: { from: prevStatus, to, comment }, req });
    res.json(c);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/copy', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { productId } = req.body;
    const orig = await Claim.findById(req.params.id);
    if (!orig) return res.status(404).json({ message: 'Not found' });
    const copy = await Claim.create({
      title: `${orig.title} (Copy)`,
      statement: orig.statement,
      product: productId,
      channel: orig.channel,
      region: orig.region,
      notes: orig.notes,
      createdBy: req.user._id,
    });
    res.status(201).json(copy);
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
