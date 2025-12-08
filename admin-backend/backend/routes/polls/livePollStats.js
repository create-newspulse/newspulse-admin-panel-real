const express = require('express');
const router = express.Router();
const Poll = require('../../models/Poll'); // Update path if needed

// GET /api/polls/live-stats
router.get('/live-stats', async (req, res) => {
  try {
    const polls = await Poll.find();

    const totalVotes = polls.reduce((sum, poll) => {
      if (!Array.isArray(poll.options)) return sum;
      return sum + poll.options.reduce((acc, opt) => acc + (opt.votes || 0), 0);
    }, 0);

    const topPoll = polls
      .map(p => ({
        question: p.question,
        total: Array.isArray(p.options) ? p.options.reduce((a, b) => a + (b.votes || 0), 0) : 0
      }))
      .sort((a, b) => b.total - a.total)[0] || null;

    res.json({
      success: true,
      data: {
        totalPolls: polls.length,
        totalVotes,
        topPoll
      }
    });
  } catch (err) {
    console.error('Live poll stats error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch live poll stats' });
  }
});

module.exports = router;
