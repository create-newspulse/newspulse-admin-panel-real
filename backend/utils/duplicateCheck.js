// backend/utils/duplicateCheck.js
// Cosine similarity on character trigrams against recent Article titles.

const Article = require('../models/Article');

function trigrams(s) {
  const t = (s || '').toLowerCase().replace(/\s+/g,' ').trim();
  const arr = [];
  for (let i=0;i<t.length-2;i++) arr.push(t.slice(i,i+3));
  return arr;
}
function cosine(a,b) {
  let dot=0, na=0, nb=0;
  for (const [,v] of a) na += v*v;
  for (const [,v] of b) nb += v*v;
  for (const [k,v] of a) { const w = b.get(k); if (w) dot += v*w; }
  if (!na || !nb) return 0; return dot / (Math.sqrt(na)*Math.sqrt(nb));
}
function vec(tokens) { const m = new Map(); tokens.forEach(t=> m.set(t,(m.get(t)||0)+1)); return m; }

async function duplicateHeadlineScore(title, lookbackDays=30) {
  const since = new Date(Date.now() - lookbackDays*86400000);
  const docs = await Article.find({ createdAt: { $gte: since } }, { title:1 }).sort({ createdAt:-1 }).limit(200).lean();
  const vA = vec(trigrams(title));
  let best=0, bestId=null;
  for (const d of docs) {
    const vB = vec(trigrams(d.title || ''));
    const sim = cosine(vA, vB);
    if (sim > best) { best = sim; bestId = String(d._id); }
  }
  return { score: Number(best.toFixed(3)), closestId: bestId };
}

module.exports = { duplicateHeadlineScore };
