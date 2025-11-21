import axios, { AxiosInstance } from 'axios';

// Unified base resolution: direct origin via VITE_ADMIN_API_BASE_URL (no trailing /api)
// or fallback '/admin-api' for rewrite mode. No host sniffing.
let base = (import.meta.env.VITE_ADMIN_API_BASE_URL || '').toString().trim().replace(/\/+$/, '');
if (!base) base = '/admin-api';
base = base.replace(/\/admin-api\/api$/,'/admin-api').replace(/\/admin-api\/$/,'/admin-api');
const API_BASE_URL = base;

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
    try { console.debug('[api:req]', cfg.method?.toUpperCase(), cfg.baseURL ? cfg.baseURL + (cfg.url || '') : cfg.url); } catch {}
    return cfg;
  });
  api.interceptors.response.use(
    (res) => {
      const ct = (res.headers['content-type'] || '').toString();
      try { console.debug('[api:res]', res.status, res.config.url, ct); } catch {}
      if (!/application\/json/i.test(ct)) {
        console.error('⚠ Non-JSON API response. Check backend URL or rewrite.', ct);
      }
      return res;
    },
    (err) => {
      const r = err?.response;
      const ct = (r?.headers?.['content-type'] || '').toString();
      try { console.error('[api:err]', r?.status, r?.config?.url, ct); } catch {}
      if (/text\/html/i.test(ct)) {
        console.error('❌ HTML received instead of JSON. Backend misconfiguration or 404 SPA fallthrough.');
      }
      return Promise.reject(err);
    }
  );
}

// Dashboard / Monitor Hub stats helper
// Tries modern path first then legacy fallback, normalizes shape.
api.monitorHub = async () => {
  const paths = ['/admin/stats', '/api/admin/stats'];
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
      // Break on auth errors, else continue to next path.
      if (status === 401 || status === 403) {
        return { ok: false, auth: true, status, error: 'unauthorized' };
      }
      continue;
    }
  }
  // Graceful degrade instead of throw to avoid blank UI sections.
  const status = lastErr?.response?.status;
  return { ok: false, status: status ?? null, error: 'stats-unavailable' };
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
