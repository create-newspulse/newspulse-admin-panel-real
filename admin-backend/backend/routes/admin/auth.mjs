// backend/routes/admin/auth.mjs
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/User.mjs';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'newspulse-secret';

// sanity check in browser: http://localhost:5000/api/admin/auth/ping
router.get('/ping', (_req, res) => res.json({ ok: true, route: 'admin/auth', ts: new Date().toISOString() }));

// ---- Auth guard (JWT in Authorization: Bearer <token>) ----
function authGuard(req, res, next) {
  try {
    const header = String(req.headers?.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}

// ---- DB-backed login ----
// POST /api/admin/auth/login  { email, password }
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    let user = await User.findOne({ email, isActive: true });

    // 🧪 Dev convenience: If no users exist, auto-create the founder with submitted creds
    // Guarded by either: zero users in DB OR explicit env flag DEV_AUTO_CREATE_FOUNDER=1
    if (!user) {
      const total = await User.countDocuments();
      const allowAuto = total === 0 || process.env.DEV_AUTO_CREATE_FOUNDER === '1';
      const strongEnough = password.length >= 8 && email.includes('@');
      if (allowAuto && strongEnough) {
        const passwordHash = await bcrypt.hash(password, 10);
        user = await User.create({
          name: 'Founder Admin',
          email,
          passwordHash,
          role: 'founder',
          isActive: true,
        });
        console.log('👑 Auto-created founder user via first login:', email);
      }
    }

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

// ---- Change password (requires JWT + current password) ----
// POST /api/admin/auth/change-password { currentPassword, newPassword }
router.post('/change-password', authGuard, async (req, res) => {
  try {
    const userId = req.auth?.id;
    const { currentPassword = '', newPassword = '' } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    console.error('CHANGE PASSWORD ERROR:', e);
    return res.status(500).json({ success: false, message: 'Change password failed' });
  }
});

// (TEMPORARY) one-time founder seeding via API. Remove/disable after use.
// ✅ Fix: allow seeding with request body overrides for email/password
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

// 🔎 Local-only: quick user existence check (disabled in production)
router.get('/debug-user', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const email = String(req.query?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const user = await User.findOne({ email }).lean();
    if (!user) return res.json({ success: true, exists: false });
    return res.json({ success: true, exists: true, user: { email: user.email, role: user.role, isActive: !!user.isActive, id: user._id } });
  } catch (e) {
    console.error('DEBUG-USER ERROR:', e);
    return res.status(500).json({ success: false, message: 'Debug failed' });
  }
});

// 🧪 Dev-helper: seed via GET query to avoid shell quoting issues
// GET /api/admin/auth/dev-seed?email=you@example.com&password=StrongPass!2025&force=1
router.get('/dev-seed', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const email = String(req.query?.email || '').trim().toLowerCase();
    const rawPass = String(req.query?.password || '');
    const force = ['1', 'true', 'yes'].includes(String(req.query?.force || '').toLowerCase());

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }
    if (!rawPass || rawPass.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    let user = await User.findOne({ email });
    if (user) {
      if (force) {
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

    return res.json({ success: true, message: 'Founder created', email: user.email });
  } catch (e) {
    console.error('DEV-SEED ERROR:', e);
    return res.status(500).json({ success: false, message: 'Dev seed failed' });
  }
});

export default router;