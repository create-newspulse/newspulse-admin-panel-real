// 🔐 Checks if the user has a specific role (like founder)
module.exports = function checkRole(allowedRoles = []) {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: '❌ Access denied: insufficient role privileges',
        });
      }

      next();
    } catch (err) {
      console.error('❌ Role Auth Error:', err.message);
      res.status(500).json({ success: false, message: '⚠️ Internal role check failed' });
    }
  };
};
