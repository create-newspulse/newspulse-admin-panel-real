// src/utils/apiFetch.ts

const PROD_BACKEND_BASE = 'https://newspulse-backend-real.onrender.com';

// Decide base URL:
// 1) If env vars are set, use them.
// 2) Otherwise:
//    - If running on localhost / LAN → local backend http://localhost:5000
//    - Else → production backend on Render
function resolveAdminApiBase(): string {
  const envBase =
    import.meta.env.VITE_ADMIN_API_URL ||
    import.meta.env.VITE_ADMIN_API_BASE_URL;

  if (envBase && typeof envBase === 'string') {
    return envBase.toString().trim().replace(/\/+$/, '');
  }

  const host = window.location.hostname;
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.');

  const fallback = isLocal ? 'http://localhost:5000' : PROD_BACKEND_BASE;

  return fallback.toString().trim().replace(/\/+$/, '');
}

// Single base constant used everywhere
const ADMIN_API_BASE = resolveAdminApiBase();

console.log(
  '[adminApi][config] ADMIN_API_BASE =',
  ADMIN_API_BASE,
  'VITE_ADMIN_API_URL =',
  import.meta.env.VITE_ADMIN_API_URL,
  'VITE_ADMIN_API_BASE_URL =',
  import.meta.env.VITE_ADMIN_API_BASE_URL
);

type ApiOptions = RequestInit & { headers?: Record<string, string> };

function resolveUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;

  const clean = url.startsWith('/') ? url : `/${url}`;

  // Direct origin base; avoid double '/api' if base already ends with '/api'
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
