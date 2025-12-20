export class ApiError extends Error {
  status: number;
  url: string;
  body?: unknown;

  constructor(message: string, opts: { status: number; url: string; body?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
  }
}

const BACKEND_ORIGIN = (
  // Single canonical config (requested): VITE_BACKEND_URL (no /api suffix)
  import.meta.env.VITE_BACKEND_URL ||
  // Back-compat
  import.meta.env.VITE_BACKEND_ORIGIN ||
  ''
)
  .toString()
  .replace(/\/+$/, '');

import { getAuthToken } from '@/lib/adminApi';

type StoredUnlockToken = { token: string; expiresAt: number };

const OWNER_UNLOCK_TOKEN_STORAGE_KEY = 'NP_OWNER_UNLOCK_V1';

let ownerUnlockTokenMemory: StoredUnlockToken | null = null;

function readStoredUnlockToken(): StoredUnlockToken | null {
  try {
    const raw = sessionStorage.getItem(OWNER_UNLOCK_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUnlockToken>;
    if (!parsed || typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() >= parsed.expiresAt) return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function getOwnerUnlockToken(): string | null {
  const now = Date.now();
  if (ownerUnlockTokenMemory && ownerUnlockTokenMemory.expiresAt > now) return ownerUnlockTokenMemory.token;
  const stored = readStoredUnlockToken();
  if (stored) {
    ownerUnlockTokenMemory = stored;
    return stored.token;
  }
  ownerUnlockTokenMemory = null;
  return null;
}

export function setOwnerUnlockToken(token: string, ttlMs: number) {
  const expiresAt = Date.now() + Math.max(1000, ttlMs);
  ownerUnlockTokenMemory = { token, expiresAt };
  try {
    sessionStorage.setItem(OWNER_UNLOCK_TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt } satisfies StoredUnlockToken));
  } catch {
    // ignore
  }
}

export function clearOwnerUnlockToken() {
  ownerUnlockTokenMemory = null;
  try {
    sessionStorage.removeItem(OWNER_UNLOCK_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function joinUrl(origin: string, path: string) {
  const o = origin.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${o}${p}`;
}

function normalizeApiPath(input: string) {
  let p = input.startsWith('/') ? input : `/${input}`;
  // Collapse known double-prefix mistakes.
  p = p.replace(/^\/api\/api\//, '/api/');
  p = p.replace(/^\/api\/admin\/api\//, '/api/admin/');
  if (p === '/api' || p.startsWith('/api/')) return p;
  return `/api${p.replace(/^\/+/, '/')}`;
}

export function apiUrl(path: string): string {
  if (!BACKEND_ORIGIN) {
    throw new Error('VITE_BACKEND_URL is not set. Set it to your backend origin (no /api suffix).');
  }
  const apiPath = normalizeApiPath(path);
  return joinUrl(BACKEND_ORIGIN, apiPath);
}

async function readErrorBody(res: Response) {
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
  try {
    const t = await res.text();
    return t || undefined;
  } catch {
    return undefined;
  }
}

function toErrorMessage(body: unknown, fallback: string) {
  if (!body) return fallback;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const anyBody: any = body as any;
    const msg = anyBody?.message || anyBody?.error || anyBody?.details;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export type ApiOptions = RequestInit & {
  json?: unknown;
  ownerUnlockToken?: string | null;
};

export async function api<T = any>(path: string, init: ApiOptions = {}): Promise<T> {
  if (!BACKEND_ORIGIN) {
    throw new Error('VITE_BACKEND_URL is not set. Set it to your backend origin (no /api suffix).');
  }

  const url = apiUrl(path);

  const headers = new Headers(init.headers || undefined);
  headers.set('Accept', 'application/json');

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const ownerUnlock = typeof init.ownerUnlockToken === 'string' ? init.ownerUnlockToken : null;
  if (ownerUnlock) headers.set('x-owner-unlock', ownerUnlock);

  let body = init.body;
  if (typeof init.json !== 'undefined') {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body,
    credentials: init.credentials ?? 'include',
  });

  if (!res.ok) {
    const errBody = await readErrorBody(res);
    const msg = toErrorMessage(errBody, `HTTP ${res.status} ${res.statusText}`);
    throw new ApiError(msg, { status: res.status, url, body: errBody });
  }

  if (res.status === 204) return {} as any;

  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    // Keep behavior predictable for callers expecting JSON
    const text = await res.text().catch(() => '');
    return (text as any) as T;
  }
  return (await res.json()) as T;
}
