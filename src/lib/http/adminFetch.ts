import { getAuthToken, hasLikelyAdminSession } from '@/lib/api';

function stripTrailingSlashes(s: string): string {
  return (s || '').replace(/\/+$/, '');
}

// Admin API base URL
// Single source of truth: VITE_ADMIN_API_URL
// Default: use same-origin proxy to avoid CORS.
const RAW_ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_URL || '').toString().trim();
export const ADMIN_API_BASE = stripTrailingSlashes(RAW_ADMIN_BASE || '/admin-api');

export class AdminApiError extends Error {
  status: number;
  url: string;
  body?: unknown;

  constructor(message: string, opts: { status: number; url: string; body?: unknown }) {
    super(message);
    this.name = 'AdminApiError';
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
  }
}

function normalizePath(input: string): string {
  const raw = (input ?? '').toString().trim();
  let p = raw.startsWith('/') ? raw : `/${raw}`;
  // Allow callers to accidentally pass '/api/...'
  if (p === '/api') return '/';
  if (p.startsWith('/api/')) p = p.replace(/^\/api\//, '/');
  // Collapse double-prefix mistakes.
  p = p.replace(/^\/api\/api\//, '/');
  return p;
}

async function readBody(res: Response): Promise<unknown> {
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
  try {
    const text = await res.text();
    return text || undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const anyBody: any = body as any;
    const msg = anyBody?.message || anyBody?.error || anyBody?.details;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export type AdminFetchOptions = RequestInit & {
  json?: unknown;
};

// Throttle 401 warnings to avoid log spam
let last401Warn = 0;
const WARN_THROTTLE_MS = 3000;

// If we hit a 401, avoid hammering the backend during redirects/rerenders.
let authBlockedUntil = 0;
const AUTH_BLOCK_MS = 5000;

// If the network/dev server is down (ERR_CONNECTION_REFUSED), avoid rapid retry loops.
let netBlockedUntil = 0;
const NET_BLOCK_MS = 2000;

export async function adminFetch(path: string, init: AdminFetchOptions = {}): Promise<Response> {
  const url = adminApiUrl(path);

  // Short-circuit repeated calls while we are actively logging out.
  const now0 = Date.now();
  if (authBlockedUntil > now0) {
    throw new AdminApiError('Not authenticated', { status: 401, url, body: { blocked: true } });
  }
  if (netBlockedUntil > now0) {
    throw new AdminApiError('Network unavailable', { status: 0, url, body: { blocked: true } });
  }

  const headers = new Headers(init.headers || undefined);
  headers.set('Accept', 'application/json');

  const token = getAuthToken();
  if (import.meta.env.DEV) {
    console.log('[adminFetch]', {
      path,
      url,
      hasToken: !!token,
      hasAuthHeader: headers.has('Authorization'),
    });
  }

  // If we're calling an admin-protected route and we have no bearer token,
  // fail fast to avoid repeatedly hammering the backend with 401s.
  // (Cookie-only auth is not relied on in this admin panel build.)
  // Note: adminFetch always targets the backend's `/admin/*` routes.
  if (!token && !hasLikelyAdminSession()) {
    authBlockedUntil = Date.now() + AUTH_BLOCK_MS;
    throw new AdminApiError('Not authenticated', { status: 401, url, body: { missingToken: true } });
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (!token && import.meta.env.DEV) {
    const now = Date.now();
    if (now - last401Warn > WARN_THROTTLE_MS) {
      last401Warn = now;
      console.warn('[adminFetch] Missing token for', path);
    }
  }

  let body = init.body;
  if (typeof init.json !== 'undefined') {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }

  const isAbsoluteUrl = /^https?:\/\//i.test(url);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      body,
      // In proxy/same-origin mode, include cookies (np_admin) so cookie-based auth works.
      // In cross-origin direct mode, omit cookies when using Bearer tokens to reduce CORS friction.
      credentials: init.credentials ?? (isAbsoluteUrl ? (token ? 'omit' : 'include') : 'include'),
    });
  } catch (e: any) {
    netBlockedUntil = Date.now() + NET_BLOCK_MS;
    if (import.meta.env.DEV) {
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : '(no-window)';
        console.warn('[adminFetch] Network error', {
          path,
          url,
          origin,
          message: e?.message,
        });
      } catch {}
    }
    throw new AdminApiError(e?.message || 'Network error', { status: 0, url, body: { cause: e?.message || String(e) } });
  }

  // Align with existing global behaviors
  try {
    const shouldLogout = (() => {
      try {
        const p = typeof window !== 'undefined' ? new URL(url, window.location.origin).pathname : url;
        return (
          p === '/api/auth/me' ||
          p.startsWith('/api/admin/') ||
          p.startsWith('/admin/') ||
          // proxy-mode paths
          p.startsWith('/admin-api/admin/') ||
          p.startsWith('/admin-api/api/admin/')
        );
      } catch {
        const s = (url || '').toString();
        return (
          s.includes('/api/auth/me') ||
          s.includes('/api/admin/') ||
          s.includes('/admin/') ||
          s.includes('/admin-api/admin/') ||
          s.includes('/admin-api/api/admin/')
        );
      }
    })();

    if (res.status === 401 && import.meta.env.DEV) {
      try {
        const ctype = res.headers.get('content-type') || '';
        const bodyPreview = ctype.includes('application/json')
          ? await res.clone().json().catch(() => null)
          : await res.clone().text().catch(() => '');
        console.warn('[adminFetch] 401 Unauthorized', { path, url, shouldLogout, body: bodyPreview });
      } catch {}
    }

    if (res.status === 401 && typeof window !== 'undefined' && shouldLogout) {
      authBlockedUntil = Date.now() + AUTH_BLOCK_MS;
      try {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('newsPulseAdminAuth');
        // legacy cleanup
        localStorage.removeItem('adminToken');
        localStorage.removeItem('np_admin_token');
        localStorage.removeItem('np_admin_access_token');
        localStorage.removeItem('np_token');
      } catch {}
      window.dispatchEvent(new CustomEvent('np:logout'));
    }
    if (res.status === 404 && import.meta.env.DEV) {
      try {
        console.warn('[adminFetch] 404 Not Found', { path, url });
      } catch {}
    }
    if (res.status === 403 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:ownerkey-required'));
    }
    if ((res.status === 503 || res.status === 423) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:lockdown'));
    }
  } catch {}

  return res;
}

export async function adminJson<T = any>(path: string, init: AdminFetchOptions = {}): Promise<T> {
  const res = await adminFetch(path, init);
  if (res.status === 204) return {} as any;

  if (!res.ok) {
    const body = await readBody(res);
    const msg = errorMessage(body, `HTTP ${res.status} ${res.statusText}`);
    throw new AdminApiError(msg, { status: res.status, url: adminApiUrl(path), body });
  }

  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    // Keep behavior predictable for callers expecting JSON
    const text = await res.text().catch(() => '');
    return (text as any) as T;
  }
  return (await res.json()) as T;
}

function normalizeAdminRest(path: string): string {
  // Start with the generic normalizer (removes leading '/api/*' mistakes).
  let rest = normalizePath(path);

  // Accept callers passing '/admin/*' or '/api/admin/*'.
  if (rest === '/api/admin') rest = '/';
  if (rest.startsWith('/api/admin/')) rest = rest.replace(/^\/api\/admin\//, '/');
  if (rest === '/admin') rest = '/';
  if (rest.startsWith('/admin/')) rest = rest.replace(/^\/admin\//, '/');

  // Ensure leading slash for joins.
  if (!rest.startsWith('/')) rest = `/${rest}`;
  return rest;
}

export function adminApiUrl(path: string): string {
  // If caller already provided a fully-qualified same-origin proxy path,
  // respect it as-is so Vite can log/rewrite it.
  // Example: '/admin-api/admin/settings/public'
  const raw = (path ?? '').toString().trim();
  if (raw.startsWith('/admin-api/') || raw === '/admin-api') {
    return raw.replace(/\/\/+/, '/');
  }
  // If caller provided an absolute URL, do not rewrite it.
  if (/^https?:\/\//i.test(raw)) return raw;

  const rest = normalizeAdminRest(path);
  const base = stripTrailingSlashes(ADMIN_API_BASE);

  // Proxy/same-origin mode: allow a relative base like '/admin-api'
  // In this mode the browser calls:
  //   /admin-api/admin/*
  // and Vite/Vercel rewrites forward it to backend /api/admin/*.
  if (base.startsWith('/')) {
    const lowerBase = base.toLowerCase();
    const hasAdminSuffix = /\/admin$/.test(lowerBase);
    const prefix = hasAdminSuffix ? '' : '/admin';
    const joined = `${base}${prefix}${rest}`;
    return joined.replace(/([^:]\/)\/+?/g, '$1');
  }

  // Support a few common backend layouts, without introducing extra env vars:
  // - BASE = http://host:port            -> http://host:port/api/admin/*
  // - BASE = http://host:port/api        -> http://host:port/api/admin/*
  // - BASE = http://host:port/api/admin  -> http://host:port/api/admin/*
  // - BASE = http://host:port/admin      -> http://host:port/admin/*
  const lower = base.toLowerCase();
  const hasApiAdmin = /\/api\/admin$/.test(lower);
  const hasApi = /\/api$/.test(lower);
  const hasAdmin = /\/admin$/.test(lower);

  const prefix = hasApiAdmin ? '' : (hasAdmin ? '' : (hasApi ? '/admin' : '/api/admin'));
  const joined = `${base}${prefix}${rest}`;
  // Avoid accidental double slashes in the middle.
  return joined.replace(/([^:]\/)\/+/g, '$1');
}
