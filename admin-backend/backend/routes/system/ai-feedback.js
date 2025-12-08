// ✅ File: backend/routes/system/ai-feedback.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_PATH = path.resolve(__dirname, '../../data/ai-feedback.json');
const DEFAULT_DATA = { feedbackQueue: [] };

// 🛡️ Ensure file and correct shape
function ensureFeedbackFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
    return;
  }
  // Validate and auto-heal shape
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8').trim();
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || !Array.isArray(parsed.feedbackQueue)) throw new Error('Wrong shape');
  } catch (e) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
  }
}

// 📩 POST /api/system/ai-feedback
router.post('/', (req, res) => {
  const { feedback = '' } = req.body;
  const cleanText = String(feedback).trim();

  if (!cleanText || cleanText.length < 5) {
    return res.status(400).json({
      success: false,
      message: '❌ Feedback too short or empty.',
    });
  }

  try {
    ensureFeedbackFile();

    // Read and update feedback queue (prepend for recency)
    const raw = fs.readFileSync(DATA_PATH, 'utf-8') || '{}';
    let data = DEFAULT_DATA;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.feedbackQueue)) {
        data = parsed;
      }
    } catch (e) {
      // fallback to default
    }

    const now = new Date().toISOString();
    data.feedbackQueue = [
      { text: cleanText, date: now },
      ...(Array.isArray(data.feedbackQueue) ? data.feedbackQueue : [])
    ];

    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');

    return res.json({ success: true, message: '📩 Feedback added to AI trainer queue.' });
  } catch (err) {
    console.error('❌ Feedback Save Error:', err);
    return res.status(500).json({ success: false, message: '❌ Failed to save feedback.' });
  }
});

module.exports = router;
