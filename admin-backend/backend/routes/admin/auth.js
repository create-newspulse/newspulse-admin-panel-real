// backend/routes/admin/auth.js (CommonJS)
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'newspulse-secret';

// sanity check in browser: GET /api/admin/auth/ping
router.get('/ping', (_req, res) => res.json({ ok: true, route: 'admin/auth', ts: new Date().toISOString() }));

// ---- DB-backed login ----
// NOTE: Actual mounted path is /api/admin/login (NOT /api/admin/auth/login)
// Backward-compatible alias added below at /api/admin/auth/login to avoid 404s from outdated frontend code.
// POST /api/admin/login  { email, password }
const loginHandler = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    // ---- Diagnostics: request + env snapshot (no raw password logging) ----
    try {
      const redacted = {
        email,
        passwordLen: password ? password.length : 0,
        headers: {
          host: req.headers?.host,
          origin: req.headers?.origin,
          referer: req.headers?.referer,
          'x-forwarded-host': req.headers?.['x-forwarded-host'],
          'x-forwarded-proto': req.headers?.['x-forwarded-proto'],
        },
        env: {
          NODE_ENV: process.env.NODE_ENV,
          MONGO_URI_set: Boolean(process.env.MONGO_URI),
          JWT_SECRET_set: Boolean(process.env.JWT_SECRET),
          ADMIN_EMAIL_set: Boolean(process.env.ADMIN_EMAIL),
          ADMIN_PASS_set: Boolean(process.env.ADMIN_PASS),
          FOUNDER_EMAIL_set: Boolean(process.env.FOUNDER_EMAIL),
          FOUNDER_PASSWORD_set: Boolean(process.env.FOUNDER_PASSWORD),
        },
      };
      // eslint-disable-next-line no-console
      console.log('[ADMIN LOGIN] Incoming request', redacted);
    } catch (_) {}

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      try { console.warn('[ADMIN LOGIN] No active user found for email:', email); } catch (_) {}
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    try {
      console.log('[ADMIN LOGIN] User record located', {
        email: user.email,
        role: user.role,
        hasPasswordHash: Boolean(user.passwordHash),
        passwordHashLen: user.passwordHash ? user.passwordHash.length : 0,
      });
    } catch (_) {}

    const ok = await user.comparePassword(password);
    if (!ok) {
      try { console.warn('[ADMIN LOGIN] Password mismatch for user:', email); } catch (_) {}
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '✅ Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (e) {
    console.error('LOGIN ERROR:', e);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// Primary login route
router.post('/login', loginHandler);
// Backward-compatible alias (old docs / code referring to /api/admin/auth/login)
router.post('/auth/login', loginHandler);
// Explicit nested path /admin/auth/login (in case client prefixes /admin twice)
router.post('/admin/auth/login', loginHandler);

// (TEMPORARY) one-time founder seeding via API. Remove/disable after use.
// ✅ Allow seeding with request body overrides for email/password
router.post('/seed-founder', async (req, res) => {
  try {
    const bodyEmail = (req.body?.email || '').toString().trim().toLowerCase();
    const bodyPass = (req.body?.password || '').toString();
    const forceReset = Boolean(req.body?.force);
    const email = (bodyEmail || process.env.ADMIN_EMAIL || 'admin@newspulse.ai').toLowerCase();
    const rawPass = bodyPass || process.env.ADMIN_PASS || 'Safe!2025@News';

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }
    if (!rawPass || rawPass.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    let user = await User.findOne({ email });
    if (user) {
      if (forceReset && bodyPass) {
        user.passwordHash = await bcrypt.hash(rawPass, 10);
        user.isActive = true;
        user.role = user.role || 'founder';
        await user.save();
        return res.json({ success: true, message: 'Founder password reset', email: user.email });
      }
      return res.json({ success: true, message: 'Founder already exists' });
    }

    const passwordHash = await bcrypt.hash(rawPass, 10);
    user = await User.create({
      name: 'Founder Admin',
      email,
      passwordHash,
      role: 'founder',
      isActive: true,
    });

    res.json({ success: true, message: 'Founder created', email: user.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Seed failed' });
  }
});

module.exports = router;
