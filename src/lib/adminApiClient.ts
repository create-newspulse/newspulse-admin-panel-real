import axios, { type AxiosInstance } from 'axios';
import { getAuthToken } from './api';
import { adminFetch, adminJson } from './http/adminFetch';

function isAbsoluteUrl(value?: string) {
  return /^https?:\/\//i.test(String(value || ''));
}

function normalizeAdminClientPath(url?: string) {
  const raw = String(url || '').trim();
  if (!raw || isAbsoluteUrl(raw)) return raw;
  if (raw === '/api/admin') return '/admin';
  if (raw.startsWith('/api/admin/')) return `/admin/${raw.slice('/api/admin/'.length)}`;
  if (raw === '/api') return '/';
  if (raw.startsWith('/api/')) return `/${raw.slice('/api/'.length)}`;
  return raw;
}

export function getToken(): string | null {
  return getAuthToken();
}

// Single axios client for admin requests.
// All admin/article requests must go through the same-origin proxy path: /admin-api/*
export const adminApiClient: AxiosInstance = axios.create({
  baseURL: '/admin-api',
  withCredentials: true,
});

adminApiClient.interceptors.request.use((cfg) => {
  cfg.url = normalizeAdminClientPath(cfg.url);
  try {
    const token = getAuthToken();
    if (token) {
      cfg.headers = cfg.headers || {};
      const h: any = cfg.headers as any;
      if (!h.Authorization && !h.authorization) {
        h.Authorization = `Bearer ${token}`;
      }

      // In direct (cross-origin) mode, sending cookies is usually unnecessary when
      // we already have a Bearer token. Keep parity with main api client.
      if (typeof (cfg as any).withCredentials === 'undefined') {
        (cfg as any).withCredentials = true;
      }
    }
  } catch {
    // ignore
  }
  return cfg;
});

export { adminFetch, adminJson };
