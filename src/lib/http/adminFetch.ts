import { adminUrl, getAuthToken } from '@/lib/api';

const envAny = import.meta.env as any;

function stripTrailingSlashes(s: string) {
  return (s || '').replace(/\/+$/, '');
}

function isAbsoluteHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

function ensureApiBase(base: string): string {
  const b = stripTrailingSlashes((base || '').toString().trim());
  if (!b) return '';

  // Spec preference: VITE_ADMIN_API_BASE_URL should include '/api'.
  // Be tolerant if the user provides only an origin.
  if (isAbsoluteHttpUrl(b) && !/\/api$/i.test(b)) return `${b}/api`;
  return b;
}

function joinBase(base: string, path: string): string {
  const b = stripTrailingSlashes(base);
  const p = (path || '').startsWith('/') ? path : `/${path || ''}`;
  if (!b) return p;
  return `${b}${p}`.replace(/\/\/+/g, '/').replace(/^https:\/\//i, (m) => m); // keep scheme
}

function getAdminApiBaseOverride(): string | null {
  const raw = (envAny?.VITE_ADMIN_API_BASE_URL || '').toString().trim();
  if (!raw) return null;
  return ensureApiBase(raw);
}

export const ADMIN_API_BASE = (() => {
  const override = getAdminApiBaseOverride();
  if (override) return joinBase(override, '/admin');
  return adminUrl('/').replace(/\/+$/, '');
})();

export class AdminApiError extends Error {
  status: number;
  url: string;
  body?: unknown;

  constructor(message: string, opts: { status: number; url: string; body?: unknown }) {
    super(message);
    this.name = 'AdminApiError';
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
  }
}

function normalizePath(input: string): string {
  const raw = (input ?? '').toString().trim();
  let p = raw.startsWith('/') ? raw : `/${raw}`;
  // Allow callers to accidentally pass '/api/...'
  if (p === '/api') return '/';
  if (p.startsWith('/api/')) p = p.replace(/^\/api\//, '/');
  // Collapse double-prefix mistakes.
  p = p.replace(/^\/api\/api\//, '/');
  return p;
}

function normalizeAdminRest(path: string): string {
  // Produces a path relative to the admin root.
  // Accept '/admin/*', '/api/admin/*', or a bare segment like '/me'.
  let rest = normalizePath(path);
  if (rest === '/api/admin') rest = '/';
  if (rest.startsWith('/api/admin/')) rest = rest.replace(/^\/api\/admin\//, '/');
  if (rest === '/admin') rest = '/';
  if (rest.startsWith('/admin/')) rest = rest.replace(/^\/admin\//, '/');
  if (!rest.startsWith('/')) rest = `/${rest}`;
  return rest;
}

export function adminApiUrl(path: string): string {
  const override = getAdminApiBaseOverride();
  if (override) {
    const rest = normalizeAdminRest(path);
    const full = rest === '/' ? '/admin' : `/admin${rest}`;
    return joinBase(override, full);
  }

  const p = normalizePath(path);
  // adminUrl already prefixes '/admin'
  return adminUrl(p);
}

async function readBody(res: Response): Promise<unknown> {
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
  try {
    const text = await res.text();
    return text || undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const anyBody: any = body as any;
    const msg = anyBody?.message || anyBody?.error || anyBody?.details;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export type AdminFetchOptions = RequestInit & {
  json?: unknown;
};

export async function adminFetch(path: string, init: AdminFetchOptions = {}): Promise<Response> {
  const url = adminApiUrl(path);

  const headers = new Headers(init.headers || undefined);
  headers.set('Accept', 'application/json');

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body = init.body;
  if (typeof init.json !== 'undefined') {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body,
    // If we have an explicit Bearer token, cookies are typically unnecessary and
    // can trigger stricter CORS requirements in cross-origin direct mode.
    credentials: init.credentials ?? (token ? 'omit' : 'include'),
  });

  // Align with existing global behaviors
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
        localStorage.removeItem('newsPulseAdminAuth');
      } catch {}
      window.dispatchEvent(new CustomEvent('np:logout'));
    }
    if (res.status === 403 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:ownerkey-required'));
    }
    if ((res.status === 503 || res.status === 423) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np:lockdown'));
    }
  } catch {}

  return res;
}

export async function adminJson<T = any>(path: string, init: AdminFetchOptions = {}): Promise<T> {
  const res = await adminFetch(path, init);
  if (res.status === 204) return {} as any;

  if (!res.ok) {
    const body = await readBody(res);
    const msg = errorMessage(body, `HTTP ${res.status} ${res.statusText}`);
    throw new AdminApiError(msg, { status: res.status, url: adminApiUrl(path), body });
  }

  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    // Keep behavior predictable for callers expecting JSON
    const text = await res.text().catch(() => '');
    return (text as any) as T;
  }
  return (await res.json()) as T;
}
