import axios from 'axios';
import { resolveAdminSession } from '../authSession';

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

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  config.url = normalizeProxyPath(config.url);
  config.withCredentials = true;
  try {
    const token = resolveAdminSession().token;
    if (token) {
      config.headers = config.headers || {};
      if (!(config.headers as any).Authorization) {
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
    }
  } catch {}
  return config;
});
