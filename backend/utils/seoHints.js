// backend/utils/seoHints.js
// Extract top keywords, build hashtags, and score hookiness of a title.

/** @typedef {'en'|'hi'|'gu'} Lang */

const STOP_EN = new Set(['the','a','an','of','and','to','in','on','for','with','by','from','at','is','are','was','were','be','as','it','its','this','that','these','those','over','across','into','about','after','before','their','his','her','our','your']);
const STOP_HI = new Set(['का','की','के','एक','और','से','को','पर','है','था','थे','यह','वह','में','लिए','हो','रहा','रही']);
const STOP_GU = new Set(['નું','ના','ની','અને','છે','આ','તે','મા','પર','થી','ને','એક','જો','હતું','હતા']);

function tokenizeForSeo(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[“”"‘’'()·.,:;!?]/g,' ')
    .split(/\s+/)
    .filter(Boolean);
}
function tf(tokens, stop) {
  const m = new Map();
  for (const t of tokens) { if (stop.has(t)) continue; m.set(t, (m.get(t)||0)+1); }
  return m;
}
function sortTop(m, n=5) {
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k])=>k);
}
function toHashtags(words) {
  return words.map(w => w.replace(/[^a-z\u0900-\u097F\u0A80-\u0AFF0-9\s]/gi,' ').trim())
    .map(w => w.split(/\s+/).map(p => p.charAt(0).toUpperCase()+p.slice(1)).join(''))
    .map(w => `#${w}`)
    .slice(0,5);
}
function hookScore(title) {
  let score = 50;
  if (/\b\d{2,4}\b/.test(title)) score += 10;
  if (/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/.test(title)) score += 5;
  if (/\b(today|now|live|update|new)\b/i.test(title)) score += 8;
  const len = title.length;
  if (len >= 45 && len <= 70) score += 12; else if (len < 35 || len > 90) score -= 8;
  return Math.max(0, Math.min(100, score));
}
function buildSeoHints(input) {
  const lang = input.lang || 'en';
  const tokens = tokenizeForSeo(`${input.title || ''} ${input.summary || ''}`);
  const stop = lang === 'hi' ? STOP_HI : lang === 'gu' ? STOP_GU : STOP_EN;
  const bag = tf(tokens, stop);
  const keywords = sortTop(bag, 5);
  const hashtags = toHashtags(keywords);
  const titleHookScore = hookScore(input.title || '');
  const summaryLen = (input.summary || '').length;
  const notes = [];
  if (titleHookScore < 70) notes.push('Consider adding a number/year or a clear entity.');
  if (summaryLen < 120) notes.push('Summary looks short; aim 120–180 chars.');
  if (summaryLen > 220) notes.push('Summary is long; trim to ~160 chars.');
  return { keywords, hashtags, titleHookScore, summaryLen, notes };
}
module.exports = { buildSeoHints };
