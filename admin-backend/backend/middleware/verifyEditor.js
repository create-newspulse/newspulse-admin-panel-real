const jwt = require('jsonwebtoken');

/**
 * Middleware: Allows access to users with role "editor" or "founder".
 */
module.exports = function verifyEditor(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '🔐 Access Denied: No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Allow only 'editor' or 'founder'
    if (!['editor', 'founder'].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: '⛔ Editor or Founder access only.',
      });
    }

    req.user = decoded;
    next();

  } catch (err) {
    console.error('❌ Editor Verification Error:', err.message);
    return res.status(401).json({
      success: false,
      message: '🚫 Invalid or expired token.',
    });
  }
};
