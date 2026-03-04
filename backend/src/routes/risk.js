const express = require('express');
const router = express.Router();
const { RiskConfig, DEFAULT_RISK_WORDS } = require('../models/RiskConfig');
const { analyseRisk } = require('../services/riskService');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// GET all risk words (admin only)
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const words = await RiskConfig.find().sort('riskLevel word');
    res.json(words);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST analyse text for risk
router.post('/analyse', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'text is required' });
    const result = await analyseRisk(text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create risk word
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const word = await RiskConfig.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(word);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST seed defaults
router.post('/seed-defaults', authorize('admin'), async (req, res) => {
  try {
    const ops = DEFAULT_RISK_WORDS.map(w => ({
      updateOne: {
        filter: { word: w.word },
        update: { $setOnInsert: { ...w, createdBy: req.user._id } },
        upsert: true,
      },
    }));
    const result = await RiskConfig.bulkWrite(ops);
    res.json({ inserted: result.upsertedCount, message: 'Defaults seeded' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const word = await RiskConfig.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!word) return res.status(404).json({ message: 'Not found' });
    res.json(word);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await RiskConfig.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
