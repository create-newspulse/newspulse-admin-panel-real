import axios from 'axios';

const envAny = import.meta.env as any;
const rawBase = (
  envAny.VITE_API_BASE_URL ||
  envAny.VITE_ADMIN_API_BASE_URL ||
  envAny.VITE_BACKEND_URL ||
  envAny.VITE_API_URL ||
  ''
).toString().trim().replace(/\/+$/, '');

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

function absolutizeIfRelativeBase(maybeRelative: string) {
  const s = (maybeRelative || '').toString();
  if (/^https?:\/\//i.test(s)) return s;
  if (!s.startsWith('/')) return s;
  try {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return `${window.location.origin}${s}`;
    }
  } catch {}
  return s;
}

function resolveBase(): string {
  // Local dev: always go through the proxy so we never accidentally hit production.
  if (import.meta.env.DEV) return '/admin-api/api';

  const trimmed0 = rawBase.replace(/\/+$/, '');
  const origin = /\/api$/i.test(trimmed0) ? trimmed0.replace(/\/api$/i, '') : trimmed0;
  const containsPlaceholders = /[<>]/.test(origin) || /(your[_-]?api|example\.com)/i.test(origin);
  const ok = !!origin && !containsPlaceholders && isValidAbsoluteUrl(origin);

  // If no valid direct base provided, fall back to proxy mode.
  return ok ? `${origin}/api` : '/admin-api/api';
}

const API_BASE_URL = absolutizeIfRelativeBase(resolveBase());

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('np_admin_token');
        localStorage.removeItem('np_admin_access_token');
        localStorage.removeItem('newsPulseAdminAuth');
      } catch {}
      if (import.meta.env.DEV) console.warn('[api] logout on 401 (token expired)');
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:logout')); } catch {}
    }
    if (status === 403) {
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:ownerkey-required')); } catch {}
    }
    if (status === 503 || status === 423) {
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:lockdown')); } catch {}
    }
    // Do not auto-logout on 403/404/500; let guards/pages handle Access Denied
    return Promise.reject(err);
  }
);

export default api;
