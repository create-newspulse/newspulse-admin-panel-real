import axios, { type AxiosInstance } from 'axios';
import { getAuthToken, setAuthToken } from './api';
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

let refreshInFlight: Promise<string | null> | null = null;
const REFRESH_TOKEN_STORAGE_KEY = 'admin_refresh_token';

function authRefreshUrl(): string {
  return '/admin-api/admin/refresh';
}

function extractToken(payload: any): string | null {
  const token = payload?.token || payload?.accessToken || payload?.data?.token || payload?.data?.accessToken || null;
  return token ? String(token).replace(/^Bearer\s+/i, '') : null;
}

function extractRefreshToken(payload: any): string | null {
  const token = payload?.refreshToken || payload?.data?.refreshToken || null;
  return token ? String(token).replace(/^Bearer\s+/i, '') : null;
}

function getStoredRefreshToken(): string | null {
  try {
    const direct = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (direct && direct.trim()) return direct.replace(/^Bearer\s+/i, '');
  } catch {}
  try {
    const raw = localStorage.getItem('newsPulseAdminAuth');
    const parsed = raw ? JSON.parse(raw) : null;
    const token = parsed?.refreshToken;
    if (token && String(token).trim()) return String(token).replace(/^Bearer\s+/i, '');
  } catch {}
  return null;
}

function setStoredRefreshToken(token: string | null): void {
  try {
    if (token && token.trim()) localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token.replace(/^Bearer\s+/i, ''));
    else localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {}
}

function clearStoredAdminAuth(): void {
  setAuthToken(null);
  setStoredRefreshToken(null);
  try { localStorage.removeItem('newsPulseAdminAuth'); } catch {}
  try { localStorage.removeItem('np_admin_token'); } catch {}
  try { localStorage.removeItem('np_admin_access_token'); } catch {}
  try { localStorage.removeItem('np_token'); } catch {}
  try { localStorage.removeItem('adminToken'); } catch {}
}

async function refreshAdminSession(): Promise<string | null> {
  if (!refreshInFlight) {
    const refreshToken = getStoredRefreshToken();
    refreshInFlight = axios.request({
      url: authRefreshUrl(),
      method: 'POST',
      withCredentials: true,
      headers: { Accept: 'application/json' },
      data: refreshToken ? { refreshToken } : undefined,
    }).then((response) => {
      const token = extractToken(response?.data);
      const nextRefreshToken = extractRefreshToken(response?.data);
      if (!token) throw new Error('Refresh response did not include an access token');
      if (token) setAuthToken(token);
      if (nextRefreshToken) setStoredRefreshToken(nextRefreshToken);
      return token;
    }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
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

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config || {};
    const originalUrl = config?.url || error?.response?.config?.url || '';
    const hasResponse = !!error?.response;

    if (!hasResponse) {
      try { (error as any).code = (error as any).code || 'BACKEND_OFFLINE'; } catch {}
      try { (error as any).message = 'Backend offline'; } catch {}
      return Promise.reject(error);
    }

    if (status === 401 && !config.__npRetriedAfterRefresh && !config.skipAuthRefresh) {
      try {
        const refreshedToken = await refreshAdminSession();
        config.__npRetriedAfterRefresh = true;
        config.headers = config.headers || {};
        if (refreshedToken) {
          config.headers.Authorization = `Bearer ${refreshedToken}`;
        }
        config.withCredentials = true;
        return adminApiClient.request(config);
      } catch (refreshError) {
        clearStoredAdminAuth();
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:logout')); } catch {}
        try { (error as any).refreshAttempted = true; } catch {}
        return Promise.reject(error);
      }
    }

    if (status === 401) {
      try { (error as any).refreshAttempted = !!config.__npRetriedAfterRefresh; } catch {}
    }
    if (status === 403) {
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:ownerkey-required')); } catch {}
    }
    try { (error as any).requestUrl = originalUrl; } catch {}
    return Promise.reject(error);
  }
);

export { adminFetch, adminJson };
