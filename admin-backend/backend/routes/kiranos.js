// /api/kiranos routes: ask + speak (CommonJS for compatibility under "type": "commonjs")
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');

const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000 });
const ENV_MODEL = (process.env.OPENAI_MODEL || '').trim();
const FALLBACK_MODELS = ['gpt-4o-mini', 'gpt-4o'];
const MODEL_CANDIDATES = Array.from(new Set([ENV_MODEL, ...FALLBACK_MODELS].filter(Boolean)));

function langName(lang) {
  return lang === 'gu' ? 'Gujarati' : lang === 'hi' ? 'Hindi' : 'English';
}

async function googleSearch(query) {
  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];
  try {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${key}&cx=${cx}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.slice(0, 5).map((it) => ({ title: it.title, link: it.link, snippet: it.snippet }));
  } catch (e) {
    console.warn('Google CSE failed:', e.message);
    return [];
  }
}

router.post('/ask', async (req, res) => {
  try {
    const { query, userId = 'anon', lang = 'en' } = req.body || {};
    const adminMode = (req.headers['x-admin-mode'] === '1') || !!(req.body && req.body.adminMode);
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Missing query' });

    // 1) Internal data fetch (minimal demo)
    const base = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    const sources = [];
    try {
      const [traffic, revenue] = await Promise.all([
        axios.get(`${base}/api/analytics/traffic`, { timeout: 4000 }).then(r => r.data).catch(() => null),
        axios.get(`${base}/api/analytics/revenue`, { timeout: 4000 }).then(r => r.data).catch(() => null),
      ]);
      if (traffic) sources.push({ type: 'internal', key: 'traffic', data: traffic });
      if (revenue) sources.push({ type: 'internal', key: 'revenue', data: revenue });
    } catch {}

    // 2) External search if needed
    let external = [];
    if (sources.length === 0) {
      external = await googleSearch(query);
      if (external.length) sources.push({ type: 'external', key: 'google', data: external });
    }

    // 3) AI synthesis with resilient model fallback
    const system = `You are KiranOS, a newsroom AI for NewsPulse. Answer in ${langName(lang)}. Keep answers factual, concise, and PTI-compliant. If admin mode is off, do not reveal internal secrets.`;
    const context = JSON.stringify(sources).slice(0, 6000);

    let completion = null;
    let lastErr = null;
    for (const model of MODEL_CANDIDATES.length ? MODEL_CANDIDATES : ['gpt-4o-mini']) {
      try {
        completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Context: ${context}\n\nQuestion: ${query}` },
          ],
          temperature: 0.6,
          max_tokens: 350, // quicker response
        });
        break;
      } catch (e) {
        lastErr = e;
        // Try next model on unknown/invalid model or 4xx/5xx
        continue;
      }
    }
  if (!completion) throw lastErr || new Error('AI provider failed');

    const answer = completion.choices?.[0]?.message?.content || '—';

    return res.json({ answer, sources, voiceUrl: null, model: completion.model });
  } catch (err) {
    const status = err?.status || err?.statusCode || err?.response?.status;
    const msg = (err && (err.message || err.error || err.toString())) || 'Unknown error';
    const isAuth = /AI_AUTH|incorrect api key|invalid_api_key|unauthorized/i.test(msg) || status === 401;
    const isRate = status === 429 || /AI_RATE_LIMIT|rate limit|quota|429/i.test(msg);
    console.error('❌ /api/kiranos/ask error:', msg);

    if (isRate) {
      res.setHeader('X-Rate-Limited-By', 'upstream');
      // Soft-fallback UX (same as legacy route): 200 with friendly message instead of hard 429
      if ((process.env.AI_RATE_SOFT_FAIL || '1') !== '0') {
        return res.status(200).json({
          success: true,
          answer: '⏳ KiranOS is busy right now (provider limit). Please try again in a few seconds.',
          error: null,
          softFallback: true,
        });
      }
      return res.status(429).json({ error: 'AI_RATE_LIMIT', detail: msg });
    }

    if (isAuth) {
      return res.status(401).json({ error: 'AI_AUTH', detail: 'Missing/invalid AI provider key. Configure OPENAI_API_KEY or GEMINI_API_KEY.' });
    }

    res.status(500).json({ error: 'AI_PIPELINE_ERROR', detail: msg });
  }
});

router.post('/speak', async (_req, res) => {
  // Placeholder: integrate ElevenLabs/Google TTS if keys configured
  return res.status(501).json({ error: 'TTS_NOT_CONFIGURED' });
});

module.exports = router;
