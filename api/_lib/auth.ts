import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

export interface FounderContext {
  userId: string;
  email?: string;
  role: 'founder' | string;
  ip?: string;
}

// Authority Lock feature flag (ephemeral in serverless). TODO: persist in DB/kv.
let AUTHORITY_LOCKED = false;
export function setAuthorityLock(v: boolean) { AUTHORITY_LOCKED = v; }
export function isAuthorityLocked() { return AUTHORITY_LOCKED; }

// Minimal cookie parser
function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    cookies[k] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

export async function requireFounder(req: VercelRequest, res: VercelResponse): Promise<FounderContext | null> {
  // Lightweight mock mode for local dev without full auth wired
  const mockOn = String(process.env.VITE_USE_MOCK || process.env.USE_MOCK || '').toLowerCase() === 'true';
  const roleHeader = (req.headers['x-role'] as string) || '';
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined;

  const logAttempt = (reason: string, extra?: Record<string, any>) => {
    const entry = { ts: new Date().toISOString(), ip, reason, path: req.url, agent: req.headers['user-agent'], ...extra };
    console.warn('[FOUNDER_ACCESS_ATTEMPT]', JSON.stringify(entry));
  };

  try {
    if (mockOn && (roleHeader === 'founder' || !roleHeader)) {
      return { userId: 'founder-dev', email: process.env.FOUNDER_EMAIL || 'founder@example.com', role: 'founder', ip };
    }

    // Real session check via np_admin cookie (admin JWT)
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['np_admin'];
    if (!token) {
      logAttempt('NO_TOKEN');
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return null;
    }
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret');
    const { payload } = await jwtVerify(token, secret, { audience: 'admin', issuer: 'newspulse' });

    // Optional role header override for founder
    const role = (req.headers['x-role'] as string) || 'founder';
    if (role !== 'founder') {
      logAttempt('ROLE_FORBIDDEN', { user: String(payload?.email || 'unknown'), role });
      res.status(403).json({ ok: false, error: 'Founder role required' });
      return null;
    }
    return { userId: String(payload.email || 'founder'), email: String(payload.email || ''), role: 'founder', ip };
  } catch (err) {
    logAttempt('INVALID_SESSION');
    res.status(401).json({ ok: false, error: 'Invalid or expired session' });
    return null;
  }
}

export function logFounderAction(ctx: FounderContext, action: string, payload?: any) {
  // In real backend, write to founder_audit collection. Here we just print.
  const entry = {
    actor: ctx.email || ctx.userId,
    action,
    ip: ctx.ip,
    ts: new Date().toISOString(),
    payloadHash: payload ? String(require('crypto').createHash('sha256').update(JSON.stringify(payload)).digest('hex')) : undefined,
  };
  console.log('[FOUNDER_AUDIT]', JSON.stringify(entry));
}
