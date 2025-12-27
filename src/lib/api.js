import axios from "axios";

// NOTE: This file exists to support the simple “api” client pattern
// while also keeping compatibility with existing code that imports
// named exports from '@/lib/api' (implemented in api.ts).

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  let token = null;
  try {
    token = localStorage.getItem("np_token");
  } catch {}
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = "Bearer " + token;
  }
  return config;
});

function pathnameOf(u) {
  try {
    if (typeof window !== 'undefined') {
      return new URL(String(u || ''), window.location.origin).pathname;
    }
  } catch {}
  return String(u || '');
}

function shouldLogoutOn401(u) {
  const p = pathnameOf(u);
  return (
    p === '/api/auth/me' ||
    p.startsWith('/api/admin/') ||
    p === '/api/admin' ||
    p.startsWith('/admin/') ||
    p === '/admin'
  );
}

// Response handling:
// - 401: clear stored tokens and emit 'np:logout'
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || error?.response?.config?.url || '';
    if (status === 401 && shouldLogoutOn401(url)) {
      try {
        localStorage.removeItem('np_token');
        localStorage.removeItem('np_admin_token');
        localStorage.removeItem('np_admin_access_token');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('newsPulseAdminAuth');
      } catch {}
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('np:logout'));
        }
      } catch {}
    }
    return Promise.reject(error);
  }
);

export default api;

// Re-export the existing typed clients/helpers (adminApi, apiUrl, setAuthToken, etc.)
// so extensionless imports like `./api` keep working even though this file exists.
export * from './api.ts';
