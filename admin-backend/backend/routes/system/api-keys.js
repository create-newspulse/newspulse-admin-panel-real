// ✅ File: backend/routes/system/api-keys.js

const express = require('express');
const router = express.Router();

// GET: /api/system/api-keys
router.get('/', async (req, res) => {
  try {
    const now = new Date().toISOString();

    const keys = [
      {
        service: 'OpenAI',
        status: process.env.OPENAI_API_KEY ? 'valid' : 'missing',
        lastChecked: now,
      },
      {
        service: 'Google Maps',
        status: process.env.GOOGLE_MAPS_API_KEY ? 'valid' : 'missing',
        lastChecked: now,
      },
      {
        service: 'NewsAPI',
        status: process.env.NEWS_API_KEY ? 'valid' : 'missing',
        lastChecked: now,
      },
    ];

    res.status(200).json({
      keys, // <-- This is what your frontend expects!
      status: 'ok',
      message: '✅ API keys status loaded.'
    });
  } catch (err) {
    console.error('❌ API Key Vault Error:', err.message);
    res.status(500).json({
      keys: [],
      status: 'error',
      message: '❌ Failed to fetch API keys.'
    });
  }
});

module.exports = router;
