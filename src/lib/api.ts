import axios, { AxiosInstance } from 'axios';

// Prefer relative proxy '/admin-api' on production hosts unless forced.
const forceDirect = (import.meta.env.VITE_FORCE_DIRECT_BACKEND as string | undefined) === '1';
const explicit = (import.meta.env.VITE_ADMIN_API_BASE_URL || import.meta.env.VITE_API_URL || '').toString().replace(/\/+$/, '');
let base = explicit;
if (!forceDirect) {
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const isProdHost = /vercel\.app$/i.test(host) || /admin\.newspulse\.co\.in$/i.test(host);
  if (isProdHost) base = '/admin-api';
}
if (!base) base = '/admin-api';
const API_BASE_URL = base;

// Extend axios instance with monitorHub helper
export interface ExtendedApi extends AxiosInstance {
  monitorHub: () => Promise<any>;
}

export const api: ExtendedApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
}) as ExtendedApi;

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
      // Retry next path only on 404/405 or network errors; break on 401/403
      const status = err?.response?.status;
      if (status === 401 || status === 403) break;
      continue;
    }
  }
  // Surface concise error with context
  const status = lastErr?.response?.status;
  throw new Error(`[monitorHub] failed (status=${status ?? 'n/a'}) ${lastErr?.message || ''}`);
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
try { console.info('[api] baseURL resolved =', API_BASE_URL, 'forceDirect=', forceDirect); } catch {}

export default api;
