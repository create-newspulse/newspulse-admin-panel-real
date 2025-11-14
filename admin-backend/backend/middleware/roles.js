// backend/middleware/roles.js
module.exports.requireRole = (...roles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole) return res.status(401).json({ success: false, message: 'No role' });
  if (!roles.includes(userRole)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};
