// admin-backend/backend/routes/system/slack-alert.js

const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * POST /api/system/slack-alert
 * Send bug/incident alert to Slack via webhook.
 */
router.post('/', async (req, res) => {
  const { message } = req.body;
  const SLACK_WEBHOOK_URL = process.env.SLACK_BUG_ALERT_URL;

  if (!SLACK_WEBHOOK_URL) {
    return res.status(500).json({
      success: false,
      error: 'Slack webhook URL not set in environment',
      at: new Date().toISOString(),
    });
  }
  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error: 'Message required (min 5 chars)',
      at: new Date().toISOString(),
    });
  }

  try {
    await axios.post(SLACK_WEBHOOK_URL, {
      text: `🛑 *Bug Alert from News Pulse Admin System:*\n${message}`,
    });
    res.json({ success: true, sentAt: new Date().toISOString() });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Slack webhook failed:`, err?.message || err);
    res.status(500).json({
      success: false,
      error: 'Slack alert failed',
      details: err?.message || err,
      at: new Date().toISOString(),
    });
  }
});

module.exports = router;
