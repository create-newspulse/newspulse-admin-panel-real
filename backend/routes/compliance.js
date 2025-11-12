const express = require('express');
const router = express.Router();
const { evaluatePTI } = require('../services/pti');

// POST /api/compliance/pti-check
router.post('/pti-check', async (req, res) => {
  try {
    const { title, content } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content required' });
    }
    const result = evaluatePTI({ title, content });
    res.json(result);
  } catch (err) {
    console.error('PTI compliance error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
