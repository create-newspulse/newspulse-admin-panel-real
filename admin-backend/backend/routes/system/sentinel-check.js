// admin-backend/backend/routes/system/sentinel-check.js

const express = require('express');
const axios = require('axios');
const router = express.Router();

let SystemSettings;
try {
  SystemSettings = require('../../models/SystemSettings');
} catch (err) {
  console.warn('⚠️ SystemSettings model not found (sentinel-check will skip DB status check).');
}

/**
 * Sentinel Health Check Route
 * - Verifies backend+AI core endpoints, DB status, and internal service health.
 * - Returns a full system status object (always JSON).
 */
router.get('/', async (req, res) => {
  const status = {
    aiTraining: false,
    systemSettingsExists: false,
    thinkingFeedWorking: false,
    errors: [],
  };

  const SERVER_URL = String(process.env.SERVER_URL || '').replace(/\/+$/, '');

  // 1️⃣ Check AI Training Status Endpoint
  try {
    if (!SERVER_URL) throw new Error('SERVER_URL not configured');
    const resp = await axios.get(`${SERVER_URL}/api/system/ai-training-info`);
    if (resp.data && resp.data.success) {
      status.aiTraining = true;
    } else {
      status.errors.push('⚠️ AI training endpoint returned unexpected response.');
    }
  } catch (err) {
    status.errors.push('❌ AI training endpoint error: ' + (err.message || err));
  }

  // 2️⃣ Check SystemSettings Existence (DB)
  if (SystemSettings) {
    try {
      const found = await SystemSettings.findOne();
      if (found) {
        status.systemSettingsExists = true;
      } else {
        status.errors.push('⚠️ SystemSettings not found in DB.');
      }
    } catch (err) {
      status.errors.push('❌ SystemSettings DB check error: ' + (err.message || err));
    }
  } else {
    status.errors.push('⚠️ SystemSettings model not loaded (skipped DB check).');
  }

  // 3️⃣ Check Thinking Feed Endpoint
  try {
    if (!SERVER_URL) throw new Error('SERVER_URL not configured');
    const resp = await axios.get(`${SERVER_URL}/api/system/thinking-feed`);
    if (resp.data && resp.data.success) {
      status.thinkingFeedWorking = true;
    } else {
      status.errors.push('⚠️ Thinking feed endpoint returned bad response.');
    }
  } catch (err) {
    status.errors.push('❌ Thinking feed endpoint error: ' + (err.message || err));
  }

  // 4️⃣ Final Output (always JSON)
  res.status(status.errors.length === 0 ? 200 : 207).json({
    success: status.errors.length === 0,
    status,
    checkedAt: new Date().toISOString(),
  });
});

module.exports = router;
