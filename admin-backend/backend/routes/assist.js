const express = require('express');
const slugify = require('slugify');
const router = express.Router();
const Article = require('../models/Article');

// ---- helpers ----
const trimTo = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…');

const naiveSummary = (text) => {
  const sentences = (text || '').replace(/\n+/g, ' ').split(/(?<=[.?!])\s+/);
  const take = sentences.slice(0, 2).join(' ');
  const words = take.split(/\s+/);
  return trimTo(words.slice(0, 45).join(' '), 260);
};

const makeSlug = (s) => slugify(s || 'untitled', { lower: true, strict: true, trim: true }).slice(0, 120);

// Try OpenAI; fallback to local heuristics if not configured or fails
async function tryOpenAI({ title, content, language }) {
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
    `CONTENT (first 2k chars):\n${(content || '').slice(0,2000) || '(empty)'}`,
  ].join('\n\n');
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user + '\n\nReturn ONLY JSON like: {"title":"","slug":"","summary":"","tips":["",""]}' },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`);
    const data = await resp.json();
    const contentText = data?.choices?.[0]?.message?.content;
    if (!contentText) return null;
    let parsed;
    try { parsed = JSON.parse(contentText); } catch { parsed = {}; }
    let titleOut = trimTo(((parsed.title || title || '').trim()), 70);
    let summaryOut = trimTo(((parsed.summary || naiveSummary(content || title)).trim()), 300);
    if (language === 'gu') {
      titleOut = titleOut.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો');
      summaryOut = summaryOut.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો');
    }
    const slugOut = makeSlug(parsed.slug || titleOut);
    const tipsOut = Array.isArray(parsed.tips) ? parsed.tips.slice(0,6) : [];
    return { title: titleOut, slug: slugOut, summary: summaryOut, tips: tipsOut };
  } catch (e) {
    console.error('[assist] OpenAI error:', e.message || e);
    return null;
  }
}

router.post('/suggest', async (req, res) => {
  try {
    const { title = '', content = '', language = 'en' } = req.body || {};

    const ai = await tryOpenAI({ title, content, language });
    if (ai) return res.json({ ...ai, language });

    // Fallback heuristic
    let bestTitle = (title || content.split(/\n|\. /)[0] || 'Untitled').trim();
    bestTitle = bestTitle.replace(/\s+/g, ' ');
    bestTitle = trimTo(bestTitle.charAt(0).toUpperCase() + bestTitle.slice(1), 70);
    const slug = makeSlug(bestTitle);
    let summary = naiveSummary(content || bestTitle);
    if (language === 'gu') {
      bestTitle = bestTitle.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો');
      summary = summary.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો');
    }
    const tips = [];
    if ((bestTitle || '').length > 70) tips.push('Title trimmed near 70 chars for SEO.');
    if (!title) tips.push('Headline generated from content.');
    if (!/https?:\/\//.test(content || '')) tips.push('Consider adding a source link for trust.');
    return res.json({ title: bestTitle, slug, summary, tips, language });
  } catch (e) {
    console.error('[assist/suggest] fatal:', e);
    return res.status(500).json({ error: 'assist-suggest-failed' });
  }
});

module.exports = router;

// ---- v2 suggestions: adds seo, compliance, duplicate check, native slug + tone summaries ----
// NOTE: This is a lightweight inline implementation (no external utils). For production, consider
// extracting seo/compliance/duplicate logic into dedicated utility modules similar to /backend/utils.
router.post('/suggest/v2', async (req, res) => {
  try {
    const { title = '', content = '', language = 'en' } = req.body || {};
    const lang = ['hi','gu'].includes(language) ? language : 'en';

    // ---- Build working title ----
    let workingTitle = (title || '').trim();
    if (!workingTitle && content) workingTitle = (content.split(/\n|\. /)[0] || '').trim();
    workingTitle = workingTitle.replace(/\s+/g, ' ');
    if (workingTitle) workingTitle = workingTitle.charAt(0).toUpperCase() + workingTitle.slice(1);

    // ---- Naive summary (2 sentences, ~45 words cap) ----
    const naiveSummary = (text, ttl) => {
      const tLower = (ttl || '').toLowerCase();
      const sentences = (text || '').replace(/\n+/g,' ').split(/(?<=[.?!])\s+/).filter(Boolean);
      const filtered = sentences.filter(s => s.trim().toLowerCase() !== tLower);
      const take = filtered.slice(0,2).join(' ');
      const words = take.split(/\s+/).filter(Boolean);
      return words.slice(0, Math.min(Math.max(25, words.length), 45)).join(' ');
    };
    const baseSummary = naiveSummary(content || workingTitle, workingTitle);

    // ---- SEO hints (very simple keyword extraction) ----
    const STOP = new Set(['the','a','an','and','or','of','in','on','at','for','to','is','are','was','were','with','by','from','this','that','will','be']);
    const textForSeo = `${workingTitle} ${baseSummary}`.toLowerCase();
    const freq = {};
    textForSeo.replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]+/g,' ').split(/\s+/).filter(Boolean).forEach(w=>{
      if (STOP.has(w) || w.length < 3) return; freq[w] = (freq[w]||0)+1;
    });
    const keywords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
    const hashtags = keywords.slice(0,5).map(k=>`#${k.replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]/g,'')}`);
    const hookScore = Math.min(100, (workingTitle.length/1.6) + keywords.length*4 + (/[!?]/.test(workingTitle)?5:0));
    const seo = { keywords, hashtags, hookScore: Math.round(hookScore) };

    // ---- Compliance (naive PTI risk word scan) ----
    const RISK_WORDS = ['shocking','sensational','exclusive','bombshell','viral','outrage','panic'];
    const lowerTitle = workingTitle.toLowerCase();
    const riskWords = RISK_WORDS.filter(w=> lowerTitle.includes(w));
    const ptiFlags = [];
    if (workingTitle.length > 100) ptiFlags.push('title-too-long');
    if (riskWords.length) ptiFlags.push('clickbait-risk');
    const advice = [];
    if (ptiFlags.includes('title-too-long')) advice.push('Shorten headline below ~90 chars.');
    if (ptiFlags.includes('clickbait-risk')) advice.push('Remove promotional adjectives for neutral tone.');
    const compliance = { ptiFlags, riskWords, advice };

    // ---- Duplicate headline score (cosine on word freq vs recent 100) ----
    async function duplicateHeadlineScore(headline, recent = 100) {
      try {
        const docs = await Article.find({ title: { $exists: true } }).sort({ createdAt: -1 }).limit(recent).select('title').lean();
        const tokenize = s => (s||'').toLowerCase().replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]+/g,' ').split(/\s+/).filter(w=>w && !STOP.has(w));
        const baseTokens = tokenize(headline);
        const baseFreq = {}; baseTokens.forEach(t=> baseFreq[t]=(baseFreq[t]||0)+1);
        let best = { score: 0, nearest: null };
        for (const d of docs) {
          const tf = {}; tokenize(d.title).forEach(t=> tf[t]=(tf[t]||0)+1);
          const allKeys = new Set([...Object.keys(baseFreq), ...Object.keys(tf)]);
          let dot=0, a2=0, b2=0;
          for (const k of allKeys) { const a = baseFreq[k]||0; const b = tf[k]||0; dot += a*b; a2 += a*a; b2 += b*b; }
          const sim = a2 && b2 ? dot / (Math.sqrt(a2)*Math.sqrt(b2)) : 0;
          if (sim > best.score) best = { score: sim, nearest: { title: d.title, id: d._id } };
        }
        return best;
      } catch { return { score: 0, nearest: null }; }
    }
    const duplicate = await duplicateHeadlineScore(workingTitle, 100);

    // ---- Slugs (latin vs native) ----
    const slugLatin = slugify(workingTitle || 'untitled', { lower:true, strict:true, trim:true }).slice(0,120);
    const nativeSlug = (s) => (s || 'untitled')
      .normalize('NFC')
      .toLowerCase()
      .replace(/[\u2019'"`]+/g, '')
      .replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0,120);
    const slugNative = nativeSlug(workingTitle);

    // ---- Tone variants ----
    const summary = {
      neutral: baseSummary,
      impact: `${baseSummary} Stay tuned for unfolding developments and key impact.`,
      analytical: `${baseSummary} It highlights underlying factors, context and implications.`,
    };
    if (lang === 'gu') {
      // Gujarati tone tweaks (basic replacements from original heuristic)
      summary.impact = `${baseSummary} તાજેતરના અપડેટ્સ અને મુખ્ય અસર માટે જોડાયેલા રહો.`;
      summary.analytical = `${baseSummary} પરિસ્થિતિના કારણ-પરિણામ અને સંદર્ભ પર વધુ પ્રકાશ પાડે છે.`;
    }

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
