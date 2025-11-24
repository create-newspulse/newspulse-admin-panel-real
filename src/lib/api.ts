import axios, { AxiosInstance } from 'axios';

// Centralized Admin API base:
// Prefer explicit backend origin via VITE_ADMIN_API_BASE_URL (e.g. https://newspulse-backend-real.example.com)
// Fallback to '/admin-api' ONLY for legacy rewrite mode (vercel.json rewrites '/admin-api/*' -> backend).
// IMPORTANT: Replace the placeholder domain in your deployment environment; never hard-code production host here.
let resolvedBase = (import.meta.env.VITE_ADMIN_API_BASE_URL || '').toString().trim();
if (!resolvedBase) {
  // Legacy fallback: relative proxy path (requires vercel.json rewrite present)
  resolvedBase = '/admin-api';
}
// Normalize accidental suffixes and double slashes.
resolvedBase = resolvedBase.replace(/\/+$/, '');
resolvedBase = resolvedBase.replace(/\/admin-api\/api$/,'/admin-api');
const API_BASE_URL = resolvedBase;

// Extend axios instance with monitorHub helper
export interface ExtendedApi extends AxiosInstance {
  monitorHub: () => Promise<any>;
  revenue: () => Promise<any>;
  revenueExportPdfPath: () => string;
}

export const api: ExtendedApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
}) as ExtendedApi;

// Cached route availability map to suppress repeated 404 network attempts for optional/admin features.
const routeAvailability: Record<string, boolean> = {};
// In-flight probe promises to prevent duplicate HEAD spam when multiple components mount simultaneously.
const inFlightProbes: Record<string, Promise<boolean>> = {};

async function probeRoute(path: string): Promise<boolean> {
  // Already cached result
  if (routeAvailability[path] !== undefined) return routeAvailability[path];
  // Existing in-flight probe
  if (inFlightProbes[path]) return inFlightProbes[path];

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
      const ct = (r?.headers?.['content-type'] || '').toString();
      // Suppress logging for silent probes (HEAD 404 expected for optional routes)
      if ((err as any)?.config?.skipErrorLog) {
        return Promise.reject(err);
      }
      const previewPromise = r?.data && typeof r.data === 'string' ? Promise.resolve(r.data) : (r?.data ? Promise.resolve(JSON.stringify(r.data).slice(0,200)) : Promise.resolve(''));
      previewPromise.then(preview => {
        try {
          console.error('[api:err]', r?.status, r?.config?.url, ct, 'preview:', String(preview).slice(0,120));
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
  // Prefer canonical backend path; include fallback alias variants to tolerate mixed deployments.
  const paths = ['/api/system/monitor-hub', '/system/monitor-hub', '/api/admin/stats', '/admin/stats'];
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res = await api.get(p);
      const raw = res.data || {};
      const data = raw.data || raw.stats || raw; // tolerate different wrappers
      return {
        ok: raw.ok === true || raw.success === true || !!raw.data || !!raw.stats,
        ...data,
        _raw: raw,
        _endpoint: p,
      };
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        return { ok: false, auth: true, status, error: 'unauthorized' };
      }
      continue;
    }
  }
  const status = lastErr?.response?.status;
  return { ok: false, status: status ?? null, error: 'monitor-hub-unavailable' };
};

// Unified settings loader with stub & 404 suppression.
export async function safeSettingsLoad(opts?: { skipProbe?: boolean }) {
  const path = '/api/settings/load';
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
  const paths = ['/api/polls/live-stats'];
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
    '/api/revenue/summary',
    '/api/revenue',
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
    '/api/revenue/export/pdf',
    '/api/revenue/export',
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
