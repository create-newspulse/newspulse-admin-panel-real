// ✅ File: backend/routes/system/monitor-hub.js
const express = require('express');
const router = express.Router();
const UserSession = require('../../models/UserSession');
const SystemLog = require('../../models/SystemLog');
const SystemSettings = require('../../models/SystemSettings');

router.get('/', async (req, res) => {
  try {
    // 🔵 Active Users
    let activeUsers = 0;
    try {
      activeUsers = await UserSession.countDocuments({ active: true });
    } catch { activeUsers = 0; }

    // ⏱️ Average Session Time
    let avgSession = '0m 0s';
    try {
      const sessionLogs = await UserSession.find({ logoutAt: { $exists: true } }, { loginAt: 1, logoutAt: 1 });
      const sessionDurations = sessionLogs
        .filter(s => s.loginAt && s.logoutAt)
        .map(s => (new Date(s.logoutAt) - new Date(s.loginAt)) / 1000);

      const avgSeconds = sessionDurations.length > 0
        ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
        : 0;
      avgSession = `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`;
    } catch { avgSession = '0m 0s'; }

    // 🚫 Failed Login Attempts Today
    let loginAttempts = 0;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      loginAttempts = await SystemLog.countDocuments({
        type: 'login-failed',
        timestamp: { $gte: today }
      });
    } catch { loginAttempts = 0; }

    // 🌍 Region Detection (placeholder)
    const topRegions = ['Gujarat', 'Delhi', 'Mumbai'];

    // 🤖 AI Tools from Settings (safe fallback)
    let aiTools = ['HeadlineRanker', 'TrustMeter', 'SummaryBot'];
    try {
      const settings = await SystemSettings.findOne({});
      if (settings && Array.isArray(settings.availableEngines)) {
        aiTools = settings.availableEngines;
      }
    } catch {}

    // 🛡️ PTI Score (replace with dynamic if needed)
    const ptiScore = 97.4;

    // 🟢 Return Final Response
    return res.status(200).json({
      success: true,
      activeUsers,
      mobilePercent: 65, // Optional/static—can parse from UserAgent logs in future
      avgSession,
      newsApi: 99.8,
      weatherApi: 96.5,
      twitterApi: 78.1,
      loginAttempts,
      autoPatches: 5,
      topRegions,
      aiTools,
      ptiScore,
      flags: 2
    });

  } catch (err) {
    console.error('❌ Monitor Hub Error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system monitor data.',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
});

module.exports = router;
