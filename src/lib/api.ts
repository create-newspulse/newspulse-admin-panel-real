import axios, { AxiosInstance } from 'axios';

// Unified resolution order (no trailing slash, no implicit /api):
// 1. VITE_ADMIN_API_BASE_URL
// 2. VITE_API_URL
// 3. fallback Render production URL
const rawAdmin = (import.meta.env.VITE_ADMIN_API_BASE_URL || '').toString().replace(/\/+$/, '');
const rawLegacy = (import.meta.env.VITE_API_URL || '').toString().replace(/\/+$/, '');
const API_BASE_URL = rawAdmin || rawLegacy || 'https://newspulse-backend-real.onrender.com';

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
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log('[api] baseURL resolved =', API_BASE_URL);
}

export default api;
