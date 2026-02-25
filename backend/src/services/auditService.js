const AuditLog = require('../models/AuditLog');

const log = async ({ userId, action, entity, entityId, changes, req }) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      entity,
      entityId,
      changes,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

module.exports = { log };
