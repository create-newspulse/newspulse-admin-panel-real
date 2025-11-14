// 📁 admin-backend/backend/routes/system/ai-training-info.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const filePath = path.resolve(__dirname, '../../data/ai-training-info.json');

const safeDefault = {
  lastTrained: null,
  history: [],
  activeModel: "none"
};

// ---- GET: /api/system/ai-training-info ----
router.get('/', async (req, res) => {
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    let raw;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      raw = '';
    }

    if (!raw.trim()) {
      await fs.writeFile(filePath, JSON.stringify(safeDefault, null, 2), 'utf-8');
      return res.status(200).json({ success: true, data: safeDefault, reset: true });
    }

    let data;
    try {
      data = JSON.parse(raw);
      data = { ...safeDefault, ...data }; // Merge missing fields
    } catch (err) {
      console.warn('⚠️ Invalid JSON, resetting file:', err.message);
      await fs.writeFile(filePath, JSON.stringify(safeDefault, null, 2), 'utf-8');
      return res.status(200).json({
        success: true,
        data: safeDefault,
        reset: true,
        error: 'File was corrupt and auto-reset.'
      });
    }

    return res.status(200).json({ success: true, data });

  } catch (err) {
    console.error('❌ Failed to load AI training info:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load AI training info.',
      error: err.message || String(err),
    });
  }
});

// ---- PUT: /api/system/ai-training-info ----
router.put('/', express.json(), async (req, res) => {
  try {
    const update = (req.headers['content-type']?.includes('application/json') && typeof req.body === 'object')
      ? req.body
      : safeDefault;

    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const toWrite = { ...safeDefault, ...update };
    await fs.writeFile(filePath, JSON.stringify(toWrite, null, 2), 'utf-8');

    // Optional: Fix permissions (especially on Linux)
    try { await fs.chmod(filePath, 0o644); } catch {}

    return res.status(200).json({
      success: true,
      message: 'AI training info updated',
      data: toWrite,
    });

  } catch (err) {
    console.error('❌ Failed to update AI training info:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update AI training info.',
      error: err.message || String(err),
    });
  }
});

module.exports = router;
