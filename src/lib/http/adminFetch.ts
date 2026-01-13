import { getAuthToken, hasLikelyAdminSession } from '@/lib/api';

function stripTrailingSlashes(s: string): string {
  return (s || '').replace(/\/+$/, '');
}

// Admin API base URL
// Production direct mode (no proxy): set VITE_ADMIN_API_BASE=https://YOUR_BACKEND_DOMAIN
// Dev/proxy mode: leave it empty and the app will call relative /admin-api/* (Vite/Vercel rewrites).
// Repo contract: use an optional origin prefix only; never auto-default to a production URL.
// Requests are made as: fetch(`${BASE}${path}`)
const BASE = stripTrailingSlashes((import.meta.env.VITE_ADMIN_API_BASE || '').toString().trim());
const ADMIN_API_ORIGIN = stripTrailingSlashes(BASE);
const BASE_IS_ABSOLUTE_ORIGIN = /^https?:\/\//i.test(BASE);

// Legacy/back-compat: allow overriding the full base URL/path.
const RAW_ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_URL || '').toString().trim();
export const ADMIN_API_BASE = stripTrailingSlashes(
  RAW_ADMIN_BASE || (ADMIN_API_ORIGIN ? `${ADMIN_API_ORIGIN}/admin-api` : '/admin-api')
);

export class AdminApiError extends Error {
  status: number;
  url: string;
  body?: unknown;
  code?: string;

  constructor(message: string, opts: { status: number; url: string; body?: unknown; code?: string }) {
    super(message);
    this.name = 'AdminApiError';
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
    this.code = opts.code;
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
const NET_BLOCK_MS = 5000;

// UI banner for offline backend (avoid spamming repeated banners)
let lastOfflineBannerAt = 0;
const OFFLINE_BANNER_COOLDOWN_MS = 60_000;

function notifyBackendOfflineOnce() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (lastOfflineBannerAt && (now - lastOfflineBannerAt) < OFFLINE_BANNER_COOLDOWN_MS) return;
  lastOfflineBannerAt = now;
  try {
    window.dispatchEvent(new CustomEvent('np:backend-offline', {
      detail: { message: 'Backend offline. Start backend on http://localhost:5000' },
    }));
  } catch {
    // ignore
  }
}

export async function adminFetch(path: string, init: AdminFetchOptions = {}): Promise<Response> {
  const normalizedPath = adminApiPath(path);
  const url = (/^https?:\/\//i.test(normalizedPath) ? normalizedPath : `${BASE}${normalizedPath}`)
    .replace(/([^:]\/)\/+?/g, '$1');

  // Short-circuit repeated calls while we are actively logging out.
  const now0 = Date.now();
  if (authBlockedUntil > now0) {
    throw new AdminApiError('Not authenticated', { status: 401, url, body: { blocked: true } });
  }
  if (netBlockedUntil > now0) {
    notifyBackendOfflineOnce();
    throw new AdminApiError('Backend offline (start local backend on :5000)', { status: 0, url, body: { blocked: true }, code: 'BACKEND_OFFLINE' });
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
    // Reset banner cooldown once we successfully reach the backend again.
    lastOfflineBannerAt = 0;
  } catch (e: any) {
    netBlockedUntil = Date.now() + NET_BLOCK_MS;
    notifyBackendOfflineOnce();
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
    throw new AdminApiError('Backend offline (start local backend on :5000)', { status: 0, url, body: { cause: e?.message || String(e) }, code: 'BACKEND_OFFLINE' });
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
          p.startsWith('/admin-api/api/admin/') ||
          // Broadcast Center routes are auth-protected (founder)
          p.startsWith('/admin-api/broadcast')
        );
      } catch {
        const s = (url || '').toString();
        return (
          s.includes('/api/auth/me') ||
          s.includes('/api/admin/') ||
          s.includes('/admin/') ||
          s.includes('/admin-api/admin/') ||
          s.includes('/admin-api/api/admin/') ||
          s.includes('/admin-api/broadcast')
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
    const p = adminApiPath(path);
    const errUrl = /^https?:\/\//i.test(p) ? p : `${BASE}${p}`;
    throw new AdminApiError(msg, { status: res.status, url: errUrl, body });
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

function adminApiPath(path: string): string {
  // If caller already provided a fully-qualified same-origin proxy path,
  // respect it as-is so Vite can log/rewrite it.
  // Example: '/admin-api/admin/settings/public'
  const raw = (path ?? '').toString().trim();

  // If caller already provided a proxy-style path, keep it.
  // Production support: when BASE is set, prefix it so requests become `${BASE}${path}`.
  if (
    raw.startsWith('/admin-api/') ||
    raw === '/admin-api' ||
    raw.startsWith('/api/') ||
    raw === '/api'
  ) {
    // Direct mode (BASE is an absolute backend origin): map '/admin-api/*' -> '/api/*'
    // to preserve the same frontend call sites used in proxy mode.
    if (BASE_IS_ABSOLUTE_ORIGIN && (raw === '/admin-api' || raw.startsWith('/admin-api/'))) {
      const mapped = raw
        .replace(/^\/admin-api$/, '/api')
        .replace(/^\/admin-api\//, '/api/')
        .replace(/^\/api\/api\//, '/api/');
      return mapped.replace(/\/\/+/, '/');
    }
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

  // If the configured base already points at an /admin-api style root, keep the same joining
  // semantics as proxy mode (i.e. add '/admin' unless base already ends with '/admin').
  const lowerBase = base.toLowerCase();
  const isAdminApiRoot = /\/admin-api$/.test(lowerBase) || /\/admin-api\/$/.test(lowerBase) || /\/admin-api\/admin$/.test(lowerBase);
  if (isAdminApiRoot) {
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
  return joined.replace(/([^:]\/)\/+?/g, '$1');
}

// Back-compat export: some callers/loggers may import this.
export function adminApiUrl(path: string): string {
  const p = adminApiPath(path);
  const url = /^https?:\/\//i.test(p) ? p : `${BASE}${p}`;
  return url.replace(/([^:]\/)\/+?/g, '$1');
}
