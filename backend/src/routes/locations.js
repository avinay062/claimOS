const express = require('express');
const { body, validationResult } = require('express-validator');
const { Location } = require('../models/Location');
const { protect, restrictTo } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect);

// ── GET /api/locations ──
router.get('/', asyncHandler(async (req, res) => {
  const { region, active = 'true' } = req.query;
  const filter = {};
  if (active === 'true') filter.isActive = true;
  if (region) filter.region = new RegExp(region, 'i');

  const locations = await Location.find(filter).sort({ name: 1 });
  res.json({ success: true, data: locations });
}));

// ── GET /api/locations/:code ──
router.get('/:code', asyncHandler(async (req, res) => {
  const loc = await Location.findOne({ code: req.params.code.toUpperCase() });
  if (!loc) return res.status(404).json({ success: false, message: 'Location not found.' });
  res.json({ success: true, data: loc });
}));

// ── POST /api/locations ── (admin only)
router.post('/', restrictTo('admin'),
  [
    body('code').trim().notEmpty().isLength({ min: 2, max: 3 }),
    body('name').trim().notEmpty(),
    body('region').optional().trim(),
    body('languages').isArray({ min: 1 }).withMessage('At least one language required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const loc = await Location.create({ ...req.body, code: req.body.code.toUpperCase() });
    res.status(201).json({ success: true, data: loc });
  })
);

// ── PUT /api/locations/:code ── (admin only)
router.put('/:code', restrictTo('admin'), asyncHandler(async (req, res) => {
  const loc = await Location.findOneAndUpdate(
    { code: req.params.code.toUpperCase() },
    { ...req.body },
    { new: true, runValidators: true }
  );
  if (!loc) return res.status(404).json({ success: false, message: 'Location not found.' });
  res.json({ success: true, data: loc });
}));

// ── POST /api/locations/seed ── (admin: seed defaults)
router.post('/seed', restrictTo('admin'), asyncHandler(async (req, res) => {
  await Location.seedDefaults();
  const count = await Location.countDocuments();
  res.json({ success: true, message: `Location seed complete. Total: ${count}` });
}));

module.exports = router;
