// 📁 admin-backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // ✅ Check if Bearer token exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '🔒 Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 🔐 Verify token using secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'newspulse-secret');
    req.user = decoded; // Attach user data to request for later use

    // Optional: Add request metadata (e.g., logging user activity)
    req.userAgent = req.headers['user-agent'];
    req.ipAddress = req.ip;

    next(); // ✅ Proceed to protected route
  } catch (err) {
    console.error('❌ JWT Verification Error:', err.message);
    res.status(401).json({
      success: false,
      message: '⛔ Invalid or expired token.',
    });
  }
};

module.exports = authMiddleware;
