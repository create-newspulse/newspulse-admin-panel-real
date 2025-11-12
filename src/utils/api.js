import axios from 'axios';
// Consistent API base selection with a safe production fallback
const isDev = import.meta.env.MODE === 'development';
const RAW_BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE ?? '') + '';
const BASE = RAW_BASE.replace(/\/$/, '');
const isProxyPath = BASE.startsWith('/admin-api');
// If BASE looks like localhost/127.* in a production build, ignore it
const looksLocal = /^(http:\/\/|https:\/\/)?(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(BASE);
// In dev use vite proxy /api; in prod prefer:
//  - explicit BASE (no suffix) if it's our proxy path (/admin-api)
//  - BASE/api if it's a remote origin
//  - otherwise fall back to our secure vercel proxy at /admin-api
const baseURL = isDev
    ? '/api'
    : (BASE && !looksLocal ? (isProxyPath ? BASE : `${BASE}/api`) : '/admin-api');
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
api.interceptors.response.use((response) => response, (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        // Remove token, redirect to login page if needed
        localStorage.removeItem('adminToken');
    // ✅ Fixed: redirect to /login instead of legacy /auth.
    window.location.href = '/login';
    }
    return Promise.reject(error);
});
export default api;
