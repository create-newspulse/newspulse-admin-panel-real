// 📁 admin-backend/backend/safezone/MonitorHub.js

const express = require('express');
const router = express.Router();
const moment = require('moment');

// ✅ Importing models (real paths)
const SessionLog = require('../models/SessionLog');
const AIUsageLog = require('../models/AIUsageLog');
const News = require('../models/News');
const LoginAttemptLog = require('../models/LoginAttemptLog');
const PatchLog = require('../models/PatchLog');
const APIHealthLog = require('../models/APIHealthLog');

// 🧠 Monitor Hub API
router.get('/monitor-hub', async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();

    // 🧑‍💻 Session data
    const sessions = await SessionLog.find({ timestamp: { $gte: today } });
    const activeUsers = new Set(sessions.map(s => s.userId)).size;
    const mobilePercent = sessions.length
      ? Math.round((sessions.filter(s => s.device === 'mobile').length / sessions.length) * 100)
      : 0;

    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgSession = sessions.length
      ? `${Math.floor(totalDuration / sessions.length / 60)}m ${Math.floor(totalDuration / sessions.length % 60)}s`
      : '0m 0s';

    // ⚙️ AI tools recently used
    const aiTools = await AIUsageLog.find().sort({ usedAt: -1 }).limit(5).distinct('tool');

    // 🚨 Flagged news count
    const flags = await News.countDocuments({ isFlagged: true });

    // 🔐 Blocked logins today
    const loginAttempts = await LoginAttemptLog.countDocuments({
      status: 'blocked',
      timestamp: { $gte: today },
    });

    // 🛠️ Auto patch count
    const autoPatches = await PatchLog.countDocuments({ applied: true });

    // 📍 Top session regions
    const regions = await SessionLog.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]);
    const topRegions = regions.map(r => r._id || 'Unknown');

    // 🔁 API Health Uptime
    const [newsApi, weatherApi, twitterApi] = await Promise.all([
      getUptime('news'),
      getUptime('weather'),
      getUptime('twitter'),
    ]);

    // 🛡️ PTI Trust Score
    const ptiScoreAgg = await News.aggregate([
      { $match: { trustScore: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$trustScore' } } },
    ]);
    const ptiScore = ptiScoreAgg?.[0]?.avg?.toFixed(1) || '100';

    // 📤 Send full response
    res.json({
      activeUsers,
      mobilePercent,
      avgSession,
      aiTools,
      flags,
      loginAttempts,
      autoPatches,
      topRegions,
      newsApi,
      weatherApi,
      twitterApi,
      ptiScore,
    });
  } catch (err) {
    console.error('❌ MonitorHub Error:', err.stack || err.message);
    res.status(500).json({ error: 'Monitor Hub Failed' });
  }
});

// 🔎 Helper: get last known API uptime
async function getUptime(name) {
  const record = await APIHealthLog.findOne({ name }).sort({ checkedAt: -1 });
  return record?.uptime || 100;
}

module.exports = router;
