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
}

export const api: ExtendedApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
}) as ExtendedApi;

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
