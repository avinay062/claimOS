const express = require('express');
const router = express.Router();
const Statement = require('../models/Statement');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../services/auditService');

router.use(protect);

const TRANSITIONS = {
  Draft: ['In Review'],
  'In Review': ['In Use', 'Draft'],
  'In Use': ['Retired'],
  Retired: [],
};

router.get('/', async (req, res) => {
  try {
    const { search, status, category, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) query.$text = { $search: search };
    const [data, total] = await Promise.all([
      Statement.find(query).populate('createdBy', 'name email').sort('-updatedAt')
        .skip((page - 1) * limit).limit(Number(limit)),
      Statement.countDocuments(query),
    ]);
    res.json({ data, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const s = await Statement.findById(req.params.id).populate('createdBy lastModifiedBy', 'name email');
    if (!s) return res.status(404).json({ message: 'Not found' });
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const s = await Statement.create({ ...req.body, createdBy: req.user._id });
    await log({ userId: req.user._id, action: 'CREATE', entity: 'Statement', entityId: s._id, req });
    res.status(201).json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const s = await Statement.findByIdAndUpdate(
      req.params.id, { ...req.body, lastModifiedBy: req.user._id }, { new: true, runValidators: true }
    );
    if (!s) return res.status(404).json({ message: 'Not found' });
    await log({ userId: req.user._id, action: 'UPDATE', entity: 'Statement', entityId: s._id, changes: req.body, req });
    res.json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/transition', authorize('admin', 'brand_manager', 'regulatory_approver'), async (req, res) => {
  try {
    const { to, comment } = req.body;
    const s = await Statement.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Not found' });
    if (!TRANSITIONS[s.status]?.includes(to)) {
      return res.status(400).json({ message: `Cannot transition from ${s.status} to ${to}` });
    }
    s.status = to;
    s.lastModifiedBy = req.user._id;
    await s.save();
    await log({ userId: req.user._id, action: 'TRANSITION', entity: 'Statement', entityId: s._id, changes: { from: s.status, to, comment }, req });
    res.json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/translations', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const s = await Statement.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Not found' });
    const { language, text } = req.body;
    const idx = s.translations.findIndex(t => t.language === language);
    if (idx >= 0) {
      s.translations[idx] = { language, text, translatedBy: req.user._id, translatedAt: new Date() };
    } else {
      s.translations.push({ language, text, translatedBy: req.user._id, translatedAt: new Date() });
    }
    await s.save();
    res.json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Statement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
