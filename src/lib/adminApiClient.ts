import axios, { type AxiosInstance } from 'axios';
import { getAuthToken } from './api';
import { adminFetch, adminJson } from './http/adminFetch';

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
        (cfg as any).withCredentials = false;
      }
    }
  } catch {
    // ignore
  }
  return cfg;
});

export { adminFetch, adminJson };
