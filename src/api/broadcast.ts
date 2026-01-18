import { AdminApiError, adminFetch } from '@/lib/http/adminFetch';
import type { BroadcastItem, BroadcastType } from '@/lib/broadcastApi';

const PROXY_BASE = '/admin-api';
const BASE = `${PROXY_BASE}/admin/broadcast`;

type FetchOpts = RequestInit & { json?: unknown };

async function readBody(res: Response): Promise<unknown> {
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
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
    const anyBody: any = body;
    const msg = anyBody?.message || anyBody?.error || anyBody?.details;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

function parseItemsArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.items)) return input.items;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.data?.items)) return input.data.items;
  return [];
}

function normalizeItem(it: any): BroadcastItem {
  const id = it?.id ?? it?._id;
  const _id = it?._id ?? it?.id;
  return { ...it, id, _id } as BroadcastItem;
}

function normalizeItems(items: any[]): BroadcastItem[] {
  return (items || []).map(normalizeItem);
}

async function requestJson<T = any>(path: string, opts: FetchOpts = {}): Promise<T> {
  const method = (opts.method || 'GET').toString().toUpperCase();
  const headers = new Headers(opts.headers || undefined);
  headers.set('Accept', headers.get('Accept') || 'application/json');

  let body = opts.body as any;
  if (typeof opts.json !== 'undefined') {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  }

  const url = `${BASE}${path}`;
  const res = await adminFetch(url, { ...opts, method, headers, body } as any);

  if (res.status === 204) return {} as any;

  if (!res.ok) {
    const bodyVal = await readBody(res.clone());
    const msg = errorMessage(bodyVal, `HTTP ${res.status} ${res.statusText}`);
    throw new AdminApiError(msg, { status: res.status, url: res.url || url, body: bodyVal });
  }

  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!ctype.includes('application/json')) {
    const text = await res.text().catch(() => '');
    return (text as any) as T;
  }
  return (await res.json()) as T;
}

export async function getBroadcastConfig(): Promise<any> {
  return requestJson<any>('', { method: 'GET', cache: 'no-store' } as any);
}

export async function saveBroadcastConfig(payload: any): Promise<any> {
  return requestJson<any>('', { method: 'PUT', json: payload });
}

export async function listItems(type: BroadcastType): Promise<BroadcastItem[]> {
  const raw = await requestJson<any>(`/items?type=${encodeURIComponent(type)}`, { method: 'GET', cache: 'no-store' } as any);
  return normalizeItems(parseItemsArray(raw));
}

export async function listItemsByLang(type: BroadcastType, lang: string): Promise<BroadcastItem[]> {
  const qs = new URLSearchParams({ type, lang: String(lang || '').trim() || 'en' });
  const raw = await requestJson<any>(`/items?${qs.toString()}`, { method: 'GET', cache: 'no-store' } as any);
  return normalizeItems(parseItemsArray(raw));
}

export async function addItem(type: BroadcastType, text: string): Promise<BroadcastItem | null> {
  let raw: any;
  try {
    raw = await requestJson<any>('/items', {
      method: 'POST',
      json: { type, text },
    });
  } catch (e: any) {
    // Back-compat: some backends expect the type in query params and only accept text in the body.
    if (e instanceof AdminApiError && e.status === 405) {
      raw = await requestJson<any>(`/items?type=${encodeURIComponent(type)}`, {
        method: 'POST',
        json: { type, text },
      });
    } else {
      throw e;
    }
  }

  const candidate = (() => {
    const r: any = raw as any;
    if (r && typeof r === 'object') {
      if (r.item && typeof r.item === 'object') return r.item;
      if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) return r.data;
    }
    if (r && typeof r === 'object' && (r.id || r._id)) return r;
    return null;
  })();

  return candidate ? normalizeItem(candidate) : null;
}

export async function addItemByLang(
  type: BroadcastType,
  text: string,
  lang: string,
  opts: { autoTranslate?: boolean } = {}
): Promise<BroadcastItem | null> {
  const safeLang = String(lang || '').trim() || 'en';
  const extra = typeof opts.autoTranslate === 'boolean' ? { autoTranslate: opts.autoTranslate } : {};

  let raw: any;
  try {
    raw = await requestJson<any>('/items', {
      method: 'POST',
      json: { type, text, lang: safeLang, ...extra },
    });
  } catch (e: any) {
    // Back-compat: some backends route by query instead of body.
    if (e instanceof AdminApiError && e.status === 405) {
      const qs = new URLSearchParams({ type: String(type), lang: safeLang });
      raw = await requestJson<any>(`/items?${qs.toString()}`, {
        method: 'POST',
        json: { type, text, lang: safeLang, ...extra },
      });
    } else {
      throw e;
    }
  }

  const candidate = (() => {
    const r: any = raw as any;
    if (r && typeof r === 'object') {
      if (r.item && typeof r.item === 'object') return r.item;
      if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) return r.data;
    }
    if (r && typeof r === 'object' && (r.id || r._id)) return r;
    return null;
  })();

  return candidate ? normalizeItem(candidate) : null;
}

export async function deleteItem(id: string): Promise<void> {
  await requestJson(`/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
