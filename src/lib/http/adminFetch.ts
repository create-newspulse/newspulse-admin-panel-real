import { adminUrl, getAuthToken } from '@/lib/api';

export const ADMIN_API_BASE = adminUrl('/').replace(/\/+$/, '');

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

export function adminApiUrl(path: string): string {
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
    credentials: init.credentials ?? 'include',
  });

  // Align with existing global behaviors
  try {
    if (res.status === 401 && typeof window !== 'undefined') {
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
