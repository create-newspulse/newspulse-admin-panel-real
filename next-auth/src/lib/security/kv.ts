import Redis from 'ioredis';

type Stored = { value: any; expiresAt: number };
const mem = new Map<string, Stored>();
let redis: Redis | null = null;

function getRedis() {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  redis = new Redis(url, { lazyConnect: true });
  return redis;
}

export async function kvSet(key: string, value: any, ttlMs: number) {
  const r = getRedis();
  if (r) {
    await r.set(key, JSON.stringify(value), 'PX', ttlMs);
    return;
  }
  mem.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function kvGet<T=any>(key: string): Promise<T | null> {
  const r = getRedis();
  if (r) {
    const v = await r.get(key);
    return v ? JSON.parse(v) as T : null;
  }
  const s = mem.get(key);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { mem.delete(key); return null; }
  return s.value as T;
}

export async function kvDel(key: string) {
  const r = getRedis();
  if (r) await r.del(key);
  mem.delete(key);
}