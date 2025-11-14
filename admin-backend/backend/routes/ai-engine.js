// admin-backend/backend/routes/ai-engine.js
// Express route that mirrors the frontend serverless ai-engine but runs on the backend.
const express = require('express');
const axios = require('axios');
const openai = require('../../openaiClient.js');

const router = express.Router();

function trimTo(input, max = 15000) {
  if (!input) return '';
  return input.length > max ? input.slice(0, max) : input;
}

function buildPrompt({ language = 'English', taskType = 'Rewrite', founderCommand = '', sourceText = '', url = '' }) {
  const fcmd = founderCommand?.trim()
    ? `Founder Command (ALWAYS FOLLOW, highest priority): ${founderCommand.trim()}`
    : 'Founder Command: none';

  return `You are News Pulse AI Engine. Create a brand-new, publication-ready article from the provided source. 
Do NOT copy phrases or sentences verbatim. Perform deep paraphrasing, new structure, and fresh narrative flow. 
Ensure factual consistency with the source; if facts are unclear, say so and avoid inventing specifics.

${fcmd}

Language: ${language}
Primary Task: ${taskType}
Secondary Goals: News sense and editorial clarity; 5W1H framing; smart, engaging storytelling; clean SEO title and description.

Return JSON with keys exactly: {
  "title": string,
  "summary": string,
  "fiveWh": { "who": string, "what": string, "where": string, "when": string, "why": string, "how": string },
  "outline": string[],
  "article": string,          // 500-900 words, sectioned with short subheads
  "seo": { "title": string, "description": string, "tags": string[] },
  "disclaimer": string        // brief source-transformation note
}

Source URL (optional): ${url ?? 'n/a'}
Source Text:\n\n${trimTo(sourceText)}`;
}

function jaccardUniqueness(a = '', b = '') {
  const toTri = (s) => {
    const words = (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const grams = new Set();
    for (let i = 0; i < words.length - 2; i++) grams.add(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
    return grams;
  };
  const A = toTri(a);
  const B = toTri(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  const j = union === 0 ? 0 : inter / union;
  return Math.max(0, Math.min(1, 1 - j));
}

async function callOpenAI(model, prompt) {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key || /REPLACE|changeme|placeholder/i.test(key)) throw new Error('AI_AUTH: OPENAI_API_KEY missing');
  const completion = await openai.chat.completions.create({
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You return only strict JSON. No markdown fences.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });
  return completion.choices?.[0]?.message?.content?.trim?.() || '';
}

async function callAnthropic(model, prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  const { data } = await axios.post('https://api.anthropic.com/v1/messages', {
    model: model || 'claude-3-5-sonnet-20240620',
    max_tokens: 2000,
    temperature: 0.7,
    system: 'You return only strict JSON. No markdown fences.',
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    timeout: 30000,
  });
  return data?.content?.[0]?.text || '';
}

async function callGemini(model, prompt) {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini key missing');
  const m = encodeURIComponent(model || 'gemini-1.5-pro');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
  const { data } = await axios.post(url, { contents: [{ role: 'user', parts: [{ text: prompt }] }] }, { headers: { 'content-type': 'application/json' }, timeout: 30000 });
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

router.post('/', async (req, res) => {
  try {
    const { provider = 'auto', model = '', language = 'English', taskType = 'Rewrite', founderCommand = '', sourceText = '', url = '' } = req.body || {};
    const prompt = buildPrompt({ language, taskType, founderCommand, sourceText, url });

    let chosen = provider;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    if (chosen === 'auto') {
      if (hasAnthropic) chosen = 'anthropic';
      else if (hasOpenAI) chosen = 'openai';
      else if (hasGemini) chosen = 'gemini';
      else return res.status(500).json({ error: 'No AI provider keys configured' });
    }

    let raw = '';
    try {
      if (chosen === 'openai') raw = await callOpenAI(model, prompt);
      else if (chosen === 'anthropic') raw = await callAnthropic(model, prompt);
      else if (chosen === 'gemini') raw = await callGemini(model, prompt);
      else return res.status(400).json({ error: 'Unsupported provider' });
    } catch (err) {
      const msg = err?.message || String(err);
      const isRate = /rate limit|quota|429/i.test(msg);
      const isAuth = /AI_AUTH|incorrect api key|invalid_api_key|unauthorized/i.test(msg);
      if (isAuth) return res.status(401).json({ error: 'AI_AUTH: Invalid or missing API key' });
      // On rate limit, try alternative providers automatically if available
      if (isRate && chosen !== 'anthropic' && hasAnthropic) {
        try { raw = await callAnthropic(model, prompt); chosen = 'anthropic'; }
        catch (e) { /* fall through */ }
      }
      if (!raw && isRate && chosen !== 'gemini' && hasGemini) {
        try { raw = await callGemini(model, prompt); chosen = 'gemini'; }
        catch (e) { /* fall through */ }
      }
      if (!raw) {
        return res.status(isRate ? 429 : 500).json({ error: msg });
      }
    }

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { const m = String(raw).match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
    if (!parsed || typeof parsed !== 'object') return res.status(502).json({ error: 'Model did not return JSON', provider: chosen, raw });

    const uniqueness = jaccardUniqueness(String(sourceText || ''), String(parsed.article || ''));
    return res.status(200).json({ success: true, provider: chosen, model: model || null, result: parsed, safety: { uniquenessScore: Number(uniqueness.toFixed(3)), note: 'Score ~1.0 means highly original vs source; ~0 means high overlap.' } });
  } catch (err) {
    const msg = err?.message || String(err);
    const isAuth = /AI_AUTH|incorrect api key|invalid_api_key|unauthorized/i.test(msg);
    const isRate = /rate limit|quota|429/i.test(msg);
    return res.status(isAuth ? 401 : isRate ? 429 : 500).json({ error: msg });
  }
});

module.exports = router;
