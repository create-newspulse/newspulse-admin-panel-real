import crypto from 'crypto';
import Redis from 'ioredis';

// Simple Redis-or-memory OTP store
let redis: Redis | null = null;
function getRedis() {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  redis = new Redis(url, { lazyConnect: true });
  return redis;
}

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

const mem = new Map<string, { hash: string; exp: number }>();

export function genCode(): string {
  // 6-digit, avoid leading zeros by padding
  const n = crypto.randomInt(0, 1000000);
  return n.toString().padStart(6, '0');
}

export async function setOtp(userId: string, code: string, ttlMs = 5 * 60 * 1000) {
  const key = `mfa:email:${userId}`;
  const hash = sha256(code);
  const r = getRedis();
  if (r) {
    await r.set(key, hash, 'PX', ttlMs);
    return;
  }
  mem.set(key, { hash, exp: Date.now() + ttlMs });
}

export async function verifyAndConsumeOtp(userId: string, code: string): Promise<boolean> {
  const key = `mfa:email:${userId}`;
  const r = getRedis();
  const hash = sha256(code);
  if (r) {
    const stored = await r.get(key);
    if (!stored) return false;
    const ok = stored === hash;
    if (ok) await r.del(key);
    return ok;
  }
  const rec = mem.get(key);
  if (!rec) return false;
  const ok = rec.hash === hash && rec.exp > Date.now();
  if (ok) mem.delete(key);
  return ok;
}
