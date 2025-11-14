// 📁 backend/routes/aiEngines.js

const express = require('express');
const router = express.Router();
const SystemSettings = require('../models/SystemSettings'); // <-- Uncommented

const DEFAULT_ENGINES = ['gpt', 'gemini'];

// GET /api/ai/engines
router.get('/', async (req, res) => {
  try {
    // Always fetch the singleton config if available
    const config = await SystemSettings.findById('system_config');
    res.json({
      success: true,
      engines: (config && Array.isArray(config.availableEngines) && config.availableEngines.length > 0)
        ? config.availableEngines
        : DEFAULT_ENGINES
    });
  } catch (err) {
    console.error('❌ AI Engines fetch error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load AI engines',
      engines: DEFAULT_ENGINES // fallback to default
    });
  }
});

module.exports = router;
