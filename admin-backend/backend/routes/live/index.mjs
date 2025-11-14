// admin-backend/backend/routes/live/index.mjs
// Minimal ESM router for Live TV endpoints (in-memory stub)

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const store = { feeds: [], schedules: [] };

const ALLOWED_HOSTS = ['youtube.com', 'youtu.be', 'www.youtube.com', 'x.com', 'twitter.com', 'www.twitter.com', 'facebook.com', 'www.facebook.com', 'pib.gov.in', 'pmindia.gov.in', 'cmogujarat.gov.in'];

function newId(prefix='lf') { return `${prefix}_${crypto.randomBytes(6).toString('hex')}`; }
function hostOk(url='') { try { const u = new URL(url); return ALLOWED_HOSTS.includes(u.hostname); } catch { return false; } }

router.post('/create', (req, res) => {
  const { title = 'Untitled', rawInput = '', sourceType = 'OTHER' } = req.body || {};
  const rec = { _id: newId(), title, sourceType, rawInput, isActive: false, displayMode: 'HERO', ptiCompliance: { status: 'PENDING' }, safety: { status: 'SAFE' }, fallback: { mode: 'SLIDESHOW' }, createdBy: 'admin', updatedAt: new Date().toISOString() };
  store.feeds.unshift(rec);
  console.log('✅ Created feed:', rec._id, '| Total feeds:', store.feeds.length);
  return res.json({ ok: true, data: rec });
});

router.post('/:id/sanitize', (req, res) => {
  const { id } = req.params;
  console.log('📥 Sanitize request for ID:', id, '| Store has:', store.feeds.length, 'feeds');
  const rec = store.feeds.find(f => f._id === id);
  if (!rec) {
    console.log('❌ Feed not found! Available IDs:', store.feeds.map(f => f._id));
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }
  const raw = String(req.body?.rawInput ?? rec.rawInput ?? '');
  console.log('📝 Raw input:', raw.substring(0, 100) + '...');
  
  // Try multiple patterns to extract YouTube video ID
  let videoId = null;
  
  // Pattern 1: youtube.com/embed/VIDEO_ID (from iframe src)
  const embedMatch = raw.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch) videoId = embedMatch[1];
  
  // Pattern 2: youtube.com/watch?v=VIDEO_ID (from regular links)
  if (!videoId) {
    const watchMatch = raw.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/i);
    if (watchMatch) videoId = watchMatch[1];
  }
  
  // Pattern 3: youtu.be/VIDEO_ID (short links)
  if (!videoId) {
    const shortMatch = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (shortMatch) videoId = shortMatch[1];
  }
  
  console.log('🎬 Extracted video ID:', videoId || 'NONE');
  
  let html = '';
  if (videoId) {
    html = `<iframe src="https://www.youtube.com/embed/${videoId}" title="Live" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="no-referrer" allowfullscreen class="w-full h-full"></iframe>`;
  }
  
  rec.sanitizedEmbedHtml = html;
  rec.updatedAt = new Date().toISOString();
  console.log('✅ Sanitized HTML length:', html.length);
  return res.json({ ok: true, data: { sanitizedEmbedHtml: html } });
});

router.post('/:id/validate', (req, res) => {
  const rec = store.feeds.find(f => f._id === req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const raw = String(req.body?.rawInput ?? rec.rawInput ?? '');
  const url = (raw.match(/https?:[^\s"']+/) || [])[0] || '';
  const allowed = hostOk(url);
  const result = { ptiCompliance: { status: allowed ? 'PASS' : 'FAIL', notes: allowed ? 'Allowlisted source' : 'Host not in allowlist' }, safety: { status: allowed ? 'SAFE' : 'BLOCKED', reason: allowed ? '' : 'Unapproved host' } };
  rec.ptiCompliance = result.ptiCompliance;
  rec.safety = result.safety;
  rec.updatedAt = new Date().toISOString();
  return res.json({ ok: true, data: result });
});

router.post('/:id/activate', (req, res) => {
  const rec = store.feeds.find(f => f._id === req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  if (rec.ptiCompliance?.status !== 'PASS' || rec.safety?.status !== 'SAFE') return res.status(403).json({ ok: false, error: 'GUARD_FAIL' });
  store.feeds.forEach(f => (f.isActive = false));
  rec.isActive = true;
  rec.updatedAt = new Date().toISOString();
  return res.json({ ok: true, data: rec });
});

router.post('/:id/deactivate', (req, res) => {
  const rec = store.feeds.find(f => f._id === req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  rec.isActive = false;
  rec.updatedAt = new Date().toISOString();
  return res.json({ ok: true, data: rec });
});

router.get('/active', (_req, res) => {
  const active = store.feeds.find(f => f.isActive && f.safety?.status === 'SAFE');
  return res.json({ ok: true, data: { feed: active || null, fallback: active?.fallback?.mode || 'SLIDESHOW' } });
});

router.get('/schedule', (_req, res) => res.json({ ok: true, data: store.schedules }));

export default router;
