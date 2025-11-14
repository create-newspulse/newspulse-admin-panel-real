// 📁 backend/services/kiranosAI.js

// Use the shared OpenAI client and environment-driven model with fallback
const openai = require('../../openaiClient.js');
const axios = require('axios');
// Prefer a distinct primary/fallback by default so fast-mode and fallback differ
const MODEL = (process.env.OPENAI_MODEL || 'gpt-4o').trim();
const FALLBACK_MODEL = (process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini').trim();

// Exponential backoff with jitter for transient upstream errors (incl. 429)
async function retryWithBackoff(fn, {
  retries = Number(process.env.AI_MAX_RETRIES || 4),
  baseMs = Number(process.env.AI_RETRY_BASE_MS || 500),
  maxMs = Number(process.env.AI_RETRY_MAX_MS || 6000),
  factor = 2,
  jitter = true,
} = {}) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err?.message || '';
      const status = err?.status || err?.statusCode || err?.response?.status;
      const isRate = status === 429 || /rate limit|quota|too many requests/i.test(msg);
      const isRetryable = isRate || status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
      if (!isRetryable || attempt === retries) break;
      const delay = Math.min(maxMs, baseMs * Math.pow(factor, attempt));
      const sleep = jitter ? Math.round(delay * (0.5 + Math.random())) : delay;
      await new Promise(r => setTimeout(r, sleep));
      attempt++;
    }
  }
  throw lastErr;
}

/**
 * 🟣 askKiranOS(prompt)
 * Sends a prompt to OpenAI and returns the response.
 * @param {string} prompt - The user input or question
 * @returns {Promise<string>} - AI-generated reply
 */
// Simple in-memory LRU cache for fast repeat questions
const CACHE_TTL_MS = Number(process.env.KIRANOS_CACHE_TTL_MS || 10 * 60 * 1000); // 10 min
const CACHE_MAX = Number(process.env.KIRANOS_CACHE_MAX || 100);
const cache = new Map(); // key -> { ts, value }
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  // refresh LRU order
  cache.delete(key); cache.set(key, hit);
  return hit.value;
}
function cacheSet(key, value) {
  cache.set(key, { ts: Date.now(), value });
  if (cache.size > CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

async function askKiranOS(prompt, opts = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }
  const { fast = false, noCache = false, noCanned = false } = opts;
  const raw = prompt.trim();
  if (!raw) throw new Error('Prompt must be a non-empty string');
  const pkey = raw.toLowerCase();

  // Clamp oversized inputs to avoid upstream timeouts/413s
  const MAX_INPUT_CHARS = Number(process.env.AI_TOOLS_MAX_INPUT_CHARS || 24000);
  const clamped = raw.length > MAX_INPUT_CHARS ? raw.slice(-MAX_INPUT_CHARS) : raw;

  // Quick canned answers for trivial greetings to avoid any provider call
  if (!noCanned && /^(hi|hello|hey|hola|namaste|yo|sup)\b/.test(pkey)) {
    return 'Hi! 👋 How can I help you in the admin panel?';
  }

  // Serve from cache if available
  if (!noCache) {
    const cached = cacheGet(pkey);
    if (cached) return cached;
  }

  const system = 'You are KiranOS, the NewsPulse AI Manager. Be concise, precise, and PTI-compliant.';
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: clamped }
  ];

  // Helper: try Gemini as a provider fallback
  const tryGemini = async () => {
    const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!key) return null; // no Gemini configured
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
      const { data } = await axios.post(
        url,
        { contents: [{ role: 'user', parts: [{ text: `${system}\n\nUser: ${prompt}` }] }] },
        { headers: { 'content-type': 'application/json' }, timeout: 30000 }
      );
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();
      if (txt) return txt;
      return 'KiranOS (Gemini) returned an empty response.';
    } catch (e) {
      console.error('🔴 Gemini fallback error:', e?.response?.data || e?.message || e);
      return null;
    }
  };

  // 1) Try OpenAI primary if key present; otherwise skip to Gemini
  const openaiKeyPresent = !!(process.env.OPENAI_API_KEY && !/REPLACE|changeme|placeholder/i.test(process.env.OPENAI_API_KEY));
  if (openaiKeyPresent) {
    try {
      const primaryModel = fast ? FALLBACK_MODEL : MODEL;
      const maxTokens = fast ? 220 : 350;
      const resp = await retryWithBackoff(() => openai.chat.completions.create({ model: primaryModel, messages, temperature: 0.6, max_tokens: maxTokens }));
      const reply = resp.choices?.[0]?.message?.content?.trim();
      const out = reply || 'KiranOS is thinking but returned an empty response.';
      if (!noCache) cacheSet(pkey, out);
      return out;
    } catch (err) {
      const msg = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
      const isAuth = /incorrect api key|invalid_api_key|unauthorized/i.test(String(msg)) || err?.status === 401;
      const isRate = err?.status === 429 || /rate limit|quota|429/i.test(String(msg));
      const isModelIssue = /model|unsupported|not\s*found|unknown_model/i.test(String(msg)) || err?.status === 404 || err?.status === 400;

      // If auth problem → no point retrying OpenAI; try Gemini else throw AI_AUTH
      if (isAuth) {
        const g = await tryGemini();
        if (g) return g;
        throw new Error('AI_AUTH: Invalid OpenAI API key');
      }

      // If rate limited or model issue → try OpenAI fallback model first
      if (isRate || isModelIssue) {
        try {
          const maxTokens2 = fast ? 220 : 350;
          const resp2 = await retryWithBackoff(() => openai.chat.completions.create({ model: FALLBACK_MODEL, messages, temperature: 0.6, max_tokens: maxTokens2 }));
          const reply2 = resp2.choices?.[0]?.message?.content?.trim();
          const out2 = reply2 || 'KiranOS (fallback) returned an empty response.';
          if (!noCache) cacheSet(pkey, out2);
          return out2;
        } catch (err2) {
          const msg2 = (err2 && err2.response && (err2.response.data?.error || err2.response.data)) || err2?.message || String(err2);
          const isRate2 = err2?.status === 429 || /rate limit|quota|429/i.test(String(msg2));
          // Then try Gemini
          const g2 = await tryGemini();
          if (g2) { if (!noCache) cacheSet(pkey, g2); return g2; }
          if (isRate2) { const e = new Error('AI_RATE_LIMIT: Rate limited or quota exceeded'); e.status = 429; throw e; }
        }
      }

      // Unexpected OpenAI error → log and continue to fallback path below
      console.error('🔴 OpenAI error (askKiranOS primary):', msg);
    }
  }

  // 2) OpenAI fallback model (still OpenAI) if key present
  if (openaiKeyPresent) {
    try {
      const maxTokens3 = fast ? 220 : 350;
      const resp2 = await retryWithBackoff(() => openai.chat.completions.create({ model: FALLBACK_MODEL, messages, temperature: 0.6, max_tokens: maxTokens3 }));
      const reply2 = resp2.choices?.[0]?.message?.content?.trim();
      const out3 = reply2 || 'KiranOS (fallback) returned an empty response.';
      if (!noCache) cacheSet(pkey, out3);
      return out3;
    } catch (err2) {
      const msg2 = (err2 && err2.response && (err2.response.data?.error || err2.response.data)) || err2?.message || String(err2);
      const isRate2 = err2?.status === 429 || /rate limit|quota|429/i.test(String(msg2));
      console.error('🔴 OpenAI error (askKiranOS fallback):', msg2);
      // Try Gemini as a last resort
      const g2 = await tryGemini();
      if (g2) { if (!noCache) cacheSet(pkey, g2); return g2; }
      if (isRate2) { const e = new Error('AI_RATE_LIMIT: Rate limited or quota exceeded'); e.status = 429; throw e; }
    }
  }

  // 3) Final attempt: Gemini-only path (when no OpenAI key configured)
  const gOnly = await tryGemini();
  if (gOnly) { if (!noCache) cacheSet(pkey, gOnly); return gOnly; }
  // If we reached here, we have no providers available
  throw new Error('KiranOS failed to respond');
}

module.exports = { askKiranOS };
