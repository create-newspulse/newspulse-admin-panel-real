/**
 * Middleware: Grants access only to authenticated users with role = "founder".
 */
module.exports = function verifyFounder(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '🔐 Unauthorized: No user found in request.',
      });
    }

    if (req.user.role !== 'founder') {
      return res.status(403).json({
        success: false,
        message: '⛔ Access denied: Founder role required.',
      });
    }

    // ✅ Authorized
    next();
    
  } catch (err) {
    console.error('❌ Founder Verification Error:', err.message);
    return res.status(500).json({
      success: false,
      message: '⚠️ Internal server error during role check.',
    });
  }
};
