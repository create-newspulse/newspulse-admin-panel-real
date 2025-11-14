// 📁 backend/routes/ai-headline-suggest.js

const express = require('express');
const router = express.Router();

// 🛠️ Headline Variations Generator
const generateHeadlineVariations = (headline) => {
  const base = headline.trim();

  const variations = [
    `Breaking: ${base}`,
    `🔥 ${base} – Must Read!`,
    `Revealed: ${base}`,
    `${base} | What You Need to Know`,
    `Exclusive: ${base}`,
    `${base} – Here’s What Happened Next`,
  ];

  // Filter out short/duplicate entries
  return [...new Set(variations)].filter(h => h.length > 15);
};

// 📊 Headline Score Estimator
const scoreHeadline = (headline) => {
  const lower = headline.toLowerCase();
  let score = 50;

  if (lower.includes('breaking') || lower.includes('shocking')) score += 20;
  if (lower.includes('exclusive') || lower.includes('revealed')) score += 15;
  if (lower.length > 80) score -= 10;
  if (lower.length < 30) score -= 5;

  return Math.min(score, 100);
};

// ✅ POST /api/ai-headline-suggest
router.post('/ai-headline-suggest', (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ success: false, message: '⚠️ Headline title is required.' });
  }

  const variations = generateHeadlineVariations(title);
  const scoredSuggestions = variations.map(h => ({
    headline: h,
    score: scoreHeadline(h),
  }));

  scoredSuggestions.sort((a, b) => b.score - a.score);

  return res.json({
    success: true,
    suggestions: scoredSuggestions,
    top: scoredSuggestions[0],
  });
});

module.exports = router;
