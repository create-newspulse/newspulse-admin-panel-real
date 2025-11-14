import express from 'express';

// Lightweight magic-link style session endpoints for the admin SPA
// Cookie name used by the SPA when checking session
const COOKIE_NAME = 'np_admin';

const router = express.Router();

// Parse cookies without bringing cookie-parser to avoid extra dependency
function getCookie(req, name) {
  const raw = req.headers?.cookie || '';
  const parts = raw.split(';');
  for (const p of parts) {
    const [k, v] = p.trim().split('=');
    if (k === name) return decodeURIComponent(v || '');
  }
  return undefined;
}

// GET /api/admin-auth/session -> { authenticated, email? }
router.get('/session', (req, res) => {
  const cookie = getCookie(req, COOKIE_NAME);
  if (cookie) {
    return res.json({ authenticated: true, email: cookie });
  }
  return res.json({ authenticated: false });
});

// POST /api/admin-auth/logout -> clears cookie
router.post('/logout', (req, res) => {
  // Clear the cookie under multiple attribute combos to cover dev/prod and proxies
  const baseOpts = { path: '/' };
  const combos = [
    { sameSite: 'none', secure: true },
    { sameSite: 'lax', secure: false },
    { sameSite: 'strict', secure: false }
  ];

  // Try without domain and with a derived domain (strip subdomain) for host-based cookies
  const host = (req.headers.host || '').split(':')[0] || undefined;
  const parts = host ? host.split('.') : [];
  const apex = parts.length > 2 ? parts.slice(-2).join('.') : host; // e.g. admin.dev.example.com -> example.com
  const domains = [undefined, apex && `.${apex}`, host && `.${host}`].filter(Boolean);

  try {
    // Use res.cookie expired variant first (covers some proxies that ignore clearCookie)
    for (const combo of combos) {
      res.cookie(COOKIE_NAME, '', { ...baseOpts, ...combo, httpOnly: true, expires: new Date(0) });
      res.cookie(COOKIE_NAME, '', { ...baseOpts, ...combo, httpOnly: false, expires: new Date(0) });
      for (const domain of domains) {
        res.cookie(COOKIE_NAME, '', { ...baseOpts, ...combo, domain, httpOnly: true, expires: new Date(0) });
        res.cookie(COOKIE_NAME, '', { ...baseOpts, ...combo, domain, httpOnly: false, expires: new Date(0) });
      }
    }
  } catch (_) {}

  try {
    for (const combo of combos) {
      res.clearCookie(COOKIE_NAME, { ...baseOpts, ...combo });
      for (const domain of domains) {
        res.clearCookie(COOKIE_NAME, { ...baseOpts, ...combo, domain });
      }
    }
  } catch (_) {}

  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, cleared: true });
});

// Optional demo helpers for manual testing
// POST /api/admin-auth/start { email } -> returns magic verify link (local dev helper)
router.post('/start', (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email required' });
  }
  const allowed = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Email not allowed' });
  }
  // In backend dev we can simply link to verify endpoint with email parameter
  const origin = process.env.ADMIN_SITE_ORIGIN || 'http://localhost:5173';
  const link = `${origin}/api/admin-auth/verify?email=${encodeURIComponent(email)}`;
  return res.json({ ok: true, link });
});
// GET /api/admin-auth/verify?email=you@example.com -> sets session cookie and redirects
router.get('/verify', (req, res) => {
  const email = (req.query.email || 'admin@newspulse.ai').toString();
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOpts = {
    httpOnly: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  };
  try {
    res.cookie(COOKIE_NAME, email, cookieOpts);
  } catch (_) {}
  // Redirect to frontend root by default
  const dest = req.query.redirect || '/';
  res.redirect(dest);
});

export default router;
