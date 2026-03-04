const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ROLE_PERMISSIONS = {
  admin: ['*'],
  brand_manager: ['claims:read', 'claims:write', 'projects:read', 'projects:write'],
  legal_reviewer: ['claims:read', 'claims:approve', 'projects:read'],
  regulatory_approver: ['claims:read', 'claims:approve', 'projects:read', 'projects:write'],
  read_only: ['claims:read', 'projects:read'],
};

const hasPermission = (user, permission) => {
  if (!user?.role) return false;
  const allowed = ROLE_PERMISSIONS[user.role] || [];
  return allowed.includes('*') || allowed.includes(permission);
};

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    req.user.hasPermission = (permission) => hasPermission(req.user, permission);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: `Role '${req.user.role}' is not authorized` });
  }
  next();
};

const restrictTo = (...roles) => authorize(...roles);

const requirePermission = (permission) => (req, res, next) => {
  if (!hasPermission(req.user, permission)) {
    return res.status(403).json({ message: `Missing permission '${permission}'` });
  }
  next();
};

module.exports = { protect, authorize, restrictTo, requirePermission };
