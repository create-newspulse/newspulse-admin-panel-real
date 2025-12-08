// 📁 backend/routes/ai.js

const express = require('express');
const router = express.Router();
const SystemSettings = require('../models/SystemSettings'); // <--- ENABLED

const DEFAULT_ENGINES = ['gpt', 'gemini'];

// GET /api/ai/engines
router.get('/engines', async (req, res) => {
  try {
    // Get the singleton system config (guaranteed by your model)
    const config = await SystemSettings.getOrInitialize();

    // Use engines from DB if available, otherwise fallback to default
    const engines =
      Array.isArray(config.availableEngines) && config.availableEngines.length > 0
        ? config.availableEngines
        : DEFAULT_ENGINES;

    res.json({ success: true, engines });
  } catch (err) {
    console.error('❌ [GET /api/ai/engines] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load AI engines',
      engines: DEFAULT_ENGINES,
    });
  }
});

// Add more AI endpoints below...

module.exports = router;
