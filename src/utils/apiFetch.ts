// src/utils/apiFetch.ts
// Single base constant: prod via VITE_ADMIN_API_URL; dev fallback '/admin-api'
const ADMIN_API_BASE = (
  (import.meta.env.VITE_ADMIN_API_URL ?? '/admin-api')
).toString().trim().replace(/\/+$/, '');

type ApiOptions = RequestInit & { headers?: Record<string, string> };

function resolveUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const clean = url.startsWith('/') ? url : `/${url}`;
  // Dev proxy base
  if (ADMIN_API_BASE === '/admin-api') return `${ADMIN_API_BASE}${clean}`;
  // Direct origin base; avoid double '/api' if base already ends with '/api'
  if (/\/api$/.test(ADMIN_API_BASE) && /^\/api\//.test(clean)) {
    return `${ADMIN_API_BASE}${clean.replace(/^\/api/, '')}`;
  }
  return `${ADMIN_API_BASE}${clean}`;
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
