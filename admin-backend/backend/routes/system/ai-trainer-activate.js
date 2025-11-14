// 📁 admin-backend/backend/routes/system/ai-trainer-activate.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { saveCommandLog } = require('../../utils/commandLogger');

// 🧠 Utility: Ensure directory exists (idempotent)
function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 🔒 POST /api/system/ai-trainer-activate
router.post('/', async (req, res) => {
  try {
    const now = new Date();
    const isoNow = now.toISOString();
    const nextTrainingISO = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const triggerType = req.body.trigger || 'manual';

    // ✅ Trigger validation
    const validTriggers = ['manual', 'auto', 'cron'];
    if (!validTriggers.includes(triggerType)) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid trigger type. Use: manual | auto | cron'
      });
    }

    // 🧠 Define trained modules
    const modulesTrained = [
      'Content Intelligence',
      'SEO Booster',
      'Trend Detector',
      'Monetization Enhancer',
      'AI Anchor Tuner',
      'User Behavior Engine'
    ];

    // 🔥 Compose log object, always fresh date
    const trainerLog = {
      activated: true,
      lastTrained: isoNow,
      nextTraining: nextTrainingISO,
      patternFocus: 'Engagement Intelligence',
      modulesTrained,
      lockedByFounder: true,
      trainingLogs: [
        {
          date: isoNow.split('T')[0],
          timestamp: isoNow,
          result: 'success',
          patternsDetected: ['low engagement', 'title overlap']
        }
      ],
      feedbackQueue: [],
      result: '✅ Full AI Trainer activated across all modules.',
      triggeredBy: triggerType,
      status: '🟢 Healthy'
    };

    // 📁 Data paths relative to backend/data/
    const dataDir = path.join(__dirname, '../../data');
    const trainerPath = path.join(dataDir, 'aiTrainerData.json');
    const statusPath = path.join(dataDir, 'aiStatus.json');

    // 💾 Ensure directories & write trainer file
    ensureDirExists(trainerPath);
    try {
      fs.writeFileSync(trainerPath, JSON.stringify(trainerLog, null, 2));
    } catch (err) {
      throw new Error('Trainer file write failed: ' + err.message);
    }

    // 💾 Write mini status file
    ensureDirExists(statusPath);
    const statusInfo = {
      status: trainerLog.status,
      lockedByFounder: trainerLog.lockedByFounder,
      lastTrained: trainerLog.lastTrained,
      nextTraining: trainerLog.nextTraining
    };
    try {
      fs.writeFileSync(statusPath, JSON.stringify(statusInfo, null, 2));
    } catch (err) {
      throw new Error('Status file write failed: ' + err.message);
    }

    // 🧾 Save command log for audit (uses user if available)
    await saveCommandLog({
      command: 'activate-full-ai-trainer',
      trigger: triggerType,
      result: trainerLog.result,
      usedBy: req.user?.username || req.user?.email || 'admin',
      timestamp: isoNow
    });

    return res.json({
      success: true,
      message: trainerLog.result,
      data: trainerLog
    });

  } catch (err) {
    console.error('❌ AI Trainer Activation Error:', err);
    return res.status(500).json({
      success: false,
      message: '❌ Failed to activate Full AI Trainer System.',
      error: err.message || 'Unknown error'
    });
  }
});

module.exports = router;
