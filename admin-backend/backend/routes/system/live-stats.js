// ✅ File: backend/routes/system/live-stats.js

const express = require('express');
const router = express.Router();

/**
 * GET /api/system/live-stats
 * Returns real-time system and AI stats for dashboard/monitoring.
 */
router.get('/', async (req, res) => {
  try {
    // Simulate/fetch values (replace with DB/analytics service calls as you scale)
    const data = {
      visitorsOnline: Math.floor(Math.random() * 50) + 1,
      storiesPostedToday: Math.floor(Math.random() * 300) + 50,
      aiActiveModules: ['Summarizer', 'TrendHunter', 'SEO Booster'],
      systemHealth: '🟢 Optimal',
      serverTime: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('❌ [Live Stats Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Live stats failed',
      details: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
});

module.exports = router;
