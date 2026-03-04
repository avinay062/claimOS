const express = require('express');
const router = express.Router();
const { globalSearch } = require('../services/searchService');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { q, types, limit = 20 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    const result = await globalSearch({ q: q.trim(), types, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
