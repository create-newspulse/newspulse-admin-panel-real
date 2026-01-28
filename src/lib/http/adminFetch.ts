import { getAuthToken, hasLikelyAdminSession } from '@/lib/api';

function stripTrailingSlashes(s: string): string {
  return (s || '').replace(/\/+$/, '');
}

function isLocalHostname(hostname: string): boolean {
  const h = (hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function isLocalUiHost(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return isLocalHostname(window.location.hostname);
  } catch {
    return false;
  }
}

function isLocalOrigin(input: string): boolean {
  try {
    if (!/^https?:\/\//i.test(input || '')) return false;
    const u = new URL(input);
    return isLocalHostname(u.hostname);
  } catch {
    return false;
  }
}

// Admin API contract:
// - Browser MUST call same-origin '/admin-api/*'
// - Vite/Vercel rewrites proxy '/admin-api/*' to the backend
// This avoids cross-origin CORS/preflight issues in production.
const BASE = '';
const BASE_IS_ABSOLUTE_ORIGIN = false;

function normalizeAdminApiBase(input: string): string {
  const s = stripTrailingSlashes((input || '').toString().trim());
  if (!s) return '/admin-api';
  // Enforce proxy-only semantics; ignore absolute origins.
  if (/^https?:\/\//i.test(s)) return '/admin-api';
  // Otherwise treat it as a root-relative path.
  return s.startsWith('/') ? s : `/${s}`;
}

// Legacy/back-compat: allow overriding the base PATH only.
const RAW_ADMIN_BASE = (
  import.meta.env.VITE_ADMIN_API_URL ||
  import.meta.env.VITE_ADMIN_API_BASE ||
  import.meta.env.VITE_ADMIN_API_PROXY_BASE ||
  ''
).toString().trim();

export const ADMIN_API_BASE = normalizeAdminApiBase(RAW_ADMIN_BASE || '/admin-api');

const HTML_MISROUTE_TOAST = 'Admin API rewrite missing. Configure Vercel /admin-api rewrite to backend.';

function stripTrailingSlashOnce(s: string): string {
  return (s || '').replace(/\/+$/, '');
}

function resolveDevBackendOrigin(): string {
  try {
    const raw = (import.meta as any)?.env?.VITE_BACKEND_ORIGIN;
    const s = stripTrailingSlashOnce(String(raw || '').trim());
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) return '';
    // Validate
    // eslint-disable-next-line no-new
    new URL(s);
    return s;
  } catch {
    return '';
  }
}

let didLogApiBase = false;
function logApiBaseOnce(msg: any) {
  if (!import.meta.env.DEV) return;
  try {
    const w: any = typeof window !== 'undefined' ? (window as any) : null;
    if (w && w.__npApiBaseLogged) return;
    if (w) w.__npApiBaseLogged = true;
  } catch {
    // ignore
  }
  if (didLogApiBase) return;
  didLogApiBase = true;
  try {
    // eslint-disable-next-line no-console
    console.log('[api] base =', msg);
  } catch {
    // ignore
  }
}

function looksLikeSpaHtml(body: string): boolean {
  const t = (body || '').toLowerCase();
  if (!t) return false;
  if (t.includes('enable javascript to run this app')) return true;
  return t.startsWith('<!doctype html') || t.startsWith('<html') || t.includes('<head') || t.includes('<body');
}

function containsSpaHtmlMisrouteMarker(body: string): boolean {
  const t = (body || '').toLowerCase();
  return !!t && t.includes('enable javascript to run this app');
}

// Throttle rewrite-misroute warnings to avoid toast spam when multiple requests
// fail in quick succession (e.g., page boot loads).
let lastMisrouteWarnAt = 0;
const MISROUTE_WARN_COOLDOWN_MS = 30_000;

let lastMisrouteHealthOkAt = 0;
const MISROUTE_HEALTH_OK_COOLDOWN_MS = 30_000;

async function probeAdminProxyHealth(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const now = Date.now();
  if (lastMisrouteHealthOkAt && (now - lastMisrouteHealthOkAt) < MISROUTE_HEALTH_OK_COOLDOWN_MS) return true;

  try {
    const probe = async (url: string): Promise<{ ok: boolean; status: number }> => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 2500);
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: ac.signal,
      });
      clearTimeout(t);

      // Auth-gated endpoints still imply the proxy is reachable.
      if (res.status === 401 || res.status === 403) return { ok: true, status: res.status };

      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      // Avoid false positives: if we got HTML, it's likely SPA fallback (proxy misroute).
      if (res.status === 200 && ctype.includes('text/html')) return { ok: false, status: 502 };

      return { ok: !!res.ok, status: res.status };
    };

    const health = await probe('/admin-api/system/health');
    if (health.ok) {
      lastMisrouteHealthOkAt = now;
      return true;
    }

    // Some deployments may not expose /system/health yet; avoid false proxy-missing toasts
    // if a known admin endpoint is still reachable.
    if (health.status === 404) {
      const fallback = await probe('/admin-api/admin/broadcast');
      if (fallback.ok) {
        lastMisrouteHealthOkAt = now;
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function maybeNotifyProxyMissingOnce() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (lastMisrouteWarnAt && (now - lastMisrouteWarnAt) < MISROUTE_WARN_COOLDOWN_MS) return;
  lastMisrouteWarnAt = now;

  // Only surface this toast when a real proxy health probe fails.
  // This prevents false positives when an endpoint legitimately responds with HTML.
  void (async () => {
    const ok = await probeAdminProxyHealth();
    if (ok) return;
    try {
      window.dispatchEvent(new CustomEvent('np:admin-proxy-missing', {
        detail: { message: HTML_MISROUTE_TOAST },
      }));
    } catch {
      // ignore
    }
  })();
}

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
    const devMsg = import.meta.env.DEV ? 'Backend offline. Start backend on http://localhost:5000' : 'API unreachable.';
    window.dispatchEvent(new CustomEvent('np:backend-offline', {
      detail: {
        message: devMsg,
      },
    }));
  } catch {
    // ignore
  }
}

export async function adminFetch(path: string, init: AdminFetchOptions = {}): Promise<Response> {
  const normalizedPath = adminApiPath(path);

  // DEV-only: allow bypassing the Vite proxy by hitting the backend origin directly.
  // This preserves the production contract (browser calls /admin-api/*), but lets local
  // developers point to a backend running elsewhere.
  const devBackendOrigin = import.meta.env.DEV ? resolveDevBackendOrigin() : '';

  const isPublicProxyEndpoint = (() => {
    try {
      const p = (normalizedPath || '').toString().toLowerCase();
      return p === '/admin-api/public' || p.startsWith('/admin-api/public/');
    } catch {
      return false;
    }
  })();

  // In production, always treat '/admin-api/*' as a SAME-ORIGIN proxy call.
  // This prevents accidental cross-origin calls (e.g., to Render) when an env var sets
  // an absolute backend base and the browser blocks POST/PUT/DELETE preflights.
  const proxyMode = true;
  const forceSameOriginProxy = typeof normalizedPath === 'string' && (
    normalizedPath === '/admin-api' || normalizedPath.startsWith('/admin-api/')
  );

  const url = (() => {
    if (/^https?:\/\//i.test(normalizedPath)) {
      logApiBaseOnce({ mode: 'absolute', base: '(caller supplied absolute URL)' });
      return normalizedPath;
    }

    // If dev backend origin is set and we're targeting the proxy prefix, map:
    //   /admin-api/<path>  ->  <origin>/api/<path>
    // This mirrors the Vite/Vercel rewrite behavior.
    if (devBackendOrigin && (normalizedPath === '/admin-api' || normalizedPath.startsWith('/admin-api/'))) {
      const mapped = normalizedPath.replace(/^\/admin-api/, '/api').replace(/^\/api\/api\//, '/api/');
      logApiBaseOnce({ mode: 'dev-direct', base: devBackendOrigin, mappedPrefix: '/api' });
      return `${devBackendOrigin}${mapped}`;
    }

    // Default: same-origin proxy path.
    if (forceSameOriginProxy) {
      logApiBaseOnce({ mode: 'proxy', base: '/admin-api' });
      return normalizedPath;
    }

    logApiBaseOnce({ mode: 'internal', base: BASE || '(empty)' });
    return `${BASE}${normalizedPath}`;
  })().replace(/([^:]\/)\/+?/g, '$1');

  // Short-circuit repeated calls while we are actively logging out.
  const now0 = Date.now();
  if (authBlockedUntil > now0) {
    throw new AdminApiError('Not authenticated', { status: 401, url, body: { blocked: true } });
  }
  if (netBlockedUntil > now0) {
    notifyBackendOfflineOnce();
    throw new AdminApiError(
      import.meta.env.DEV ? 'Backend offline (start local backend on :5000)' : 'API error (network)',
      { status: 0, url, body: { blocked: true }, code: 'BACKEND_OFFLINE' }
    );
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
  if (!isPublicProxyEndpoint && !token && !hasLikelyAdminSession()) {
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
    // Helpful debug in production: shows what URL/method fetch attempted.
    // This is especially useful when CORS/preflight blocks cross-origin writes.
    try {
      const method = (init?.method || 'GET').toString().toUpperCase();
      console.error('[adminFetch] fetch failed', {
        method,
        path,
        normalizedPath,
        url,
        base: BASE,
        baseIsAbsolute: BASE_IS_ABSOLUTE_ORIGIN,
        forceSameOriginProxy,
        message: e?.message,
      });
    } catch {}

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
    throw new AdminApiError(
      import.meta.env.DEV ? 'Backend offline (start local backend on :5000)' : 'API error (network)',
      { status: 0, url, body: { cause: e?.message || String(e) }, code: 'BACKEND_OFFLINE' }
    );
  }

  // DEV-only: If /admin-api rewrites are missing/misconfigured, Vite may return the SPA HTML.
  // Convert that into a proper (synthetic) 502 so callers can treat it like an API failure.
  try {
    const isAdminApiCall = typeof normalizedPath === 'string' && (
      normalizedPath === '/admin-api' || normalizedPath.startsWith('/admin-api/')
    );

    // Production-safe rule: only treat it as a rewrite-missing SPA fallback when the response is 200
    // AND includes the well-known CRA/Vite SPA marker string. This avoids misclassifying legit HTML.
    if (isAdminApiCall) {
      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      // Only treat this as a rewrite-missing SPA fallback when the request *succeeds* (200)
      // but returns HTML. Backends can legitimately return HTML on 401/403/500; we must not
      // misclassify those as missing rewrites.
      if (res.status === 200 && (ctype.includes('text/html') || !ctype.includes('application/json'))) {
        const preview = await res.clone().text().catch(() => '');
        const snippet = (preview || '').slice(0, 4000);
        const shouldRunDevHeuristics = import.meta.env.DEV && isLocalUiHost();
        const isMisroute = containsSpaHtmlMisrouteMarker(snippet) || (shouldRunDevHeuristics && looksLikeSpaHtml(snippet));
        if (isMisroute) {
          maybeNotifyProxyMissingOnce();
          throw new AdminApiError('API error (proxy misroute)', {
            // If we got HTML for an /admin-api call, we did not reach the backend.
            // Treat this as a proxy failure (non-2xx) even if the HTTP status was 200.
            status: res.ok ? 502 : (res.status || 502),
            url,
            body: snippet,
            code: 'HTML_MISROUTE',
          });
        }
      }
    }
  } catch (e) {
    if (e instanceof AdminApiError) throw e;
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
    if ((res.status === 423) && typeof window !== 'undefined') {
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
    const code = res.status === 503 ? 'DB_UNAVAILABLE' : undefined;
    throw new AdminApiError(msg, { status: res.status, url: errUrl, body, code });
  }

  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    // Keep behavior predictable for callers expecting JSON
    const text = await res.text().catch(() => '');
    return (text as any) as T;
  }
  return (await res.json()) as T;
}

export async function adminPost<T = any>(path: string, json?: unknown, init: AdminFetchOptions = {}): Promise<T> {
  return adminJson<T>(path, { ...init, method: 'POST', json });
}

export async function adminPatch<T = any>(path: string, json?: unknown, init: AdminFetchOptions = {}): Promise<T> {
  return adminJson<T>(path, { ...init, method: 'PATCH', json });
}

export async function adminDelete<T = any>(path: string, init: AdminFetchOptions = {}): Promise<T> {
  return adminJson<T>(path, { ...init, method: 'DELETE' });
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

  // If caller provided an absolute URL, do not rewrite it.
  if (/^https?:\/\//i.test(raw)) return raw;

  // If caller already provided a proxy-style path, keep it.
  if (raw.startsWith('/admin-api/') || raw === '/admin-api') {
    return raw.replace(/\/\/+/, '/');
  }

  // If caller accidentally used '/api/*', route it through the proxy base.
  if (raw.startsWith('/api/') || raw === '/api') {
    return (`/admin-api${raw}`).replace(/\/\/+/, '/');
  }

  const rest = normalizeAdminRest(path);
  const base = stripTrailingSlashes(ADMIN_API_BASE) || '/admin-api';

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

  // Absolute bases are not supported (enforced above); fall back to proxy-style joining.
  const joined = `${base}/admin${rest}`;
  return joined.replace(/([^:]\/)\/+?/g, '$1');
}

// Back-compat export: some callers/loggers may import this.
export function adminApiUrl(path: string): string {
  const p = adminApiPath(path);
  const url = /^https?:\/\//i.test(p) ? p : `${BASE}${p}`;
  return url.replace(/([^:]\/)\/+?/g, '$1');
}
