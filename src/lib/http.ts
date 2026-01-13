import { apiUrl as buildApiUrl } from '@/lib/apiBase';
import { toast } from 'react-hot-toast';

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
  // Callers should pass paths like '/articles' not '/api/articles'.
  // Tolerate legacy call sites by stripping a single leading '/api'.
  if (p === '/api') return '/';
  if (p.startsWith('/api/')) p = p.replace(/^\/api\//, '/');
  // Collapse known double-prefix mistakes.
  p = p.replace(/^\/api\/api\//, '/');
  p = p.replace(/^\/api\/admin\/api\//, '/admin/');
  return p;
}

function shouldLogoutOn401(path: string) {
  const cleaned = normalizeApiPath(path);
  const full = cleaned.startsWith('/api/') ? cleaned : `/api${cleaned}`;
  return full === '/api/auth/me' || full.startsWith('/api/admin/');
}

export function apiUrl(path: string): string {
  // apiBase.apiUrl already prepends API_BASE (which ends with '/api')
  // so this must be a path WITHOUT '/api'.
  const cleaned = normalizeApiPath(path);
  return buildApiUrl(cleaned);
}

// Throttle backend-missing toasts (by path) to avoid UI spam.
const routeMissingToastAt: Record<string, number> = {};
const ROUTE_MISSING_TOAST_TTL_MS = 10_000;

// Backend-offline cooldown to avoid rapid retry storms when the dev backend/proxy is down.
let netBlockedUntil = 0;
const NET_BLOCK_MS = 5000;

function maybeToastBackendRouteMissing(path: string, message: string) {
  try {
    if (!/route not found/i.test(message || '')) return;
    const normalized = normalizeApiPath(path);
    const now = Date.now();
    const last = routeMissingToastAt[normalized] || 0;
    if (now - last < ROUTE_MISSING_TOAST_TTL_MS) return;
    routeMissingToastAt[normalized] = now;
    toast.error(`Backend route missing: ${normalized}`);
  } catch {
    // ignore
  }
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

  const now0 = Date.now();
  if (netBlockedUntil > now0) {
    throw new ApiError('Backend offline', { status: 0, url, body: { blocked: true } });
  }

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

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      body,
      credentials: init.credentials ?? 'include',
    });
  } catch (e: any) {
    netBlockedUntil = Date.now() + NET_BLOCK_MS;
    throw new ApiError('Backend offline', { status: 0, url, body: { cause: e?.message || String(e) } });
  }

  // Treat gateway/service failures as backend offline (common when proxy target is down).
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    netBlockedUntil = Date.now() + NET_BLOCK_MS;
  }

  // Required global behaviors
  try {
    if (res.status === 401 && typeof window !== 'undefined' && shouldLogoutOn401(path)) {
      try {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('newsPulseAdminAuth');
        // legacy cleanup
        localStorage.removeItem('adminToken');
        localStorage.removeItem('np_admin_token');
        localStorage.removeItem('np_admin_access_token');
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
    const msg = toErrorMessage(errBody, `HTTP ${res.status} ${res.statusText}`);
    if (res.status === 404) {
      // If backend returns its standard 404 "Route not found" message, surface a clean toast.
      maybeToastBackendRouteMissing(path, msg);
      if (import.meta.env.DEV && /route not found/i.test(msg || '')) {
        try {
          console.error('[api] Backend route missing', {
            path: normalizeApiPath(path),
            url,
            status: res.status,
          });
        } catch {
          // ignore
        }
      }
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
