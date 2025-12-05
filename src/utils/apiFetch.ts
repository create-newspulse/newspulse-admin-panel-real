// src/utils/apiFetch.ts

// Unified base URL resolution with prod safety (no localhost fallback in prod)
const _rawBase =
  (import.meta.env as any).VITE_ADMIN_API_URL ||
  (import.meta.env as any).VITE_API_URL ||
  ((import.meta.env as any).DEV ? 'http://localhost:10000' : '');

if (!_rawBase) {
  try { console.error('[apiFetch] Missing VITE_ADMIN_API_URL in production build'); } catch {}
  throw new Error('Missing admin API base URL');
}

const ADMIN_API_BASE = _rawBase.toString().replace(/\/+$/, '');

console.log('[adminApi][config] ADMIN_API_BASE =', ADMIN_API_BASE);

type ApiOptions = RequestInit & { headers?: Record<string, string> };

function resolveUrl(url: string) {
  // Full URLs pass through
  if (/^https?:\/\//i.test(url)) return url;

  const clean = url.startsWith('/') ? url : `/${url}`;

  // Avoid double '/api' if base already ends with '/api'
  if (/\/api$/.test(ADMIN_API_BASE) && /^\/api\//.test(clean)) {
    return `${ADMIN_API_BASE}${clean.replace(/^\/api/, '')}`;
  }

  return `${ADMIN_API_BASE}${clean}`;
}

export async function apiFetch<T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  const finalUrl = resolveUrl(url);

  const res = await fetch(finalUrl, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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
