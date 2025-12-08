// backend/routes/auth/password.mjs
import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../../models/User.mjs';
import { sendPasswordOtpEmail, isSmtpConfigured } from '../../utils/mailer.mjs';

const router = express.Router();

// In-memory OTP store (email -> { code, expiresAt, verified, attempts })
const store = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function now() { return Date.now(); }

function toPublicResponse(success, message) {
  return { success, message };
}

// POST /api/auth/password/otp-request { email }
router.post('/otp-request', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return res.status(400).json(toPublicResponse(false, 'Valid email required'));

    const code = genCode();
    store.set(email, { code, expiresAt: now() + TTL_MS, verified: false, attempts: 0 });

    // Send the OTP via email (falls back to console if SMTP not configured)
    const configured = isSmtpConfigured();
    let mailError = null;
    await sendPasswordOtpEmail(email, code).catch((e) => {
      mailError = e?.message || String(e);
      console.error('MAIL SEND FAILED:', mailError);
      // Only log OTP fallback if SMTP is not configured at all (dev convenience)
      if (!configured) {
        console.log(`📧 [OTP:FALLBACK] ${email}: ${code} (valid 10m)`);
      }
    });

  // Only echo OTP in API response when explicitly enabled AND either SMTP not configured
  // or a fallback is forced. This prevents leaking OTP when real emails are working.
  const devEchoFlag = process.env.OTP_DEV_ECHO === '1';
  const forceFallback = process.env.OTP_DEV_FORCE_FALLBACK === '1';
  const devEcho = devEchoFlag && (!configured || forceFallback || mailError);
    if (configured && mailError) {
      // With SMTP configured, do NOT leak OTP in logs; report failure to caller
      // In development, include a sanitized error field for quicker setup/debugging
      const base = toPublicResponse(false, 'Failed to send OTP email');
      const isDev = process.env.NODE_ENV !== 'production';
      const forceFallback = process.env.OTP_DEV_FORCE_FALLBACK === '1';
      if (isDev && forceFallback) {
        console.warn('⚠️ SMTP configured but send failed; OTP_DEV_FORCE_FALLBACK=1 so returning devCode in response.');
        return res.json({ ...toPublicResponse(true, 'OTP sent to your email (dev-fallback)'), devCode: code, devMailError: mailError, smtpConfigured: true, devFallback: true });
      }
      if (isDev) {
        return res.status(500).json({ ...base, devMailError: mailError, smtpConfigured: true });
      }
      return res.status(500).json(base);
    }
    const payload = toPublicResponse(true, 'OTP sent to your email');
    if (devEcho) {
      return res.json({
        ...payload,
        devCode: code,
        devMailError: configured ? undefined : mailError,
        smtpConfigured: configured,
        devEcho: true
      });
    }
    return res.json({ ...payload, smtpConfigured: configured });
  } catch (e) {
    console.error('OTP-REQUEST ERROR:', e);
    return res.status(500).json(toPublicResponse(false, 'Failed to send OTP'));
  }
});

// POST /api/auth/password/otp-verify { email, otp }
router.post('/otp-verify', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    const rec = store.get(email);
    if (!rec) return res.status(400).json(toPublicResponse(false, 'Request OTP first'));
    if (rec.expiresAt < now()) { store.delete(email); return res.status(400).json(toPublicResponse(false, 'OTP expired')); }
    if (!otp || otp !== rec.code) {
      rec.attempts = (rec.attempts || 0) + 1;
      if (rec.attempts > 5) { store.delete(email); return res.status(429).json(toPublicResponse(false, 'Too many attempts. Please request a new OTP.')); }
      return res.status(400).json(toPublicResponse(false, 'Invalid OTP'));
    }
    rec.verified = true;
    return res.json(toPublicResponse(true, 'OTP verified'));
  } catch (e) {
    console.error('OTP-VERIFY ERROR:', e);
    return res.status(500).json(toPublicResponse(false, 'Failed to verify OTP'));
  }
});

// POST /api/auth/password/reset { email, otp, newPassword }
router.post('/reset', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !email.includes('@')) return res.status(400).json(toPublicResponse(false, 'Valid email required'));
    if (!newPassword || newPassword.length < 8) return res.status(400).json(toPublicResponse(false, 'Password must be at least 8 characters'));

    const rec = store.get(email);
    if (!rec) return res.status(400).json(toPublicResponse(false, 'Request OTP first'));
    if (rec.expiresAt < now()) { store.delete(email); return res.status(400).json(toPublicResponse(false, 'OTP expired')); }
    if (!rec.verified || otp !== rec.code) return res.status(400).json(toPublicResponse(false, 'Invalid verification state'));

    const user = await User.findOne({ email });
    if (!user) { store.delete(email); return res.json(toPublicResponse(true, 'If the account exists, password has been updated')); }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    store.delete(email);

    return res.json(toPublicResponse(true, 'Password updated'));
  } catch (e) {
    console.error('PASSWORD-RESET ERROR:', e);
    return res.status(500).json(toPublicResponse(false, 'Reset failed'));
  }
});

export default router;
