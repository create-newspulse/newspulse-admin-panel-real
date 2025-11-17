import axios from 'axios';

// Consistent API base selection with a safe production fallback
const isDev = import.meta.env.MODE === 'development';
const RAW_BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE ?? '') + '';
const BASE = RAW_BASE.replace(/\/$/, '');
const isProxyPath = BASE.startsWith('/admin-api');

// If BASE looks like localhost/127.* in a production build, ignore it
const looksLocal = /^(http:\/\/|https:\/\/)?(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(BASE);
// In dev use vite proxy /api; in prod prefer remote origin BASE (append /api if missing)
// If BASE is not provided in prod, fall back to the Render backend
const baseURL = isDev
  ? '/api'
  : (BASE && !looksLocal ? (isProxyPath ? BASE : `${BASE}/api`) : 'https://newspulse-backend-real.onrender.com/api');

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// 🔐 Attach JWT token from localStorage to every request (if present)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// (Optional) Global error handling: redirect if unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Remove token, redirect to login page if needed
      localStorage.removeItem('adminToken');
  // ✅ Fix: redirect to /admin/login (avoid legacy /auth)
  window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
