// src/utils/apiFetch.ts
import { API_BASE_PATH } from '@lib/api';

type ApiOptions = RequestInit & { headers?: Record<string, string> };

function resolveUrl(url: string) {
  // If caller mistakenly prefixes with '/api' and our base already ends with '/api', drop duplication
  const baseEndsWithApi = /\/api$/i.test(API_BASE_PATH.replace(/\/$/, ''));
  if (baseEndsWithApi && url.startsWith('/api/')) {
    url = url.slice(4); // remove the leading '/api'
  }
  // Route backend system calls via resolved base in production
  if (url.startsWith('/system/')) {
    return `${API_BASE_PATH.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  // For absolute or already-resolved URLs, return as-is
  return url;
}

export async function apiFetch<T = any>(url: string, options: ApiOptions = {}): Promise<T> {
  const finalUrl = resolveUrl(url);
  const res = await fetch(finalUrl, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
