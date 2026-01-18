// src/utils/apiFetch.ts

import { apiUrl, adminUrl, getAuthToken } from '@/lib/api';

type ApiOptions = RequestInit & { headers?: Record<string, string> };

const stripTrailingSlashes = (s: string) => (s || '').replace(/\/+$/, '');
const ADMIN_API_BASE = stripTrailingSlashes((import.meta.env.VITE_ADMIN_API_BASE || '').toString().trim());

function resolveUrl(url: string) {
  // Full URLs pass through
  if (/^https?:\/\//i.test(url)) return url;

  const clean = url.startsWith('/') ? url : `/${url}`;

  // Production contract: keep '/admin-api/*' and '/api/*' relative.
  // Absolute admin API bases are intentionally not supported here.

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
