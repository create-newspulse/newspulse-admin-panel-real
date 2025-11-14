// admin-backend/backend/routes/ai-tools.js (CommonJS)
// Helper AI endpoints that wrap chat-core with locked prompts per feature.
const express = require('express');
const openai = require('../../openaiClient.js');
const router = express.Router();

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
const MAX_INPUT_CHARS = Number(process.env.AI_TOOLS_MAX_INPUT_CHARS || 24000); // clamp extremely large pastes
const CHUNK_TRIGGER_CHARS = Number(process.env.AI_TOOLS_CHUNK_TRIGGER_CHARS || 8000);
const CHUNK_SIZE_CHARS = Number(process.env.AI_TOOLS_CHUNK_SIZE_CHARS || 3500);

function sanitizeText(s) {
  if (!s) return '';
  // Normalize whitespace and remove excessive control chars
  const cleaned = String(s)
    .replace(/\u0000/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Clamp to avoid giant uploads that can cause 408 from upstream
  return cleaned.length > MAX_INPUT_CHARS ? cleaned.slice(0, MAX_INPUT_CHARS) : cleaned;
}

// Auth/config guard: give a clear error when the OpenAI key isn't configured
router.use((req, res, next) => {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key || /REPLACE|changeme|placeholder/i.test(key)) {
    return res.status(401).json({
      ok: false,
      error: 'AI_AUTH',
      detail: 'OpenAI API key not configured. Set OPENAI_API_KEY in your environment (Render → Environment) and redeploy.',
    });
  }
  next();
});

// Utility: uniform handler
async function runChat({ system, user, temperature = 0.5, max_tokens = 500 }) {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens,
    });
    const message = (completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content) || '';
    return { message, model: completion.model, usage: completion.usage || null };
  } catch (err) {
    const code = err?.status || err?.code || '';
    const msg = (err && err.response && (err.response.data?.error?.message || err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isRate = String(code) === '429' || /rate limit|quota|429/i.test(String(msg));
    if (isRate) {
      const e = new Error('AI_RATE_LIMIT: Quota exceeded or rate limited');
      e.status = 429;
      throw e;
    }
    const isTimeoutUpload = /timed out reading request body|user_request_timeout|408/i.test(String(msg)) || String(code) === '408';
    const shouldFallback = /model|unsupported|not\s*found|unknown_model/i.test(String(msg)) || code === 404 || code === 400 || isTimeoutUpload;
    if (!shouldFallback) throw err;
    // retry with fallback model
    console.warn(`[ai-tools] Falling back to ${FALLBACK_MODEL} due to:`, msg);
    const completion2 = await openai.chat.completions.create({
      model: FALLBACK_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens,
    });
    const message2 = (completion2.choices && completion2.choices[0] && completion2.choices[0].message && completion2.choices[0].message.content) || '';
    return { message: message2, model: completion2.model, usage: completion2.usage || null };
  }
}

// Utility: chunk a large text into near-CHUNK_SIZE_CHARS segments at paragraph boundaries
function chunkText(input) {
  const text = sanitizeText(input);
  if (text.length <= CHUNK_TRIGGER_CHARS) return [text];
  const paras = text.split(/\n\s*\n/);
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    const next = (cur ? cur + '\n\n' : '') + p;
    if (next.length > CHUNK_SIZE_CHARS) {
      if (cur) chunks.push(cur);
      if (p.length > CHUNK_SIZE_CHARS) {
        // hard-split very long paragraph
        for (let i = 0; i < p.length; i += CHUNK_SIZE_CHARS) {
          chunks.push(p.slice(i, i + CHUNK_SIZE_CHARS));
        }
        cur = '';
      } else {
        cur = p;
      }
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// POST /api/ai/tools/summarize
router.post('/summarize', async (req, res) => {
  try {
    const { text = '', bullets = 2 } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'TEXT_REQUIRED' });
    const cleaned = sanitizeText(text);
    const chunks = chunkText(cleaned);
    const system = `You are KiranOS, the NewsPulse editorial AI. Follow PTI rules. No unverified claims. Be concise.`;
    if (chunks.length === 1) {
      const user = `Summarize the following into exactly ${bullets} bullet points with crisp language:\n\n${chunks[0]}`;
      const { message, model, usage } = await runChat({ system, user, temperature: 0.3, max_tokens: 300 });
      return res.json({ ok: true, result: message, model, usage, chunks: 1 });
    }
    // Multi-stage summary: summarize each chunk, then synthesize final bullets
    const partials = [];
    for (const [i, ch] of chunks.entries()) {
      const user = `Part ${i + 1}/${chunks.length}. Summarize key points as 3 short bullets.\n\n${ch}`;
      const { message } = await runChat({ system, user, temperature: 0.2, max_tokens: 220 });
      partials.push(message);
    }
    const synthUser = `Combine the following partial bullet lists into exactly ${bullets} crisp, non-redundant bullets suitable for a news brief. Keep it neutral and PTI-compliant.\n\n${partials.join('\n\n')}`;
    const { message: finalMsg, model, usage } = await runChat({ system, user: synthUser, temperature: 0.2, max_tokens: 320 });
    res.json({ ok: true, result: finalMsg, model, usage, chunks: chunks.length });
  } catch (err) {
    console.error('❌ [/summarize] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

// POST /api/ai/tools/translate
router.post('/translate', async (req, res) => {
  try {
    const { text = '', targetLang = 'Gujarati' } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'TEXT_REQUIRED' });
    const cleaned = sanitizeText(text);
    const system = `You are a precise news translator for NewsPulse. Follow PTI rules. Preserve named entities. No added commentary.`;
    const user = `Translate to ${targetLang}. Keep meaning faithful and tone neutral.\n\n${cleaned}`;
    const { message, model, usage } = await runChat({ system, user, temperature: 0.2, max_tokens: 700 });
    res.json({ ok: true, result: message, model, usage });
  } catch (err) {
    console.error('❌ [/translate] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

// POST /api/ai/tools/fact-check
router.post('/fact-check', async (req, res) => {
  try {
    const { text = '' } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'TEXT_REQUIRED' });
  const cleaned = sanitizeText(text);
    const system = `You are a factuality assistant for NewsPulse. Identify claim sentences that require verification. Avoid hallucinations. Provide risk level and suggested checks. PTI compliant.`;
  const user = `Analyze the following and respond in JSON with {claims:[{sentence, risk: 'low'|'medium'|'high', confidence: number, suggestions: string[]}]}\n\n${cleaned}`;
    const { message, model, usage } = await runChat({ system, user, temperature: 0.1, max_tokens: 700 });
    let parsed;
    try { parsed = JSON.parse(message); } catch { parsed = { claims: [] }; }
    res.json({ ok: true, result: parsed, raw: message, model, usage });
  } catch (err) {
    console.error('❌ [/fact-check] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

// POST /api/ai/tools/headline
router.post('/headline', async (req, res) => {
  try {
    const { title = '', context = '' } = req.body || {};
    const system = `You are an editorial headline optimizer for NewsPulse. Favor clarity and neutrality; avoid clickbait.`;
  const cleanedTitle = sanitizeText(title);
  const cleanedContext = sanitizeText(context);
  const user = `Given the current headline and optional context, rate CTR potential 0-100 and suggest 3 alternatives. Return JSON {score:number, alternatives:string[]}.\n\nCurrent: ${cleanedTitle}\nContext: ${cleanedContext}`;
    const { message, model, usage } = await runChat({ system, user, temperature: 0.5, max_tokens: 500 });
    let parsed;
    try { parsed = JSON.parse(message); } catch { parsed = { score: 60, alternatives: [title].filter(Boolean) }; }
    res.json({ ok: true, result: parsed, raw: message, model, usage });
  } catch (err) {
    console.error('❌ [/headline] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

// POST /api/ai/tools/seo-meta
router.post('/seo-meta', async (req, res) => {
  try {
    const { text = '', title = '' } = req.body || {};
    const system = `You are an SEO assistant for NewsPulse. Generate concise, compliant meta.`;
  const cleaned = sanitizeText(text);
  const cleanedTitle = sanitizeText(title);
  const user = `From the content, produce JSON {metaTitle:string<=60 chars, metaDescription:string<=155 chars, tags:string[8..12]}.\n\nTitle: ${cleanedTitle}\n\nText: ${cleaned}`;
    const { message, model, usage } = await runChat({ system, user, temperature: 0.4, max_tokens: 400 });
    let parsed;
    try { parsed = JSON.parse(message); } catch { parsed = { metaTitle: title?.slice(0, 60) || 'NewsPulse', metaDescription: '', tags: [] }; }
    res.json({ ok: true, result: parsed, raw: message, model, usage });
  } catch (err) {
    console.error('❌ [/seo-meta] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

// POST /api/ai/tools/voice-script
router.post('/voice-script', async (req, res) => {
  try {
    const { text = '', durationSec = 25 } = req.body || {};
    const system = `You are a neutral female anchor scriptwriter for NewsPulse. PTI compliant. No unverified claims.`;
  const cleaned = sanitizeText(text);
  const user = `Write a ${durationSec}-second voice script that can be read aloud naturally. Keep 2-4 short sentences, crisp and fluent.\n\n${cleaned}`;
    const { message, model, usage } = await runChat({ system, user, temperature: 0.6, max_tokens: 300 });
    res.json({ ok: true, result: message, model, usage });
  } catch (err) {
    console.error('❌ [/voice-script] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

// POST /api/ai/tools/inverted-pyramid
// Returns structured JSON { lead, body, tail } in classic newsroom order of importance.
router.post('/inverted-pyramid', async (req, res) => {
  try {
    const { text = '', targetLang } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'TEXT_REQUIRED' });
    const cleaned = sanitizeText(text);
    const langHint = targetLang ? ` Respond in ${targetLang}.` : '';
    const system = `You are KiranOS, the NewsPulse editorial AI. Follow PTI rules. No unverified claims. Use inverted pyramid structure.`;
    const user = `Rewrite the news content in strict inverted pyramid structure and return valid JSON only. Keys: {"lead": string (~25-40 words answering who/what/where/when/why/how), "body": string[] (3-6 concise bullets with crucial facts, verified context, key quotes), "tail": string[] (2-4 related/extra items).
${langHint}

Content:
${cleaned}`;
    const { message, model, usage } = await runChat({ system, user, temperature: 0.3, max_tokens: 800 });
    let parsed;
    try { parsed = JSON.parse(message); } catch {
      const m = message && message.match && message.match(/\{[\s\S]*\}$/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e) { /* ignore */ } }
    }
    if (!parsed || typeof parsed.lead !== 'string' || !Array.isArray(parsed.body) || !Array.isArray(parsed.tail)) {
      return res.json({ ok: true, raw: message, model, usage, note: 'JSON parse failed; returning raw text' });
    }
    res.json({ ok: true, result: parsed, model, usage });
  } catch (err) {
    console.error('❌ [/inverted-pyramid] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

// POST /api/ai/tools/5w1h
// Enforce crisp, non-narrative one-liners for each of the 5W1H keys.
router.post('/5w1h', async (req, res) => {
  try {
    const { text = '', targetLang } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'TEXT_REQUIRED' });
    const cleaned = sanitizeText(text);
    const langHint = targetLang ? ` Respond in ${targetLang}.` : '';
    const system = `You are KiranOS, the NewsPulse editorial AI. Produce factual, non-narrative, newsroom-ready one-liners. Avoid flowery prose.`;
    const user = `Extract a strict 5W1H from the news content. Reply with VALID JSON only in this exact shape:
{"who": "...", "what": "...", "where": "...", "when": "...", "why": "...", "how": "...", "topband": "...", "topbands": ["...","..."]}

Rules:
- Each of who/what/where/when/why/how MUST be a single concise line (max 12-14 words), no narrative, no extra commentary.
- Keep names/entities accurate; if unknown, write "Unknown".
- topband is a tight, impactful one-liner (6-12 words) suitable for a strap/top band.
- topbands is an array of 3-5 alternative one-liners.
${langHint}

Content:
${cleaned}`;

    const { message, model, usage } = await runChat({ system, user, temperature: 0.2, max_tokens: 500 });
    let parsed;
    try { parsed = JSON.parse(message); } catch {
      const m = message && message.match && message.match(/\{[\s\S]*\}$/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e) { /* ignore */ } }
    }
    if (!parsed || typeof parsed !== 'object') {
      return res.json({ ok: true, raw: message, model, usage, note: 'JSON parse failed; returning raw text' });
    }
    // Basic shape enforcement
    const shape = {
      who: typeof parsed.who === 'string' ? parsed.who : 'Unknown',
      what: typeof parsed.what === 'string' ? parsed.what : 'Unknown',
      where: typeof parsed.where === 'string' ? parsed.where : 'Unknown',
      when: typeof parsed.when === 'string' ? parsed.when : 'Unknown',
      why: typeof parsed.why === 'string' ? parsed.why : 'Unknown',
      how: typeof parsed.how === 'string' ? parsed.how : 'Unknown',
      topband: typeof parsed.topband === 'string' ? parsed.topband : '',
      topbands: Array.isArray(parsed.topbands) ? parsed.topbands.filter(x => typeof x === 'string').slice(0,5) : [],
    };
    return res.json({ ok: true, result: shape, model, usage });
  } catch (err) {
    console.error('❌ [/5w1h] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

// POST /api/ai/tools/topband
router.post('/topband', async (req, res) => {
  try {
    const { text = '', targetLang } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'TEXT_REQUIRED' });
    const cleaned = sanitizeText(text);
    const langHint = targetLang ? ` Respond in ${targetLang}.` : '';
    const system = `You are KiranOS, the NewsPulse editorial AI. Write crisp, factual, non-narrative one-liners for TV/web top bands.`;
    const user = `From the content, create one primary topband and 3-5 alternative one-liners.
Constraints: 6-12 words each, no narrative sentences, no emojis, no hashtags, fact-based.
Return JSON ONLY as {"topband": "...", "options": ["...","..."]}.
${langHint}

Content:
${cleaned}`;
    const { message, model, usage } = await runChat({ system, user, temperature: 0.25, max_tokens: 250 });
    let parsed;
    try { parsed = JSON.parse(message); } catch {
      const m = message && message.match && message.match(/\{[\s\S]*\}$/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e) { /* ignore */ } }
    }
    if (!parsed || typeof parsed !== 'object') {
      return res.json({ ok: true, raw: message, model, usage, note: 'JSON parse failed; returning raw text' });
    }
    const topband = typeof parsed.topband === 'string' ? parsed.topband : '';
    const options = Array.isArray(parsed.options) ? parsed.options.filter(x => typeof x === 'string').slice(0,6) : [];
    return res.json({ ok: true, result: { topband, options }, model, usage });
  } catch (err) {
    console.error('❌ [/topband] AI error:', err?.status || '', err?.message || err);
    const detail = (err && err.response && (err.response.data?.error || err.response.data)) || err?.message || String(err);
    const isAuth = (err?.status === 401) || /incorrect api key|invalid_api_key|unauthorized/i.test(String(detail));
    const isRate = (err?.status === 429) || /rate limit|quota|429/i.test(String(detail));
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail });
  }
});

module.exports = router;
