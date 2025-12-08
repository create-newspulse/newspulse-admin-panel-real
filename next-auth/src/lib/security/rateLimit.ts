// Simple in-memory rate limiter (replace with Redis production adapter)
const buckets: Record<string, { count: number; ts: number }> = {};
const WINDOW = Number(process.env.RL_WINDOW_MS || 60000);
const MAX = Number(process.env.RL_MAX || 10);

export function rateLimit(key: string) {
  const now = Date.now();
  const b = buckets[key];
  if (!b || now - b.ts > WINDOW) {
    buckets[key] = { count: 1, ts: now };
    return { allowed: true, remaining: MAX - 1 };
  }
  if (b.count >= MAX) {
    return { allowed: false, retryInMs: WINDOW - (now - b.ts) };
  }
  b.count++;
  return { allowed: true, remaining: MAX - b.count };
}
