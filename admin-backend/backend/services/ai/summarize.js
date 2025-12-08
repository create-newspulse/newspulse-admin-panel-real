// backend/services/ai/summarize.js
// Minimal summarization/tagline/title candidate generator using OpenAI.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Prefer the shared admin-backend OpenAI client if present
let openai;
try {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  ({ openai } = require('../../../openaiClient'));
} catch (e) {
  // Fallback simple client using the official library
  const { OpenAI } = require('openai');
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-4o-mini';

/**
 * Summarize an article body into a concise summary and extract 5-8 tags.
 * Input contract:
 * - title: string
 * - text: string (plain text)
 * Output contract:
 * { summary: string, tags: string[], titleCandidates: string[] }
 */
async function generateSummaryAndTags({ title, text }) {
  const prompt = `You are a news editor. Given the article title and body, do three things:
1) Write a crisp 2-3 sentence summary (max 60 words, neutral tone).
2) Extract 5-8 topical tags (lowercase, hyphenated when multi-word, no hashtags).
3) Propose 2 alternative engaging but accurate titles.

Return strict JSON with keys: summary, tags, titleCandidates.

Title: ${title}\n\nBody:\n${text}`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'Respond with JSON only. No extra commentary.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = { summary: '', tags: [], titleCandidates: [] };
  }

  return {
    summary: String(parsed.summary || '').trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    titleCandidates: Array.isArray(parsed.titleCandidates)
      ? parsed.titleCandidates.map((t) => String(t).trim()).filter(Boolean)
      : [],
    meta: {
      model: MODEL,
      createdAt: new Date().toISOString(),
    },
  };
}

module.exports = { generateSummaryAndTags };
