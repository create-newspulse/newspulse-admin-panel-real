// backend/middleware/rbac.js
// Minimal, focused RBAC/ABAC guard that builds on verifyToken.

module.exports.requireRole = function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    try {
      const role = req.user?.role || (req.headers['x-role'] || '').toString().toLowerCase();
      if (!role) return res.status(401).json({ success: false, message: '🔐 Unauthenticated' });
      if (allowedRoles.length && !allowedRoles.map((r)=>r.toLowerCase()).includes(role)) {
        return res.status(403).json({ success: false, message: '⛔ Insufficient role' });
      }
      next();
    } catch (e) {
      return res.status(401).json({ success: false, message: '🚫 RBAC check failed' });
    }
  };
};

// Optional ABAC hint: supply a predicate that receives (req) and returns true to allow.
module.exports.requireAttr = function requireAttr(predicate) {
  return (req, res, next) => {
    try {
      if (typeof predicate === 'function' && !predicate(req)) {
        return res.status(403).json({ success: false, message: '⛔ Attribute policy denied' });
      }
      next();
    } catch (e) {
      return res.status(401).json({ success: false, message: '🚫 ABAC check failed' });
    }
  };
};
