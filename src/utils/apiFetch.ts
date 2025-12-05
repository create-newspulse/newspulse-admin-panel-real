/// src/utils/apiFetch.ts

// Admin API base resolution
// - Production: `VITE_ADMIN_API_URL` or `VITE_ADMIN_API_BASE_URL` (Render backend URL)
// - Development: fallback to `http://localhost:5000`
const ADMIN_API_BASE = (
  import.meta.env.VITE_ADMIN_API_URL ||
  import.meta.env.VITE_ADMIN_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'https://newspulse-backend-real.onrender.com')
)
  .toString()
  .trim()
  .replace(/\/+$/, '');

console.log('[adminApi][config] ADMIN_API_BASE =', ADMIN_API_BASE);

type ApiOptions = RequestInit & { headers?: Record<string, string> };

function resolveUrl(url: string) {
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
