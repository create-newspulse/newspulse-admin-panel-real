// ✅ File: backend/routes/system/ai-train.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { saveCommandLog } = require('../../utils/commandLogger');

// Always resolve path relative to backend/data
const dataPath = path.resolve(__dirname, '../../data/aiTrainerData.json');

// Fallback base structure
const defaultTrainerData = {
  lastTrained: null,
  nextTraining: null,
  modulesTrained: [],
  lockedByFounder: false,
  trainingLogs: []
};

// Defensive file checks
function safeReadJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('⚠️ Trainer data corrupted or unreadable:', e);
    return fallback;
  }
}

function safeWriteJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('❌ Failed to write trainer data:', e);
    return false;
  }
}

// 🔁 POST: /api/system/ai-train
router.post('/', async (req, res) => {
  try {
    // Defensive: ensure data file exists with correct shape
    let current = safeReadJSON(dataPath, defaultTrainerData);

    // 🔒 Check founder lock
    if (current.lockedByFounder) {
      return res.status(403).json({
        success: false,
        message: '🔒 AI retraining is locked by Founder. Unlock to proceed.'
      });
    }

    // Always use *current* system date (avoids stale year)
    const now = new Date();
    const next = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day

    // Simulated trained modules
    const trainedModules = [
      'headline-optimizer',
      'ai-anchor',
      'seo-analyzer',
      'trend-detector'
    ];

    const newLog = {
      id: `log_${Date.now()}`,
      date: now.toISOString().split('T')[0],
      timestamp: now.toISOString(),
      result: 'success',
      patternsDetected: ['updated training modules', 'refreshed data']
    };

    // Build new structure, always updating dates
    const updatedData = {
      ...current,
      lastTrained: now.toISOString(),
      nextTraining: next.toISOString(),
      modulesTrained: trainedModules,
      trainingLogs: [newLog, ...(current.trainingLogs || [])]
    };

    // Save file, fail if error
    if (!safeWriteJSON(dataPath, updatedData)) {
      return res.status(500).json({
        success: false,
        message: '❌ AI training failed to save.'
      });
    }

    // Log admin action
    await saveCommandLog({
      command: 'manual retrain',
      trigger: 'manual',
      result: '✅ Full AI retraining complete',
      usedBy: req.user?.username || req.user?.email || 'admin'
    });

    return res.status(200).json({
      success: true,
      message: '✅ AI retraining completed successfully.',
      data: {
        trainedModules,
        nextTraining: updatedData.nextTraining,
        lastTrained: updatedData.lastTrained
      }
    });
  } catch (err) {
    console.error('❌ Training Error:', err);
    return res.status(500).json({
      success: false,
      message: '❌ AI training failed.',
      error: err.message || 'Unknown error'
    });
  }
});

module.exports = router;
