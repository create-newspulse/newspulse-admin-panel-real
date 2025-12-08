// ✅ backend/routes/system/uptimeMonitor.js
const express = require('express');
const router = express.Router();

/**
 * GET /api/system/uptime
 * Returns mock (or real) API/service uptimes for dashboard/monitoring.
 */
router.get('/uptime', async (req, res) => {
  try {
    // 🟢 Example data; replace with dynamic status in production!
    const status = {
      newsAPI: { name: 'News API', uptime: 99.8 },
      weatherAPI: { name: 'Weather API', uptime: 96.5 },
      twitterAPI: null // Disabled/unused service
    };

    // Only include enabled (non-null) services
    const services = Object.fromEntries(
      Object.entries(status).filter(([_, val]) => val !== null)
    );

    return res.status(200).json({
      success: true,
      services
    });
  } catch (error) {
    console.error('❌ Uptime fetch failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Uptime fetch failed',
      error: error.message
    });
  }
});

module.exports = router;
