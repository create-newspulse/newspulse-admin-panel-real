const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');

// ✅ Latest poll
router.get('/polls/latest', async (req, res) => {
  try {
    const poll = await Poll.findOne().sort({ createdAt: -1 });
    if (!poll) return res.status(404).json({ success: false, message: 'No polls found' });

    res.json({ success: true, poll });
  } catch (err) {
    console.error('❌ Poll Fetch Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch poll' });
  }
});

module.exports = router;
