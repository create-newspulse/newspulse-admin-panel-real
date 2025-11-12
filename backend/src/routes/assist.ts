import { Router } from 'express';
import slugify from 'slugify';

const r = Router();

const trimTo = (s: string, n: number) =>
  s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…';

const naiveSummary = (text: string) => {
  const sentences = text.replace(/\n+/g, ' ').split(/(?<=[.?!])\s+/);
  const take = sentences.slice(0, 2).join(' ');
  const words = take.split(/\s+/);
  return trimTo(words.slice(0, 45).join(' '), 260);
};

const makeSlug = (s: string) =>
  slugify(s || 'untitled', { lower: true, strict: true, trim: true }).slice(0, 120);

type Lang = 'en' | 'hi' | 'gu';

// Gujarati editorial normalization (tiny post-processor)
function normalizeLocalized(text: string, language: Lang): string {
  if (language === 'gu') {
    return text
      .replace(/ઇસ્રોએ/g, 'ઈસરોએ')
      .replace(/ઇસ્રો/g, 'ઈસરો');
  }
  return text;
}

async function suggestWithOpenAI({
  title,
  content,
  language,
}: {
  title: string;
  content: string;
  language: Lang;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const sys = [
    'You are an editorial assistant for a multilingual news site called NewsPulse.',
    'Return a concise JSON object with keys: title, slug, summary, tips.',
    'Title <= 70 chars, factual, no clickbait. Slug should be URL-safe, lowercase, hyphenated.',
    'Summary: 2-3 sentences (<= 300 chars). Tips: array of short strings explaining changes.',
    `Language: ${language}. If content language differs, keep title+summary in ${language}.`,
  ].join(' ');

  const user = [
    `CURRENT TITLE:\n${title || '(empty)'}`,
    `CONTENT (first 2k chars):\n${content?.slice(0, 2000) || '(empty)'}`,
  ].join('\n\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: sys },
          {
            role: 'user',
            content:
              user +
              '\n\nReturn ONLY JSON like: {"title":"","slug":"","summary":"","tips":["",""]}',
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => String(res.status));
      throw new Error(`OpenAI HTTP ${res.status}: ${msg}`);
    }

    const data = (await res.json()) as any;
    const contentText =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (!contentText) return null;

    let parsed: any;
    try {
      parsed = typeof contentText === 'string' ? JSON.parse(contentText) : contentText;
    } catch {
      parsed = contentText;
    }

  const titleOutRaw = trimTo((parsed?.title || title || '').trim(), 70);
  const titleOut = normalizeLocalized(titleOutRaw, language);
    const slugOut = makeSlug(parsed?.slug || titleOut);
  const summaryOutRaw = trimTo((parsed?.summary || naiveSummary(content || title)).trim(), 300);
  const summaryOut = normalizeLocalized(summaryOutRaw, language);
    const tipsOut = Array.isArray(parsed?.tips) ? parsed.tips.slice(0, 6) : [];

    return { title: titleOut, slug: slugOut, summary: summaryOut, tips: tipsOut };
  } catch (err) {
    console.error('[assist/suggest] OpenAI error:', err);
    return null;
  }
}

r.post('/suggest', async (req, res) => {
  try {
    const { title = '', content = '', language = 'en' } = (req.body || {}) as {
      title?: string;
      content?: string;
      language?: Lang;
    };

    const ai = await suggestWithOpenAI({ title, content, language: language as Lang });
    if (ai) return res.json({ ...ai, language });

    let bestTitle = (title || content.split(/\n|\. /)[0] || 'Untitled').trim();
    bestTitle = bestTitle.replace(/\s+/g, ' ');
    bestTitle = trimTo(bestTitle.charAt(0).toUpperCase() + bestTitle.slice(1), 70);

  const slug = makeSlug(bestTitle);
  const summary = normalizeLocalized(naiveSummary(content || bestTitle), language as Lang);

    const tips: string[] = [];
    if ((bestTitle || '').length > 70) tips.push('Title trimmed near 70 chars for SEO.');
    if (!title) tips.push('Headline generated from content.');
    if (!/https?:\/\//.test(content)) tips.push('Consider adding a source link for trust.');

    return res.json({ title: bestTitle, slug, summary, tips, language });
  } catch (e) {
    console.error('[assist/suggest] fatal:', e);
    return res.status(500).json({ error: 'assist-suggest-failed' });
  }
});

export default r;
