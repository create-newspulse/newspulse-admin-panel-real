const express = require('express');
const slugify = require('slugify');
const { buildSeoHints } = require('../utils/seoHints');
const { ptiGuard } = require('../utils/ptiGuard');
const { duplicateHeadlineScore } = require('../utils/duplicateCheck');
const router = express.Router();

const trimTo = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…');

function naiveSummary(text) {
  const sentences = (text || '').replace(/\n+/g, ' ').split(/(?<=[.?!])\s+/);
  const take = sentences.slice(0, 2).join(' ');
  const words = take.split(/\s+/);
  return trimTo(words.slice(0, 45).join(' '), 260);
}

const makeSlug = (s) => slugify(s || 'untitled', { lower: true, strict: true, trim: true }).slice(0, 120);

router.post('/suggest', async (req, res) => {
  try {
    const { title = '', content = '', language = 'en' } = req.body || {};
    // OpenAI attempt (optional) - only if key exists
    const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
      const sys = [
        'You are an editorial assistant for a multilingual news site called NewsPulse.',
        'Return a concise JSON object with keys: title, slug, summary, tips.',
        'Title <= 70 chars, factual, no clickbait. Slug should be URL-safe, lowercase, hyphenated.',
        'Summary: 2-3 sentences (<= 300 chars). Tips: array of short strings explaining changes.',
        `Language: ${language}. If content language differs, keep title+summary in ${language}.`
      ].join(' ');
      const user = [
        `CURRENT TITLE:\n${title || '(empty)'}`,
        `CONTENT (first 2k chars):\n${(content || '').slice(0,2000) || '(empty)'}`
      ].join('\n\n');
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: user + '\n\nReturn ONLY JSON like: {"title":"","slug":"","summary":"","tips":["",""]}' }
            ],
            response_format: { type: 'json_object' }
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          const contentText = data?.choices?.[0]?.message?.content;
          if (contentText) {
            let parsed;
            try { parsed = JSON.parse(contentText); } catch { parsed = {}; }
            const titleOutRaw = trimTo((parsed.title || title || '').trim(), 70);
            const titleOut = language === 'gu'
              ? titleOutRaw.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો')
              : titleOutRaw;
            const slugOut = makeSlug(parsed.slug || titleOut);
            const summaryOutRaw = trimTo((parsed.summary || naiveSummary(content || title)).trim(), 300);
            const summaryOut = language === 'gu'
              ? summaryOutRaw.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો')
              : summaryOutRaw;
            const tipsOut = Array.isArray(parsed.tips) ? parsed.tips.slice(0,6) : [];
            return res.json({ title: titleOut, slug: slugOut, summary: summaryOut, tips: tipsOut, language });
          }
        }
      } catch (e) { console.error('[assist/suggest] OpenAI error:', e); }
    }
    let bestTitle = (title || '').trim();
    if (!bestTitle && content) bestTitle = (content.split(/\n|\. /)[0] || '').trim();
    bestTitle = (bestTitle || '').replace(/\s+/g, ' ');
    if (bestTitle) bestTitle = bestTitle.charAt(0).toUpperCase() + bestTitle.slice(1);

  const bestSlug = makeSlug(bestTitle || 'untitled');
    let summary = naiveSummary(content || bestTitle);
    if (language === 'gu') {
      summary = summary.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો');
      bestTitle = bestTitle.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો');
    }

    const tips = [];
    if ((bestTitle || '').length > 70) tips.push('Title shortened to ~70 chars for SEO.');
  if (!title) tips.push('Headline generated from content.');
    if ((summary || '').length < 40) tips.push('Add a two-line intro for better readability.');
    if (!/https?:\/\//.test(content || '')) tips.push('Consider citing a source for higher trust.');

    res.json({ title: bestTitle, slug: bestSlug, summary, tips, language });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'assist-suggest-failed' });
  }
});

// v2 suggestions: adds seo, compliance, duplicate check
router.post('/suggest/v2', async (req, res) => {
  try {
    const { title = '', content = '', language = 'en' } = req.body || {};
    const lang = language === 'hi' ? 'hi' : language === 'gu' ? 'gu' : 'en';
    // base heuristics reusing existing naive summary
    const naiveSummary = (text, ttl) => {
      const t = (ttl || '').toLowerCase().replace(/\s+/g,' ').trim();
      const cands = (text || '').replace(/\n+/g,' ').split(/(?<=[.?!])\s+/).filter(Boolean);
      const filtered = cands.filter(s => s.trim() && s.toLowerCase() !== t);
      const take = filtered.slice(0,2).join(' ');
      const words = take.split(/\s+/).filter(Boolean);
      const target = Math.min(Math.max(25, words.length), 45);
      return words.slice(0,target).join(' ');
    };
    let workingTitle = (title || '').trim();
    if (!workingTitle && content) workingTitle = (content.split(/\n|\. /)[0]||'').trim();
    workingTitle = workingTitle.replace(/\s+/g,' ');
    if (workingTitle) workingTitle = workingTitle.charAt(0).toUpperCase() + workingTitle.slice(1);
    const workingSummary = naiveSummary(content || workingTitle, workingTitle);
    const seo = buildSeoHints({ title: workingTitle, summary: workingSummary, lang });
    const compliance = ptiGuard({ title: workingTitle, summary: workingSummary, lang });
    const duplicate = await duplicateHeadlineScore(workingTitle, 45);
    const slugLatin = slugify(workingTitle || 'untitled', { lower:true, strict:true, trim:true }).slice(0,120);
    // native slug keeps Devanagari/Gujarati letters
    const nativeSlug = (s) => (s || '')
      .normalize('NFC')
      .toLowerCase()
      .replace(/[\u2019'"`]+/g, '')
      .replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120);
    const slugNative = nativeSlug(workingTitle || 'untitled');

    // simple tone variants for summary
    const summary = {
      neutral: workingSummary,
      impact: `${workingSummary} તાજેતરના અપડેટ્સ અને મુખ્ય અસર માટે જોડાયેલા રહો.`,
      analytical: `${workingSummary} પરિસ્થિતિના કારણ-પરિણામ અને સંદર્ભ પર વધુ પ્રકાશ પાડે છે.`,
    };
    const response = {
      title: { standard: workingTitle },
      slug: { latin: slugLatin, native: slugNative },
      summary,
      seo, compliance, duplicate, language: lang,
    };
    res.json(response);
  } catch (e) {
    console.error('[assist/suggest/v2] error', e);
    res.status(500).json({ error: 'assist-suggest-v2-failed' });
  }
});


module.exports = router;
