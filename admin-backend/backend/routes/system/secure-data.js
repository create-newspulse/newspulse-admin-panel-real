// admin-backend/backend/routes/system/secure-data.js

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

/**
 * Rate limiter: Protects against brute force or abuse.
 */
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests/minute per IP
  handler: (_req, res) =>
    res.status(429).json({ success: false, message: "Too many requests. Please slow down." }),
});

/**
 * Simple Admin Auth Middleware
 * Replace with real JWT/session logic in production!
 */
function requireAdmin(req, res, next) {
  // Example: You could check JWT in headers or req.session here
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Forbidden: Admin access only." });
  }
  next();
}

/**
 * GET /api/system/secure-data
 * Protected data route (Admin only, rate-limited)
 */
router.get('/secure-data', limiter, requireAdmin, async (req, res) => {
  try {
    // 🔒 Example: Replace with your secure business logic/data fetching
    res.status(200).json({
      success: true,
      data: {
        foo: 'bar',
        time: new Date().toISOString(),
        message: 'This is secure admin data!',
      }
    });
  } catch (err) {
    console.error('❌ Secure Data Fetch Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
