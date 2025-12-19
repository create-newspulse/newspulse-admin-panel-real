import axios from 'axios';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL?.toString() || '').replace(/\/+$/, '') ||
  'https://newspulse-backend-real.onrender.com';

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
    // Do not auto-logout on 403/404/500; let guards/pages handle Access Denied
    return Promise.reject(err);
  }
);

export default api;
