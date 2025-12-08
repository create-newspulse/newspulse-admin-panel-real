// api/_lib/ai/summarize.cjs
// Lightweight summarizer using OpenAI Chat Completions via fetch (no extra deps).

const MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-4o-mini';

async function generateSummaryAndTags({ title, text }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const prompt = `You are a news editor. Given the article title and body, do three things:\n\
1) Write a crisp 2-3 sentence summary (max 60 words, neutral tone).\n\
2) Extract 5-8 topical tags (lowercase, hyphenated when multi-word, no hashtags).\n\
3) Propose 2 alternative engaging but accurate titles.\n\
Return strict JSON with keys: summary, tags, titleCandidates.\n\nTitle: ${title}\n\nBody:\n${text}`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Respond with JSON only. No extra commentary.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const textErr = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${textErr}`);
  }
  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';

  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { parsed = {}; }

  return {
    summary: String(parsed.summary || '').trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    titleCandidates: Array.isArray(parsed.titleCandidates)
      ? parsed.titleCandidates.map((t) => String(t).trim()).filter(Boolean)
      : [],
    meta: {
      model: MODEL,
      createdAt: new Date().toISOString(),
      provider: 'openai',
    },
  };
}

module.exports = { generateSummaryAndTags };
