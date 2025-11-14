// 📁 backend/routes/pushPreview.js
const express = require('express');
const router = express.Router();

const categoryEmoji = {
  Politics: '🏛️',
  Business: '💼',
  Technology: '🧠',
  Sports: '🏆',
  Entertainment: '🎬',
  Breaking: '🚨',
  International: '🌍',
  Default: '🗞️',
};

router.post('/preview', (req, res) => {
  const { headline, category } = req.body;

  if (!headline) {
    return res.status(400).json({ success: false, message: 'Headline is required' });
  }

  const emoji = categoryEmoji[category] || categoryEmoji['Default'];
  const preview = `${emoji} ${headline}`;

  res.json({ success: true, preview });
});

module.exports = router;
