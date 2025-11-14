// backend/routes/admin/auth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'newspulse-secret';

// sanity check in browser: http://localhost:5000/api/admin/auth/ping
router.get('/ping', (_req, res) => res.json({ ok: true, route: 'admin/auth', ts: new Date().toISOString() }));

// ---- DB-backed login ----
// POST /api/admin/auth/login  { email, password }
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

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
});

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

export default router;
