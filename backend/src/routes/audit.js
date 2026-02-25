const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin', 'regulatory_approver'));

router.get('/', async (req, res) => {
  try {
    const { entity, entityId, page = 1, limit = 50 } = req.query;
    const query = {};
    if (entity) query.entity = entity;
    if (entityId) query.entityId = entityId;
    const [data, total] = await Promise.all([
      AuditLog.find(query).populate('user', 'name email').sort('-createdAt')
        .skip((page - 1) * limit).limit(Number(limit)),
      AuditLog.countDocuments(query),
    ]);
    res.json({ data, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
