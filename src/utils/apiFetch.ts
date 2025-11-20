// src/utils/apiFetch.ts
const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;

type ApiOptions = RequestInit & { headers?: Record<string, string> };

function resolveUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  // already full api path
  if (url.startsWith('/api/')) return `${API_ORIGIN}${url}`;
  // system or other root paths -> prefix /api
  if (url.startsWith('/')) return `${API_BASE}${url}`; // '/system/x' -> origin/api/system/x
  return `${API_BASE}/${url}`;
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
