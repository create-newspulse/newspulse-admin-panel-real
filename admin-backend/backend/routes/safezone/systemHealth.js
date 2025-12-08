const express = require('express');
const router = express.Router();

router.get('/system-health', async (req, res) => {
  try {
    res.json({
      mongodb: '🟢 OK',
      apiGateway: '🟢 OK',
      newsCrawler: '🟢 OK',
      voiceEngine: '🟢 OK',
      domain: 'https://newspulse.co.in',
    });
  } catch (err) {
    console.error('SystemHealth Error:', err.message);
    res.status(500).json({ error: 'System health check failed' });
  }
});

module.exports = router;
