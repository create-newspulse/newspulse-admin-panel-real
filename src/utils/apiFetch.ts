// src/utils/apiFetch.ts

import { apiUrl, adminUrl, getAuthToken } from '@/lib/api';

type ApiOptions = RequestInit & { headers?: Record<string, string> };

const stripTrailingSlashes = (s: string) => (s || '').replace(/\/+$/, '');
const RAW_DIRECT_ORIGIN = stripTrailingSlashes(
  (import.meta.env.VITE_ADMIN_API_ORIGIN || '').toString().trim()
);
const RAW_ADMIN_API_BASE = stripTrailingSlashes((import.meta.env.VITE_ADMIN_API_BASE || '').toString().trim());
const DIRECT_ORIGIN = /^https?:\/\//i.test(RAW_DIRECT_ORIGIN)
  ? RAW_DIRECT_ORIGIN
  : (/^https?:\/\//i.test(RAW_ADMIN_API_BASE) ? RAW_ADMIN_API_BASE : '');

const originRoot = (() => {
  const b = stripTrailingSlashes(DIRECT_ORIGIN);
  const lower = b.toLowerCase();
  if (lower.endsWith('/api/admin')) return b.slice(0, -('/api/admin'.length));
  if (lower.endsWith('/api')) return b.slice(0, -('/api'.length));
  return b;
})();
const apiRoot = originRoot ? `${originRoot}/api` : '';

function resolveUrl(url: string) {
  // Full URLs pass through
  if (/^https?:\/\//i.test(url)) return url;

  const clean = url.startsWith('/') ? url : `/${url}`;

  // Direct mode: map proxy paths to the real backend /api/*.
  // Example: '/admin-api/admin/broadcast/items' -> 'https://backend.tld/api/admin/broadcast/items'
  if (DIRECT_ORIGIN && (clean === '/admin-api' || clean.startsWith('/admin-api/'))) {
    const rest = clean === '/admin-api' ? '' : clean.slice('/admin-api/'.length);
    const joined = rest ? `${apiRoot}/${rest}` : `${apiRoot}`;
    return joined.replace(/([^:]\/)\/+?/g, '$1');
  }
  if (DIRECT_ORIGIN && (clean === '/api' || clean.startsWith('/api/'))) {
    const joined = `${originRoot}${clean}`;
    return joined.replace(/([^:]\/)\/+?/g, '$1');
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
