const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    const [data, total] = await Promise.all([
      Product.find(query).sort('name').skip((page - 1) * limit).limit(Number(limit)),
      Product.countDocuments(query),
    ]);
    res.json({ data, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const p = await Product.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(p);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(p);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
