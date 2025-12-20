import { apiUrl as buildApiUrl } from '@/lib/apiBase';

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

function normalizeApiPath(input: string) {
  let p = input.startsWith('/') ? input : `/${input}`;
  // Collapse known double-prefix mistakes.
  p = p.replace(/^\/api\/api\//, '/api/');
  p = p.replace(/^\/api\/admin\/api\//, '/api/admin/');
  if (p === '/api' || p.startsWith('/api/')) return p;
  return `/api${p.replace(/^\/+/, '/')}`;
}

export function apiUrl(path: string): string {
  const apiPath = normalizeApiPath(path);
  return buildApiUrl(apiPath);
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

  // Required global behaviors
  try {
    if (res.status === 401 && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('np_admin_token');
        localStorage.removeItem('np_admin_access_token');
        localStorage.removeItem('newsPulseAdminAuth');
      } catch {}
      window.dispatchEvent(new CustomEvent('np:logout'));
    }
    if (res.status === 403 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:ownerkey-required'));
    }
    if ((res.status === 503 || res.status === 423) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:lockdown'));
    }
  } catch {}

  if (!res.ok) {
    const errBody = await readErrorBody(res);
    let msg = toErrorMessage(errBody, `HTTP ${res.status} ${res.statusText}`);
    // Dev-only: replace noisy "Route not found" with an actionable backend-missing hint.
    if (import.meta.env.DEV && res.status === 404) {
      msg = `Backend API missing: ${normalizeApiPath(path)}`;
    }
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
