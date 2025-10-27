// Vercel Serverless Function: News Pulse AI Engine
// Secure admin-only endpoint to transform pasted source content into an original news article.
// Supports provider adapters for Anthropic (Claude), OpenAI, and Google (Gemini).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

// --- utils ---------------------------------------------------------------
function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    cookies[k] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function trimTo(input: string, max = 15000) {
  if (!input) return '';
  return input.length > max ? input.slice(0, max) : input;
}

function buildPrompt(opts: {
  language?: string;
  taskType?: string;
  founderCommand?: string;
  sourceText?: string;
  url?: string;
}) {
  const { language = 'English', taskType = 'Rewrite', founderCommand = '', sourceText = '', url } = opts;
  const fcmd = founderCommand?.trim()
    ? `Founder Command (ALWAYS FOLLOW, highest priority): ${founderCommand.trim()}`
    : 'Founder Command: none';

  // 5W1H: who, what, where, when, why, how
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

function jaccardUniqueness(a: string, b: string) {
  // Tokenize into lowercase word 3-grams; produce uniqueness = 1 - Jaccard similarity
  const toTri = (s: string) => {
    const words = (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const grams = new Set<string>();
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

async function callOpenAI(model: string, prompt: string, apiKey?: string) {
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You return only strict JSON. No markdown fences.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!resp.ok) throw new Error(`OpenAI error ${resp.status}`);
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content?.trim?.() || '';
  return text;
}

async function callAnthropic(model: string, prompt: string, apiKey?: string) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet-20240620',
      max_tokens: 2000,
      temperature: 0.7,
      system: 'You return only strict JSON. No markdown fences.',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!resp.ok) throw new Error(`Anthropic error ${resp.status}`);
  const data = await resp.json();
  const text = data?.content?.[0]?.text || '';
  return text;
}

async function callGemini(model: string, prompt: string, apiKey?: string) {
  // Accept either GOOGLE_API_KEY or GEMINI_API_KEY for flexibility
  const key = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key missing (set GOOGLE_API_KEY or GEMINI_API_KEY)');
  const m = encodeURIComponent(model || 'gemini-1.5-pro');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
  });
  if (!resp.ok) throw new Error(`Gemini error ${resp.status}`);
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

const REQUIRED_ENV = ['ADMIN_JWT_SECRET'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Validate method
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Required env
    for (const key of REQUIRED_ENV) {
      if (!process.env[key]) return res.status(500).json({ error: `Missing env ${key}` });
    }

    // Check admin session cookie
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['np_admin'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!), {
        audience: 'admin',
        issuer: 'newspulse',
      });
    } catch (e) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : JSON.parse(String(req.body || '{}'));
    const {
      provider = 'auto',
      model = '',
      language = 'English',
      taskType = 'Rewrite',
      founderCommand = '',
      sourceText = '',
      url = '',
    } = body || {};

    const prompt = buildPrompt({ language, taskType, founderCommand, sourceText, url });

    let chosenProvider = provider;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);

    if (chosenProvider === 'auto') {
      // Prefer Anthropic, then OpenAI, then Gemini when configured
      if (hasAnthropic) chosenProvider = 'anthropic';
      else if (hasOpenAI) chosenProvider = 'openai';
      else if (hasGemini) chosenProvider = 'gemini';
      else {
        return res.status(500).json({
          error: 'No AI provider keys configured. Set at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY/GEMINI_API_KEY.'
        });
      }
    }

    let raw = '';
  if (chosenProvider === 'openai') raw = await callOpenAI(model, prompt, process.env.OPENAI_API_KEY);
  else if (chosenProvider === 'anthropic') raw = await callAnthropic(model, prompt, process.env.ANTHROPIC_API_KEY);
  else if (chosenProvider === 'gemini') raw = await callGemini(model, prompt, process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    else return res.status(400).json({ error: 'Unsupported provider' });

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Sometimes models wrap JSON in fences or add text; attempt to extract first {...}
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch {}
      }
    }
    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({ error: 'Model did not return JSON', provider: chosenProvider, raw });
    }

    const article: string = parsed.article || '';
    const uniqueness = jaccardUniqueness(String(sourceText || ''), article);

    return res.status(200).json({
      success: true,
      provider: chosenProvider,
      model: model || null,
      result: parsed,
      safety: {
        uniquenessScore: Number(uniqueness.toFixed(3)),
        note: 'Score ~1.0 means highly original vs source; ~0 means high overlap.'
      }
    });
  } catch (err: any) {
    console.error('AI Engine error:', err);
    const msg = err?.message || 'AI engine failure';
    return res.status(500).json({ error: msg });
  }
}
