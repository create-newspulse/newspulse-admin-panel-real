// admin-backend/backend/routes/system/live-content.mjs
import express from 'express';
import LiveContent from '../../models/LiveContent.mjs';

const router = express.Router();

const ALLOW_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'youtube-nocookie.com',
  'youtu.be', 'www.youtu.be',
  'player.vimeo.com', 'vimeo.com', 'www.vimeo.com',
  'x.com', 'www.x.com', 'twitter.com', 'www.twitter.com',
]);

function extractSrc(input = '') {
  if (!input) return '';
  const trimmed = String(input).trim();
  // If plain URL, use as src
  try {
    const u = new URL(trimmed);
    return u.toString();
  } catch {}
  // Try to extract iframe src="..."
  const m = /<iframe[^>]+src=["']([^"']+)["']/i.exec(trimmed);
  if (m && m[1]) {
    try {
      const u = new URL(m[1]);
      return u.toString();
    } catch {
      return m[1];
    }
  }
  return '';
}

function isAllowed(src = '') {
  try {
    const u = new URL(src);
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    return ALLOW_HOSTS.has(h) || [...ALLOW_HOSTS].some(a => h.endsWith('.' + a.replace(/^www\./, '')));
  } catch { return false; }
}

function normalize(src = '') {
  // Normalize YouTube watch URLs to embed URLs
  try {
    const u = new URL(src);
    if (u.hostname.includes('youtube.com') && u.pathname === '/watch') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '');
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
    return u.toString();
  } catch { return src; }
}

// GET current live content config
router.get('/', async (_req, res) => {
  try {
    const doc = await LiveContent.getSingleton();
    res.json({ ok: true, mode: doc.mode, embedCode: doc.embedCode, updatedAt: doc.updatedAt });
  } catch (err) {
    console.error('❌ /api/live-content GET error:', err);
    res.status(500).json({ ok: false, error: 'LIVE_CONTENT_ERROR' });
  }
});

// POST update live content
router.post('/update', async (req, res) => {
  try {
    const { mode, embedCode } = req.body || {};
    const nextMode = mode === 'live' ? 'live' : 'inspiration';
    let sanitized = '';
    if (nextMode === 'live') {
      const src = normalize(extractSrc(embedCode || ''));
      if (!src || !isAllowed(src)) {
        return res.status(400).json({ ok: false, error: 'INVALID_EMBED', message: 'Unsupported or unsafe embed source.' });
      }
      sanitized = src;
    }

    const doc = await LiveContent.getSingleton();
    doc.mode = nextMode;
    // Store only sanitized src, not raw HTML
    doc.embedCode = sanitized;
    doc.updatedAt = new Date();
    await doc.save();

    // Notify via Socket.IO if available
    try {
      const io = req.app?.locals?.io;
      if (io) io.emit('live-content-updated', { mode: doc.mode, embedCode: doc.embedCode, updatedAt: doc.updatedAt });
    } catch {}

    res.json({ ok: true, mode: doc.mode, embedCode: doc.embedCode, updatedAt: doc.updatedAt });
  } catch (err) {
    console.error('❌ /api/live-content/update error:', err);
    res.status(500).json({ ok: false, error: 'LIVE_CONTENT_UPDATE_ERROR', message: err?.message || 'Update failed' });
  }
});

export default router;
