import axios, { AxiosInstance } from 'axios';

// Centralized API base selection:
// - Proxy mode (preferred): use same-origin '/admin-api/api' and let Vite/Vercel proxy forward to backend.
// - Direct mode (fallback): set VITE_API_URL to a valid backend origin (no /api suffix).
const envAny = import.meta.env as any;
const rawBase = (envAny.VITE_API_URL || '').toString().trim();
const trimmed = rawBase.replace(/\/+$/, '');

let configWarnedOnce = false;

function isValidAbsoluteUrl(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

function emitApiConfigErrorOnce(message: string) {
  if (configWarnedOnce) return;
  configWarnedOnce = true;
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:api-config-error', { detail: { message } }));
    }
  } catch {
    // ignore
  }
}

function resolveBaseUrl(base: string) {
  // DEV contract: always go through the local proxy.
  if (import.meta.env.DEV) return '/admin-api/api';

  const t0 = (base || '').toString().trim();
  let t = (t0 === 'undefined' || t0 === 'null' ? '' : t0).replace(/\/+$/, '');

  const useProxy = String(envAny.VITE_USE_PROXY || '').toLowerCase() === 'true' && import.meta.env.DEV;
  // (kept for back-compat; DEV returns early above)
  if (useProxy) return '/admin-api/api';

  const hasPlaceholders = /[<>]/.test(t);
  const hasSuffixApi = /\/api$/i.test(t);
  const withoutApi = hasSuffixApi ? t.replace(/\/api$/i, '') : t;
  const ok = !!withoutApi && !hasPlaceholders && isValidAbsoluteUrl(withoutApi);

  if (ok) return `${withoutApi}/api`;

  // (DEV returns early above)

  // If direct base is missing/invalid (or placeholder), fall back to proxy mode.
  // This matches the recommended deployment mode (omit VITE_API_URL; use /admin-api proxy).
  if (t) {
    emitApiConfigErrorOnce(
      `Invalid API base URL (falling back to proxy). Fix VITE_API_URL. Got: ${t}`
    );
  }
  return '/admin-api/api';
}

function absolutizeIfRelativeBase(maybeRelative: string) {
  const s = (maybeRelative || '').toString();
  // Axios in the browser uses URL parsing; relative base URLs can throw "Invalid URL".
  if (/^https?:\/\//i.test(s)) return s;
  if (!s.startsWith('/')) return s;
  try {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return `${window.location.origin}${s}`;
    }
  } catch {}
  return s;
}

const API_BASE_URL = absolutizeIfRelativeBase(resolveBaseUrl(trimmed));

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
  baseURL: API_BASE_URL,
  withCredentials: true,
}) as ExtendedApi;

let missingUrlWarned = false;

// Normalize path joins so callers can pass '/api/...'
api.interceptors.request.use((cfg) => {
  try {
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

    const base = (cfg.baseURL || '').toString();
    let url = (cfg.url || '').toString();
    // Avoid accidental double '/api/api/...'
    if (/\/api$/.test(base) && /^\/api\//.test(url)) {
      url = url.replace(/^\/api\//, '');
      cfg.url = `/${url}`;
    }
  } catch {}
  return cfg;
});

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

// Dev request/response logging
if (import.meta.env.DEV) {
  api.interceptors.request.use((cfg) => {
    try {
      console.debug('[api:req]', cfg.method?.toUpperCase(), cfg.baseURL ? cfg.baseURL + (cfg.url || '') : cfg.url);
    } catch {}
    return cfg;
  });
  api.interceptors.response.use(
    (res) => {
      const ct = (res.headers['content-type'] || '').toString();
      try { console.debug('[api:res]', res.status, res.config.url, ct); } catch {}
      if (!/application\/json/i.test(ct)) {
        console.error('⚠ Non-JSON API response. Likely HTML or text. BaseURL or rewrite may be misconfigured.', ct);
      }
      return res;
    },
    (err) => {
      const r = err?.response;
      const cfg = err?.config;
      const status = r?.status;
      const url = (cfg?.url || r?.config?.url || '').toString();
      const baseURL = (cfg?.baseURL || r?.config?.baseURL || api.defaults.baseURL || '').toString();
      const ct = (r?.headers?.['content-type'] || '').toString();
      const code = (err as any)?.code;
      const message = (err as any)?.message;
      // Suppress logging for silent probes (HEAD 404 expected for optional routes)
      if ((err as any)?.config?.skipErrorLog) {
        return Promise.reject(err);
      }
      const previewPromise = r
        ? (r?.data && typeof r.data === 'string'
          ? Promise.resolve(r.data)
          : (r?.data ? Promise.resolve(JSON.stringify(r.data).slice(0, 200)) : Promise.resolve('')))
        : Promise.resolve(message || String(code || 'Network error'));

      previewPromise.then((preview) => {
        try {
          console.error('[api:err]', status ?? 'NO_RESPONSE', baseURL || '(no-baseURL)', url || '(no-url)', code || '', ct || '', 'preview:', String(preview).slice(0, 200));
        } catch {}
      }).catch(() => {});
      if (/text\/html/i.test(ct)) {
        console.error('❌ HTML instead of JSON. Admin API returned a page (404 or SPA). Check VITE_ADMIN_API_BASE_URL or vercel rewrites.');
      }
      return Promise.reject(err);
    }
  );
}

// Dashboard / Monitor Hub stats helper
// Tries modern path first then legacy fallback, normalizes shape.
api.monitorHub = async () => {
  // Use authenticated admin client for system monitor (backend path: /api/system/monitor-hub)
  // Avoid double slashes; adminApi handles Authorization header.
  const { adminApi } = await import('./adminApi');
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
    try { localStorage.setItem('np_token', token); } catch {}
  } else {
    delete api.defaults.headers.common['Authorization'];
    try { localStorage.removeItem('np_token'); } catch {}
  }
}

// Dev visibility of resolved base
try { console.info('[api] baseURL resolved =', API_BASE_URL); } catch {}

export default api;
