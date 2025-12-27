const envAny = import.meta.env as any;
const API_BASE = (envAny.VITE_API_BASE_URL || envAny.VITE_BACKEND_URL || envAny.VITE_API_URL || '').toString().trim().replace(/\/+$/, '');
// Prefer direct backend base when available; fallback to local dev proxy base.
const ADMIN_API_BASE = API_BASE ? `${API_BASE}/api` : '/api';

export const join = (...parts: string[]) =>
  parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .join("/");

export async function adminFetch(path: string, init?: RequestInit) {
  const raw = (path ?? "").toString().trim();
  // Normalize: if base already includes '/api', strip a leading 'api/' so we don't generate '/api/api/*'.
  const baseHasApi = /\/api$/i.test(ADMIN_API_BASE);
  const normalizedPath = raw.replace(/^\/+/, "");
  const finalPath = baseHasApi ? normalizedPath.replace(/^api\//i, '') : normalizedPath;
  const url = ADMIN_API_BASE.startsWith('http')
    ? `${ADMIN_API_BASE.replace(/\/+$/, '')}/${finalPath.replace(/^\/+/, '')}`
    : `/${join(ADMIN_API_BASE, finalPath)}`;
  if (import.meta.env.DEV) console.log("[adminFetch]", url);

  // Always attach the latest token (survives refresh) unless caller already set Authorization.
  const authHeaders: Record<string, string> = {};
  try {
    const token = (typeof window !== 'undefined'
      ? (localStorage.getItem('np_token') || localStorage.getItem('token') || localStorage.getItem('adminToken'))
      : null);
    if (token && String(token).trim()) {
      authHeaders.Authorization = `Bearer ${String(token).replace(/^Bearer\s+/i, '')}`;
    }
  } catch {}

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(init?.headers as any),
  };

  // Respect explicit Authorization provided by caller.
  try {
    const h: any = init?.headers as any;
    if (h && (h.Authorization || h.authorization)) {
      delete mergedHeaders.Authorization;
    }
  } catch {}

  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: mergedHeaders,
  });
  // Unified 401/403 handling for fetch calls
  try {
    const shouldLogout = (() => {
      try {
        const p = typeof window !== 'undefined' ? new URL(url, window.location.origin).pathname : url;
        return p === '/api/auth/me' || p.startsWith('/api/admin/') || p.startsWith('/admin/');
      } catch {
        const s = (url || '').toString();
        return s.includes('/api/auth/me') || s.includes('/api/admin/') || s.includes('/admin/');
      }
    })();

    if (res.status === 401 && typeof window !== 'undefined' && shouldLogout) {
      try {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('np_admin_token');
        localStorage.removeItem('np_admin_access_token');
        localStorage.removeItem('np_token');
        localStorage.removeItem('newsPulseAdminAuth');
      } catch {}
      window.dispatchEvent(new CustomEvent('np:logout'));
    } else if (res.status === 403 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:ownerkey-required'));
    } else if ((res.status === 503 || res.status === 423) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:lockdown'));
    }
  } catch {}
  return res;
}

export async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await adminFetch(path, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text) return {} as any;
  try { return JSON.parse(text) as T; } catch { return {} as any; }
}
