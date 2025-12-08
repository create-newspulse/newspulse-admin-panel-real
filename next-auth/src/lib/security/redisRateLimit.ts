import Redis from 'ioredis';

let redis: Redis | null = null;
function getRedis() {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  redis = new Redis(url, { lazyConnect: true });
  return redis;
}

interface LimitResult { allowed: boolean; remaining?: number; retryInMs?: number }

export async function redisRateLimit(key: string): Promise<LimitResult> {
  const winMs = Number(process.env.RL_WINDOW_MS || 60000);
  const max = Number(process.env.RL_MAX || 10);
  const r = getRedis();
  if (!r) {
    // Fall back to simple in-memory bucket if Redis not configured
    const { rateLimit } = await import('./rateLimit');
    return rateLimit(key);
  }
  const now = Date.now();
  const windowKey = `rl:${key}:${Math.floor(now / winMs)}`;
  const count = await r.incr(windowKey);
  if (count === 1) await r.pexpire(windowKey, winMs);
  if (count > max) {
    const ttl = await r.pttl(windowKey);
    return { allowed: false, retryInMs: ttl };
  }
  return { allowed: true, remaining: max - count };
}