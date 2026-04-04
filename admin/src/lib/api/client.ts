import axios from 'axios';

// Admin frontend should always talk to the backend via the Vercel proxy.
// This keeps auth/cookies consistent and avoids CORS surprises.
const API_BASE_URL = '/admin-api';

function isAbsoluteUrl(value?: string) {
  return /^https?:\/\//i.test(String(value || ''));
}

function normalizeProxyPath(url?: string) {
  const raw = String(url || '').trim();
  if (!raw || isAbsoluteUrl(raw)) return raw;

  if (raw === '/api/admin') return '/admin';
  if (raw.startsWith('/api/admin/')) return `/admin/${raw.slice('/api/admin/'.length)}`;
  if (raw === '/api') return '/';
  if (raw.startsWith('/api/')) return `/${raw.slice('/api/'.length)}`;
  if (raw === API_BASE_URL) return '/';
  if (raw.startsWith(`${API_BASE_URL}/`)) return raw.slice(API_BASE_URL.length) || '/';
  return raw;
}

function readStoredAdminToken() {
  try {
    const rawSession = localStorage.getItem('newsPulseAdminAuth');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed?.token && String(parsed.token).trim()) {
        return String(parsed.token).replace(/^Bearer\s+/i, '');
      }
    }
  } catch {}

  try {
    const legacyKeys = ['admin_token', 'np_token', 'np_admin_token', 'adminToken'];
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key);
      if (value && String(value).trim()) {
        return String(value).replace(/^Bearer\s+/i, '');
      }
    }
  } catch {}

  try {
    const cookie = typeof document !== 'undefined' ? String(document.cookie || '') : '';
    const match = cookie.match(/(?:^|;\s*)np_admin=([^;]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]).replace(/^Bearer\s+/i, '');
    }
  } catch {}

  return null;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  config.url = normalizeProxyPath(config.url);
  config.withCredentials = true;
  try {
    const token = readStoredAdminToken();
    if (token) {
      config.headers = config.headers || {};
      if (!(config.headers as any).Authorization) {
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
    }
  } catch {}
  return config;
});
