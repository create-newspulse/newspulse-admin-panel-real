// ✅ File: backend/routes/system/ask-kiranos.js

const express = require('express');
const router = express.Router();
const { askKiranOS } = require('../../services/kiranosAI'); // Your AI service

/**
 * 🟣 GET /api/system/ask-kiranos?question=...
 */
router.get('/', async (req, res) => {
  const question = req.query.question;
  const fast = req.query.fast === '1' || req.query.mode === 'fast';
  const noCache = req.query.nocache === '1' || req.query.cache === '0';
  const noCanned = req.query.nocanned === '1' || req.query.precise === '1';
  if (!question || typeof question !== 'string' || question.length < 2) {
    console.warn('⚠️ [GET] /ask-kiranos → Missing/invalid question');
    return res.status(400).json({
      success: false,
      answer: null,
      error: 'Query "question" is required',
    });
  }

  try {
  const reply = await askKiranOS(question, { fast, noCache, noCanned });
    console.log(`🤖 [GET] KiranOS Q: "${question}" → ${reply}`);
    return res.status(200).json({
      success: true,
      answer: reply,
      error: null,
    });
  } catch (err) {
    const msg = err?.message || String(err);
    const isAuth = /AI_AUTH|incorrect api key|invalid_api_key|unauthorized/i.test(msg);
    const isRate = (err?.status === 429) || /AI_RATE_LIMIT|rate limit|quota|429/i.test(msg);
    console.error('❌ [GET] KiranOS Error:', msg);
    if (isRate) {
      res.setHeader('X-Rate-Limited-By', 'upstream');
      // Soft-fallback UX: optionally return 200 with a polite message instead of a 429 banner
      if ((process.env.AI_RATE_SOFT_FAIL || '1') !== '0') {
        return res.status(200).json({
          success: true,
          answer: '⏳ KiranOS is busy right now (provider limit). Please try again in a few seconds.',
          error: null,
          softFallback: true,
        });
      }
    }
    return res.status(isAuth ? 401 : isRate ? 429 : 500).json({
      success: false,
      answer: null,
      error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'KiranOS failed to respond',
      details: msg,
    });
  }
});

/**
 * 🟣 POST /api/system/ask-kiranos
 */
router.post('/', async (req, res) => {
  const { prompt, fast = false, mode, nocache = false, precise = false } = req.body;
  const useFast = fast || mode === 'fast' || (typeof prompt === 'string' && prompt.length <= 80);
  const noCache = !!nocache;
  const noCanned = !!precise;
  if (!prompt || typeof prompt !== 'string' || prompt.length < 2) {
    console.warn('⚠️ [POST] /ask-kiranos → Missing/invalid prompt');
    return res.status(400).json({
      success: false,
      answer: null,
      error: 'Field "prompt" is required in body',
    });
  }

  try {
  const reply = await askKiranOS(prompt, { fast: useFast, noCache, noCanned });
    console.log(`🤖 [POST] KiranOS Prompt: "${prompt}" → ${reply}`);
    return res.status(200).json({
      success: true,
      answer: reply,
      error: null,
    });
  } catch (err) {
    const msg = err?.message || String(err);
    const isAuth = /AI_AUTH|incorrect api key|invalid_api_key|unauthorized/i.test(msg);
    const isRate = (err?.status === 429) || /AI_RATE_LIMIT|rate limit|quota|429/i.test(msg);
    console.error('❌ [POST] KiranOS Error:', msg);
    if (isRate) {
      res.setHeader('X-Rate-Limited-By', 'upstream');
      // Soft-fallback UX: return 200 with a friendly message so UI doesn't show a big 429 banner
      if ((process.env.AI_RATE_SOFT_FAIL || '1') !== '0') {
        return res.status(200).json({
          success: true,
          answer: '⏳ KiranOS is busy right now (provider limit). Please try again in a few seconds.',
          error: null,
          softFallback: true,
        });
      }
    }
    return res.status(isAuth ? 401 : isRate ? 429 : 500).json({
      success: false,
      answer: null,
      error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'KiranOS failed to respond',
      details: msg,
    });
  }
});

module.exports = router;
