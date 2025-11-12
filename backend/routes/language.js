const express = require('express');
const { checkEnglish } = require('../services/lang/languageTool');
const { checkHindi } = require('../services/lang/hindwi');
const { checkGujarati } = require('../services/lang/gujaratilexicon');

const router = express.Router();

router.post('/verify', async (req, res) => {
  const { text = '', language } = req.body || {};
  if (!['en','hi','gu'].includes(language)) return res.status(400).json({ message: 'Bad language' });
  let result = { ok: true, issues: [] };
  try {
    if (language === 'en') result = await checkEnglish(text);
    else if (language === 'hi') result = await checkHindi(text);
    else if (language === 'gu') result = await checkGujarati(text);
  } catch (e) { /* fail open */ }
  res.json({ ok: result.ok, issues: result.issues, suggestions: [] });
});

router.post('/translate', async (req, res) => {
  const { text = '', from, to } = req.body || {};
  if (!['en','hi','gu'].includes(from) || !['en','hi','gu'].includes(to)) return res.status(400).json({ message: 'Bad language' });
  // Placeholder translation
  res.json({ translated: text });
});

router.post('/readability', async (req, res) => {
  const { text = '', language } = req.body || {};
  // Naive readability: grade = (avg sentence length / 2) capped
  const sentences = text.split(/\.|!|\?/).filter(s => s.trim().length);
  const words = text.split(/\s+/).filter(Boolean);
  const avgSentenceLen = sentences.length ? (words.length / sentences.length) : words.length;
  const grade = Math.min(Math.max(Math.round(avgSentenceLen / 2), 1), 16);
  const readingTimeSec = Math.round(words.length / 3); // ~200wpm ≈ 3 w/s
  res.json({ grade, readingTimeSec });
});

module.exports = router;
