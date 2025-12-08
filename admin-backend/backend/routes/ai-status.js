const express = require('express');
const router = express.Router();

// Simulated AI module statuses
router.get('/', async (req, res) => {
  try {
    res.json({
      summarizer: true,
      voiceReader: true,
      factChecker: false
    });
  } catch (err) {
    res.status(500).json({ error: 'AI status fetch failed.' });
  }
});

module.exports = router;
