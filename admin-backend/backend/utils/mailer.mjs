// backend/utils/mailer.mjs
import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  EMAIL_FROM,
} = process.env;

let transporter = null;
let fromAddress = SMTP_FROM || EMAIL_FROM || 'News Pulse <no-reply@newspulse.local>';

// Track whether real SMTP creds are present
const SMTP_CONFIGURED = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

function createTransport() {
  if (transporter) return transporter;
  // If SMTP credentials are missing, use a stub transport that just logs
  if (!SMTP_CONFIGURED) {
    console.warn('⚠️ SMTP not configured. OTP emails will be logged to console. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to enable sending.');
    transporter = {
      sendMail: async (opts) => {
        console.log('✉️ [MAIL:STUB] To:', opts.to, '| Subject:', opts.subject);
        console.log('--- HTML ---\n' + (opts.html || opts.text || '')); 
        return { messageId: 'stub-' + Date.now() };
      }
    };
    return transporter;
  }
  const port = Number(SMTP_PORT || 587);
  // Respect explicit SMTP_SECURE when provided; otherwise default by port
  const rawSecure = (SMTP_SECURE ?? '').toString().trim().toLowerCase();
  let secure;
  if (rawSecure === 'true') secure = true;
  else if (rawSecure === 'false') secure = false;
  else secure = (port === 465);
  // Auto-correct common misconfigurations that cause "wrong version number"
  if (port === 587 && secure === true) {
    console.warn('⚠️ SMTP: secure=true with port 587 detected; forcing secure=false for STARTTLS.');
    secure = false;
  }
  if (port === 465 && secure === false) {
    console.warn('⚠️ SMTP: secure=false with port 465 detected; forcing secure=true for SSL.');
    secure = true;
  }
  if (process.env.NODE_ENV !== 'production') {
    const userMasked = SMTP_USER ? SMTP_USER.replace(/(^.).+(@.*$)/, '$1***$2') : null;
    console.log('📨 SMTP createTransport:', { host: SMTP_HOST, port, secure, user: userMasked, from: fromAddress });
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  const tx = createTransport();
  const info = await tx.sendMail({ from: fromAddress, to, subject, html, text });
  if (process.env.NODE_ENV !== 'production') {
    console.log(`✅ Mail queued -> to:${to} subject:${subject} id:${info?.messageId || 'n/a'}`);
  }
  return info;
}

export async function sendPasswordOtpEmail(email, code) {
  const subject = 'Your NewsPulse OTP';
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;color:#1f2937">
      <h2>Reset your News Pulse password</h2>
      <p>Use the following One-Time Password to reset your account password. This code will expire in 10 minutes.</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:2px;">${code}</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
  const text = `Your NewsPulse OTP code is ${code}. It expires in 10 minutes.`;
  return sendMail({ to: email, subject, html, text });
}

// Public helpers for diagnostics
export function isSmtpConfigured() {
  return SMTP_CONFIGURED;
}

export async function verifySmtp() {
  try {
    const tx = createTransport();
    if (typeof tx.verify === 'function') {
      await tx.verify();
      return { ok: true, message: 'SMTP transport verified and ready.' };
    }
    // Stub transport or transports without verify()
    return { ok: SMTP_CONFIGURED, message: SMTP_CONFIGURED ? 'SMTP configured (verify() not supported)' : 'SMTP not configured (using stub logger)' };
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
}
