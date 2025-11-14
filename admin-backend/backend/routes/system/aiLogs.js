const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// ✅ Safe File Paths (pointing only to backend/data)
const logsPath = path.resolve(__dirname, '../data/ai-heal-log.json');
const trainingInfoPath = path.resolve(__dirname, '../data/ai-training-info.json');

// 🛡️ Ensure File Exists Utility
function ensureFileExists(filePath, defaultContent = '[]') {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, defaultContent, 'utf-8');
  }
}

// 🔍 View AI Logs
router.get('/view-logs', (req, res) => {
  try {
    ensureFileExists(logsPath, '[]');
    const logs = fs.readFileSync(logsPath, 'utf-8');
    let parsed = [];
    try {
      parsed = JSON.parse(logs || '[]');
      // Defensive: Accept .logs property array if present
      if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.logs)) {
        parsed = parsed.logs;
      }
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }
    res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error('❌ View Logs Error:', err.message);
    res.status(500).json({ success: false, error: '❌ Failed to read logs' });
  }
});

// ➕ Append New AI Heal Log Entry (SAFE)
router.post('/append-heal-log', (req, res) => {
  try {
    ensureFileExists(logsPath, '[]');
    let existing = [];
    try {
      const raw = fs.readFileSync(logsPath, 'utf8');
      existing = JSON.parse(raw || '[]');
      if (typeof existing === 'object' && existing !== null && Array.isArray(existing.logs)) {
        existing = existing.logs;
      }
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }
    const newLog = req.body && Object.keys(req.body).length
      ? req.body
      : { timestamp: new Date().toISOString(), status: 'unknown' };
    existing.push(newLog);
    fs.writeFileSync(logsPath, JSON.stringify(existing, null, 2), 'utf-8');
    res.status(201).json({ success: true, message: 'Log appended', data: newLog });
  } catch (err) {
    console.error('❌ Append Heal Log Error:', err.message);
    res.status(500).json({ success: false, error: '❌ Failed to append heal log' });
  }
});

// ❌ Clear AI Logs
router.delete('/clear-logs', (req, res) => {
  try {
    ensureFileExists(logsPath, '[]');
    fs.writeFileSync(logsPath, '[]', 'utf-8');
    console.log(`🧹 Cleared AI logs at ${logsPath}`);
    res.status(200).json({ success: true, message: '✅ Logs cleared successfully' });
  } catch (err) {
    console.error('❌ Clear Logs Error:', err.message);
    res.status(500).json({ success: false, error: '❌ Failed to clear logs' });
  }
});

// 📤 Export Logs as JSON File
router.get('/export-logs', (req, res) => {
  try {
    ensureFileExists(logsPath, '[]');
    const logs = fs.readFileSync(logsPath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=ai-heal-log.json');
    res.send(logs);
  } catch (err) {
    console.error('❌ Export Logs Error:', err.message);
    res.status(500).json({ success: false, error: '❌ Failed to export logs' });
  }
});

// 🧠 Load AI Training Info
router.get('/ai-training-info', (req, res) => {
  try {
    ensureFileExists(trainingInfoPath, '{}');
    const data = fs.readFileSync(trainingInfoPath, 'utf-8');
    let parsed = {};
    try {
      parsed = JSON.parse(data || '{}');
    } catch {
      parsed = {};
    }
    res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error('❌ AI Training Info Error:', err.message);
    res.status(500).json({ success: false, error: '❌ Failed to load AI training info' });
  }
});

module.exports = router;
