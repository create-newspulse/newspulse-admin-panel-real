import axios from 'axios';

const envAny = import.meta.env as any;
const rawBase = (
  envAny.VITE_API_BASE_URL ||
  envAny.VITE_BACKEND_URL ||
  envAny.VITE_API_URL ||
  ''
).toString().trim().replace(/\/+$/, '');
// Back-compat: if caller provides a full '/api' URL, keep it; otherwise append '/api'.
const API_BASE_URL = rawBase
  ? (/\/api$/i.test(rawBase) ? rawBase : `${rawBase}/api`)
  : 'https://newspulse-backend-real.onrender.com/api';

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
