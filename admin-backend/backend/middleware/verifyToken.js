const jwt = require('jsonwebtoken');

/**
 * Middleware: Verifies the Bearer token in Authorization header.
 * Adds `req.user` to the request if token is valid.
 */
module.exports = function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({
        success: false,
        message: '🔐 Access Denied: Token missing or malformed.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // Example: { id, role, email, iat, exp }
    next();

  } catch (err) {
    console.error('❌ Token Verification Failed:', err.message);
    return res.status(401).json({
      success: false,
      message: '🚫 Invalid or expired token.',
    });
  }
};
