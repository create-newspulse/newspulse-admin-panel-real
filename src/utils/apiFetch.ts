// src/utils/apiFetch.ts

import { apiUrl, adminUrl, getAuthToken } from '@/lib/api';

type ApiOptions = RequestInit & { headers?: Record<string, string> };

const stripTrailingSlashes = (s: string) => (s || '').replace(/\/+$/, '');
const RAW_ADMIN_API_BASE = stripTrailingSlashes((import.meta.env.VITE_ADMIN_API_BASE || '').toString().trim());
// DEV safety: never let localhost dev talk to production origins directly.
// Keep requests same-origin so Vite proxy can route them to the local backend.
const ADMIN_API_BASE = import.meta.env.DEV ? '' : RAW_ADMIN_API_BASE;

function resolveUrl(url: string) {
  // Full URLs pass through
  if (/^https?:\/\//i.test(url)) return url;

  const clean = url.startsWith('/') ? url : `/${url}`;

  // Production base support: allow calling relative '/api/*' or '/admin-api/*'
  // while still supporting proxy mode in dev when ADMIN_API_BASE is empty.
  if (ADMIN_API_BASE && (clean.startsWith('/api/') || clean === '/api' || clean.startsWith('/admin-api/') || clean === '/admin-api')) {
    return `${ADMIN_API_BASE}${clean}`.replace(/([^:]\/)\/+?/g, '$1');
  }

  if (clean.startsWith('/admin/')) return adminUrl(clean);
  if (clean.startsWith('/api/')) return apiUrl(clean);
  // Default to public API
  return apiUrl(clean);
}

export async function apiFetch<T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  const finalUrl = resolveUrl(url);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach token for admin-protected endpoints.
  try {
    const isAdmin = typeof url === 'string' && (url.startsWith('/admin/') || finalUrl.includes('/admin/'));
    if (isAdmin && !headers.Authorization) {
      const token = getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
  } catch {}

  const res = await fetch(finalUrl, {
    credentials: 'include',
    headers,
    ...options,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    const txt = await res.text().catch(() => '');
    throw new Error(`Invalid server response. Body: ${txt.slice(0, 200)}`);
  }

  if (!res.ok) throw new Error(data?.message || 'Unknown error');
  return data;
}
