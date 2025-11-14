// admin-backend/backend/routes/settings.js

const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

// ----- DEFAULT CONFIG -----
const DEFAULT_CONFIG = {
  aiTrainer: false,
  adsenseEnabled: false,
  voiceReader: true,
  lockdown: false,
  signatureLock: false,
  founderOnly: false,
};

// UTILITY: Validate settings config structure and types
function validateConfig(config) {
  if (!config) return false;
  for (const [key, defVal] of Object.entries(DEFAULT_CONFIG)) {
    if (typeof config[key] !== typeof defVal) return false;
  }
  return true;
}

// POST /api/settings/save
router.post('/save', async (req, res) => {
  try {
    const config = req.body;
    if (!validateConfig(config)) {
      return res.status(400).json({ success: false, error: 'Invalid config structure or types' });
    }

    const updated = await Settings.findOneAndUpdate(
      { key: 'admin-control' },
      { key: 'admin-control', config },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (!updated) throw new Error('Failed to save settings to DB');

    console.log('✅ Settings saved to DB:', updated.config);
    res.json({ success: true, config: updated.config });
  } catch (err) {
    console.error('❌ Settings save error:', err?.stack || err);
    res.status(500).json({
      success: false,
      error: 'Save failed',
      message: err.message,
    });
  }
});

// GET /api/settings/load
router.get('/load', async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'admin-control' });

    // If not found, auto-create with defaults (ensures DB always seeded)
    if (!settings) {
      settings = await Settings.create({ key: 'admin-control', config: DEFAULT_CONFIG });
      console.warn('⚠️ No settings found; created default.');
    }

    // If invalid config, auto-reset in DB (optional)
    if (!validateConfig(settings.config)) {
      await Settings.updateOne({ key: 'admin-control' }, { config: DEFAULT_CONFIG });
      console.warn('⚠️ Invalid settings in DB. Resetting to default.');
      return res.json({ success: true, config: DEFAULT_CONFIG, info: 'Invalid DB config, reset to default.' });
    }

    res.json({ success: true, config: settings.config, info: 'Loaded from DB.' });
  } catch (err) {
    console.error('❌ Settings load error:', err?.stack || err);
    res.status(500).json({
      success: false,
      error: 'Load failed',
      message: err.message,
    });
  }
});

// DEV: Optional hard reset route (for admin/dev use)
router.post('/reset', async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'admin-control' },
      { key: 'admin-control', config: DEFAULT_CONFIG },
      { upsert: true }
    );
    res.json({ success: true, config: DEFAULT_CONFIG, message: 'Settings reset to default.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
