import axios, { AxiosInstance } from 'axios';

// Single source of truth:
// - Preferred/proxy mode: use VITE_ADMIN_API_ORIGIN or VITE_ADMIN_API_URL (absolute),
//   otherwise fall back to VITE_ADMIN_API_PROXY_BASE (relative, default '/admin-api').
// - Legacy/direct mode: VITE_API_URL (absolute or relative) still works.
// - Public endpoints resolve under:  <base>/api/*
// - Admin endpoints in this codebase are also routed under /api/* (e.g. /api/admin/*).
const envAny = import.meta.env as any;

function stripTrailingSlashes(s: string) {
  return (s || '').replace(/\/+$/, '');
}

function normalizeLeadingSlash(p: string) {
  const s = (p || '').toString();
  return s.startsWith('/') ? s : `/${s}`;
}

function isAbsoluteHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

function looksLikePlaceholder(u: string): boolean {
  const s = (u || '').toString();
  // Common placeholder patterns used in docs/examples
  return /[<>]/.test(s) || /\bexample\.com\b/i.test(s) || /replace_me|change_me|your-?backend/i.test(s);
}

function isValidApiBase(u: string): boolean {
  const s = (u || '').toString().trim();
  if (!s) return false;
  // Allow relative proxy bases like '/admin-api'
  if (s.startsWith('/')) return true;
  if (!isAbsoluteHttpUrl(s)) return false;
  if (looksLikePlaceholder(s)) return false;
  try {
    // Ensure it parses as a URL
    // eslint-disable-next-line no-new
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export function getApiBase(): string {
  const useProxy = String(envAny.VITE_USE_PROXY || '').toLowerCase() === 'true';

  // 1) Preferred: explicit admin API origin (absolute).
  // Example: https://<backend>.onrender.com
  const adminOriginRaw = (
    envAny.VITE_ADMIN_API_ORIGIN
    || envAny.VITE_ADMIN_API_URL
    || envAny.VITE_ADMIN_API_BASE_URL
    || ''
  ).toString().trim();
  const adminOrigin = stripTrailingSlashes(adminOriginRaw).replace(/\/api$/i, '');
  // If proxy mode is explicitly enabled, always route through the proxy contract
  // to avoid stale direct URLs causing local-only failures.
  if (!useProxy && adminOrigin && isValidApiBase(adminOrigin)) return adminOrigin;

  // Proxy base (relative). Example: /admin-api
  const proxyBaseRaw = (envAny.VITE_ADMIN_API_PROXY_BASE || '').toString().trim();
  const proxyBase = stripTrailingSlashes(proxyBaseRaw);
  if (useProxy) return proxyBase || '/admin-api';

  // 2) Legacy: generic API URL (absolute or relative).
  // If set, the app talks directly to that backend (ensure CORS).
  const legacyRaw = (envAny.VITE_API_URL || '').toString().trim();
  const legacyBase = stripTrailingSlashes(legacyRaw).replace(/\/api$/i, '');
  if (legacyBase && isValidApiBase(legacyBase)) return legacyBase;

  if (proxyBase) return proxyBase;

  // Default: run through the Vercel/Vite proxy contract.
  // This keeps local dev + production aligned (frontend calls /admin-api/*, proxy forwards to backend /api/*).
  return '/admin-api';
}

function absolutizeForAxios(base: string): string {
  const b = (base || '').toString().trim();
  if (!b) {
    // If caller uses relative URLs, axios still needs an absolute base in browsers.
    try {
      if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
        return window.location.origin;
      }
    } catch {}
    return '';
  }
  if (isAbsoluteHttpUrl(b)) return b;
  // Treat non-absolute values as path prefixes under current origin.
  const p = b.startsWith('/') ? b : `/${b}`;
  try {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return `${window.location.origin}${p}`;
    }
  } catch {}
  return p;
}

function joinBase(base: string, path: string) {
  const b = stripTrailingSlashes(base);
  const p = normalizeLeadingSlash(path);
  return b ? `${b}${p}` : p;
}

export function apiUrl(path: string): string {
  const p0 = normalizeLeadingSlash(path);
  const p = p0.startsWith('/api/') ? p0 : `/api${p0}`;
  return joinBase(getApiBase(), p.replace(/^\/api\/api\//, '/api/'));
}

export function adminUrl(path: string): string {
  const base = getApiBase();
  const proxyMode = !isAbsoluteHttpUrl(base);
  const p0 = normalizeLeadingSlash(path);

  // Accept callers passing either '/admin/*' or '/api/admin/*' or a bare segment like '/me'.
  let rest = p0;
  if (rest === '/api/admin') rest = '/';
  if (rest.startsWith('/api/admin/')) rest = rest.replace(/^\/api\/admin\//, '/');
  if (rest === '/admin') rest = '/';
  if (rest.startsWith('/admin/')) rest = rest.replace(/^\/admin\//, '/');
  if (!rest.startsWith('/')) rest = `/${rest}`;

  const prefix = proxyMode ? '/admin' : '/api/admin';
  const joined = `${prefix}${rest}`.replace(/^\/api\/admin\/api\/admin\//, '/api/admin/');
  return joinBase(base, joined.replace(/\/\/+$/, ''));
}

// Unified token retrieval.
// Order of precedence:
// 1) np_admin_access_token
// 2) np_admin_token
// 3) adminToken
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Priority order:
    // 1) np_admin_access_token
    // 2) np_admin_token
    // 3) np_token
    // 4) newsPulseAdminAuth JSON -> token
    // 5) legacy adminToken
    for (const key of ['np_admin_access_token', 'np_admin_token', 'np_token']) {
      const val = localStorage.getItem(key);
      if (val && String(val).trim()) return String(val).replace(/^Bearer\s+/i, '');
    }

    // Back-compat: some builds store auth state as JSON.
    const raw = localStorage.getItem('newsPulseAdminAuth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const token = parsed?.token;
        if (token && String(token).trim()) return String(token).replace(/^Bearer\s+/i, '');
      } catch {}
    }

    // Back-compat: older key
    const legacy = localStorage.getItem('adminToken');
    if (legacy && String(legacy).trim()) return String(legacy).replace(/^Bearer\s+/i, '');
  } catch {}
  return null;
}

const AXIOS_BASE = absolutizeForAxios(getApiBase());

// Extend axios instance with monitorHub helper
export interface ExtendedApi extends AxiosInstance {
  monitorHub: () => Promise<any>;
  revenue: () => Promise<any>;
  revenueExportPdfPath: () => string;
  systemHealth: () => Promise<any>;
  aiActivityLog: () => Promise<any>;
  stats: () => Promise<any>;
  weekly: () => Promise<any>;
  traffic: () => Promise<any>;
  pollsLiveStats: () => Promise<any>;
}

export const api: ExtendedApi = axios.create({
  baseURL: AXIOS_BASE,
  withCredentials: true,
}) as ExtendedApi;

export const ADMIN_API_BASE = adminUrl('/').replace(/\/+$/, '');
export const adminApi = axios.create({
  baseURL: absolutizeForAxios(getApiBase()),
  withCredentials: true,
});

let missingUrlWarned = false;

// Normalize path joins so callers can pass '/api/...'
api.interceptors.request.use((cfg) => {
  try {
    // Attach bearer when available (covers protected endpoints called via `api`).
    const token = getAuthToken();
    if (token) {
      cfg.headers = cfg.headers || {};
      const h: any = cfg.headers as any;
      if (!h.Authorization && !h.authorization) {
        h.Authorization = `Bearer ${token}`;
      }
    }

    // Fail fast if a caller accidentally invokes axios without a URL.
    // This otherwise surfaces as: "Failed to construct 'URL': Invalid URL" with (no-url).
    if (cfg.url == null || (typeof cfg.url === 'string' && cfg.url.trim() === '')) {
      if (import.meta.env.DEV && !missingUrlWarned) {
        missingUrlWarned = true;
        try {
          const err = new Error('[api] Missing request url');
          console.error('[api] Missing request url (first occurrence)', {
            method: cfg.method,
            baseURL: cfg.baseURL || api.defaults.baseURL,
          }, err);
        } catch {}
      }
      return Promise.reject(new Error('[api] Missing request url'));
    }

    // Axios browser adapter can throw "Failed to construct 'URL'" if baseURL is relative.
    // Ensure baseURL becomes absolute at request time (even when relying on instance defaults).
    const base0 = (cfg.baseURL || api.defaults.baseURL || '').toString();
    if (base0.startsWith('/')) {
      try {
        if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
          cfg.baseURL = `${window.location.origin}${base0}`;
        }
      } catch {}
    }

    let url = (cfg.url || '').toString().trim();

    // If url is absolute (http/https), do not rewrite.
    if (/^https?:\/\//i.test(url)) {
      return cfg;
    }

    // Ensure leading slash for relative paths.
    if (url && !url.startsWith('/')) url = `/${url}`;

    // Enforce contract: everything goes under /api/*.
    if (url && url !== '/api' && !url.startsWith('/api/')) {
      url = `/api${url}`;
    }

    // Collapse double-prefix mistakes.
    url = url.replace(/^\/api\/api\//, '/api/');

    cfg.url = url;
  } catch {}
  return cfg;
});

function pathnameOf(u: unknown): string {
  const s = (u ?? '').toString();
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL(s, window.location.origin).pathname;
    }
  } catch {}
  return s;
}

function shouldLogoutOn401(u: unknown): boolean {
  const p = pathnameOf(u);
  return (
    p === '/api/auth/me'
    || p.startsWith('/api/admin/')
    || p === '/api/admin'
    // proxy-mode adminApi paths
    || p.startsWith('/admin/')
    || p === '/admin'
  );
}

// Admin axios instance:
// - Resolves relative paths under /admin/*
// - Always attaches bearer token when present
adminApi.interceptors.request.use((cfg) => {
  try {
    const token = getAuthToken();
    if (token) {
      cfg.headers = cfg.headers || {};
      (cfg.headers as any).Authorization = `Bearer ${token}`;
    }

    // Proxy mode uses:   /admin-api/admin/*  (proxy forwards to backend /api/admin/*)
    // Direct mode uses:  <origin>/api/admin/*
    const base = getApiBase();
    const proxyMode = !isAbsoluteHttpUrl(base);
    const prefix = proxyMode ? '/admin/' : '/api/admin/';

    let url = (cfg.url || '').toString().trim();
    if (!url) return cfg;
    if (isAbsoluteHttpUrl(url)) return cfg;
    if (!url.startsWith('/')) url = `/${url}`;

    // Normalize whichever prefix the caller provided into the correct mode.
    if (proxyMode) {
      // '/api/admin/*' -> '/admin/*' for proxy
      if (url === '/api/admin') url = '/admin';
      if (url.startsWith('/api/admin/')) url = url.replace(/^\/api\/admin\//, '/admin/');
      if (!url.startsWith('/admin/')) url = `/admin${url}`;
      url = url.replace(/^\/admin\/admin\//, '/admin/');
    } else {
      // '/admin/*' -> '/api/admin/*' for direct backend
      if (url === '/admin') url = '/api/admin';
      if (url.startsWith('/admin/')) url = url.replace(/^\/admin\//, '/api/admin/');
      if (!url.startsWith('/api/admin/')) url = `/api/admin${url}`;
      url = url.replace(/^\/api\/admin\/api\/admin\//, '/api/admin/');
    }

    // Final sanity collapse
    url = url.replace(/\/+$/, '');
    cfg.url = url;
  } catch {}
  return cfg;
});

// Admin response handling (keeps existing app behavior):
// - 401: clear stored tokens and emit 'np:logout'
// - 403: mark owner-key required and emit 'np:ownerkey-required'
adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || error?.response?.config?.url || '';

    if (status === 401) {
      const isCommunityQueue = typeof url === 'string' && url.includes('/community-reporter/queue');
      if (!isCommunityQueue && shouldLogoutOn401(url)) {
        try {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('np_admin_token');
          localStorage.removeItem('np_admin_access_token');
          localStorage.removeItem('newsPulseAdminAuth');
          localStorage.removeItem('np_token');
        } catch {}
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:logout')); } catch {}
      }
    }

    if (status === 403) {
      try { (error as any).isOwnerKeyRequired = true; } catch {}
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:ownerkey-required')); } catch {}
    }

    if (import.meta.env.DEV) {
      // Allow callers to suppress expected/handled errors (e.g., legacy fallback probes)
      if (!(error as any)?.config?.skipErrorLog) {
        try { console.error('[adminApi:err]', status, url, error?.response?.headers?.['content-type']); } catch {}
      }
    }

    return Promise.reject(error);
  }
);

// Stub legacy helpers to avoid undefined method errors; components can feature-detect responses.
api.systemHealth = async () => ({ ok: true, status: 'unknown' });
api.aiActivityLog = async () => ({ ok: true, entries: [] });
api.stats = async () => ({ ok: true, stats: {} });
api.weekly = async () => ({ ok: true, weekly: {} });
api.traffic = async () => ({ ok: true, traffic: {} });

// Cached route availability map to suppress repeated 404 network attempts for optional/admin features.
const routeAvailability: Record<string, boolean> = {};
// In-flight probe promises to prevent duplicate HEAD spam when multiple components mount simultaneously.
const inFlightProbes: Record<string, Promise<boolean>> = {};

async function probeRoute(path: string): Promise<boolean> {
  // Already cached result
  if (routeAvailability[path] !== undefined) return routeAvailability[path];
  // Existing in-flight probe
  if (inFlightProbes[path] !== undefined) return inFlightProbes[path];

  inFlightProbes[path] = (async () => {
    try {
      // Silent HEAD: custom flag to skip error logging in interceptor for expected 404.
      await api.request({ url: path, method: 'HEAD', //@ts-expect-error custom flag
        skipErrorLog: true });
      routeAvailability[path] = true;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        routeAvailability[path] = false;
      } else {
        // Non-404 => treat as existing so consumer can handle auth/other errors later.
        routeAvailability[path] = true;
      }
    }
    return routeAvailability[path];
  })();

  return inFlightProbes[path];
}

// Dev-only logging for FAILED requests (helps catch wrong base URLs / proxy misses)
if (import.meta.env.DEV) {
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      // Suppress logging for silent probes (HEAD 404 expected for optional routes)
      if ((err as any)?.config?.skipErrorLog) {
        return Promise.reject(err);
      }

      const r = err?.response;
      const cfg = err?.config;
      const status = r?.status;
      const method = String(cfg?.method || '').toUpperCase();
      const url = (cfg?.url || r?.config?.url || '').toString();
      const baseURL = (cfg?.baseURL || r?.config?.baseURL || api.defaults.baseURL || '').toString();
      const ct = (r?.headers?.['content-type'] || '').toString();
      const code = (err as any)?.code;

      // Best-effort resolved URL for quick diagnosis
      let full = '';
      try {
        full = baseURL ? new URL(url, baseURL).toString() : url;
      } catch {
        full = `${baseURL || ''}${url || ''}`;
      }

      try {
        console.error('[api:err]', status ?? 'NO_RESPONSE', method || '(no-method)', full || '(no-url)', code || '', ct || '');
      } catch {}

      if (/text\/html/i.test(ct)) {
        console.error('[api:err] Received HTML. Proxy/base URL likely misconfigured.');
      }

      return Promise.reject(err);
    }
  );
}

// Dashboard / Monitor Hub stats helper
// Tries modern path first then legacy fallback, normalizes shape.
api.monitorHub = async () => {
  try {
    const res = await adminApi.get('/system/monitor-hub');
    const raw = res.data || {};
    const data = raw.data || raw.stats || raw;
    return {
      ok: raw.ok === true || raw.success === true || !!raw.data || !!raw.stats || true,
      ...data,
      _raw: raw,
      _endpoint: '/system/monitor-hub',
    };
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      return { ok: false, auth: true, status, error: 'unauthorized' };
    }
    return { ok: false, status: status ?? null, error: 'monitor-hub-unavailable' };
  }
};

// Unified settings loader with stub & 404 suppression.
export async function safeSettingsLoad(opts?: { skipProbe?: boolean }) {
  const path = '/settings/load';
  // If security system disabled globally, skip network entirely.
  if (import.meta.env.VITE_SECURITY_SYSTEM_ENABLED === 'false') {
    return { ok: true, lockdown: false, _stub: true };
  }
  // Explicit override (caller wants zero network attempts)
  if (opts?.skipProbe) {
    return { ok: true, lockdown: false, _stub: true };
  }
  const available = await probeRoute(path);
  if (!available) {
    console.warn('[api] settings route missing; returning stub');
    return { ok: true, lockdown: false, _stub: true };
  }
  try {
    const res = await api.get(path);
    const raw = res.data || res || {};
    return { ok: true, ...(raw.data || raw), _endpoint: path };
  } catch (err: any) {
    if (/404/.test(err?.message || '')) {
      console.warn('[api] settings 404 after probe; caching as unavailable');
      routeAvailability[path] = false;
      return { ok: true, lockdown: false, _stub: true };
    }
    throw err;
  }
}

// Live Polls stats (used by LiveNewsPollsPanel) – backend route: GET /api/polls/live-stats
// Provides shape: { success:true, data:{ totalPolls, totalVotes, topPoll:{ question, total } } }
// Normalizes legacy forms if present.
export async function pollsLiveStats() {
  const paths = ['/polls/live-stats'];
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res = await api.get(p);
      const raw = res.data || {};
      const data = raw.data || raw.stats || raw;
      return {
        success: raw.success === true || raw.ok === true || !!raw.data || !!raw.stats,
        data: {
          totalPolls: Number(data.totalPolls ?? data.activePolls ?? 0),
          totalVotes: Number(data.totalVotes ?? data.votes ?? 0),
          topPoll: data.topPoll || data.top || null,
          _endpoint: p,
        }
      };
    } catch (e:any) {
      lastErr = e;
      continue;
    }
  }
  const status = lastErr?.response?.status;
  return { success:false, error:'polls-live-stats-unavailable', status: status ?? null };
}

// Attach for existing code expecting api.pollsLiveStats()
(api as any).pollsLiveStats = pollsLiveStats;

// --- Revenue helpers (placeholder adaptive) ---
// Attempts multiple possible backend endpoints for revenue summary.
// Normalizes minimal shape expected by RevenuePanel.
api.revenue = async () => {
  const candidates = [
    '/revenue/summary',
    '/revenue'
  ];
  let lastErr: any = null;
  for (const p of candidates) {
    try {
      const res = await api.get(p);
      const raw = res.data || {};
      // Unwrap common wrappers
      const data = raw.data || raw.revenue || raw;
      const out = {
        adsense: Number(data.adsense ?? data.googleAdsense ?? 0),
        affiliates: Number(data.affiliates ?? data.affiliate ?? 0),
        sponsors: Number(data.sponsors ?? data.sponsor ?? 0),
        total: Number(data.total ?? (Number(data.adsense || 0) + Number(data.affiliates || 0) + Number(data.sponsors || 0))),
        lastUpdated: data.lastUpdated || raw.lastUpdated || null
      };
      return out;
    } catch (e:any) {
      lastErr = e;
      const status = e?.response?.status;
      // Stop early if unauthorized
      if (status === 401 || status === 403) break;
      continue;
    }
  }
  // Surface a unified error shape so UI can show message
  return { error: 'revenue-unavailable', status: lastErr?.response?.status || null };
};

// Returns an export PDF endpoint (first existing candidate) without calling it.
api.revenueExportPdfPath = () => {
  const override = (import.meta.env.VITE_REVENUE_EXPORT_PATH || '').trim();
  if (override) return api.defaults.baseURL + override.replace(/^\//,'/');
  // Provide a deterministic primary path; backend should implement one of these.
  const candidates = [
    '/revenue/export/pdf',
    '/revenue/export'
  ];
  // Just return first; UI will navigate and backend should respond or 404.
  return api.defaults.baseURL + candidates[0];
};

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try { localStorage.setItem('np_token', token); } catch {}
  } else {
    delete api.defaults.headers.common['Authorization'];
    delete adminApi.defaults.headers.common['Authorization'];
    try { localStorage.removeItem('np_token'); } catch {}
  }
}

// Dev visibility of resolved base
try { console.info('[api] VITE_API_URL =', getApiBase()); } catch {}

export default api;
