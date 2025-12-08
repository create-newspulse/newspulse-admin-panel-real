// 📁 backend/routes/ai-ranker.js
const express = require('express');
const router = express.Router();

// Simple scoring logic
const scoreHeadline = (headline) => {
  const lower = headline.toLowerCase();
  let score = 50;
  if (lower.includes('breaking') || lower.includes('shocking')) score += 20;
  if (lower.includes('exclusive') || lower.includes('revealed')) score += 15;
  if (lower.length > 80) score -= 10;
  if (lower.length < 30) score -= 5;
  score = Math.min(score, 100);

  let feedback = '⚠️ Needs improvement';
  if (score >= 85) feedback = '🔥 Viral potential';
  else if (score >= 70) feedback = '👍 Strong title';
  else if (score < 50) feedback = '❄️ Weak headline';

  return { score, feedback };
};

// AI-style rewrite generator
const generateRewrites = (text) => {
  const base = text.replace(/[.?!]/g, '');
  return [
    `🔥 ${base} – Exclusive Insights Inside!`,
    `${base} Unveiled: What You Missed`,
    `Top 5 Shocking Facts About ${base.split(' ')[0]}`
  ];
};

// Endpoint
router.post('/ai-ranker', (req, res) => {
  const { headline } = req.body;

  if (!headline || typeof headline !== 'string') {
    return res.status(400).json({ success: false, message: 'Headline is required' });
  }

  const original = { headline, ...scoreHeadline(headline) };
  const alternatives = generateRewrites(headline).map(h => ({
    headline: h,
    ...scoreHeadline(h)
  }));

  return res.json({
    success: true,
    original,
    alternatives
  });
});

module.exports = router;
