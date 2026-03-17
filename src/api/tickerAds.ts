import { AdminApiError, adminFetch } from '@/lib/http/adminFetch';

export type TickerAdChannel = 'breaking' | 'live' | 'both';
export type TickerAdLanguage = 'en' | 'hi' | 'gu';
export type TickerAdDayPart = 'morning' | 'noon' | 'evening' | 'night';

export type TickerAd = {
  id: string;
  message: string;
  url?: string;
  channel: TickerAdChannel;
  language: TickerAdLanguage;
  dayParts: TickerAdDayPart[];
  startAt: string;
  endAt: string;
  active: boolean;
  priority: number;
  frequency: number;
  createdAt?: string;
  updatedAt?: string;
};

export type TickerAdMutation = {
  message: string;
  url?: string;
  channel: TickerAdChannel;
  language: TickerAdLanguage;
  dayParts: TickerAdDayPart[];
  startAt: string;
  endAt: string;
  active: boolean;
  priority: number;
  frequency: number;
};

const BASE = '/admin-api/broadcast/ticker-ads';

type FetchOpts = RequestInit & { json?: unknown };

function readBody(res: Response): Promise<unknown> {
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('application/json')) {
    return res.json().catch(() => undefined);
  }
  return res.text().then((text) => text || undefined).catch(() => undefined);
}

function errorMessage(body: unknown, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const anyBody: any = body;
    const message = anyBody?.message || anyBody?.error || anyBody?.details;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  return fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeLanguage(value: unknown): TickerAdLanguage {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'hi') return 'hi';
  if (normalized === 'gu') return 'gu';
  return 'en';
}

function normalizeChannel(value: unknown): TickerAdChannel {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'breaking') return 'breaking';
  if (normalized === 'live' || normalized === 'live-updates' || normalized === 'live_updates') return 'live';
  return 'both';
}

function normalizeDayPart(value: unknown): TickerAdDayPart | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'morning') return 'morning';
  if (normalized === 'noon') return 'noon';
  if (normalized === 'evening') return 'evening';
  if (normalized === 'night') return 'night';
  return null;
}

function normalizeDayParts(value: unknown): TickerAdDayPart[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[|,]/g)
      : [];

  const unique = new Set<TickerAdDayPart>();
  for (const raw of rawValues) {
    const normalized = normalizeDayPart(raw);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function normalizeIso(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toISOString();
}

function parseItemsArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.items)) return input.items;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.data?.items)) return input.data.items;
  return [];
}

function extractItem(input: any): any | null {
  if (!input || typeof input !== 'object') return null;
  if (input.item && typeof input.item === 'object') return input.item;
  if (input.data && typeof input.data === 'object' && !Array.isArray(input.data)) return input.data;
  if (input.id || input._id || input.adId || input.tickerAdId) return input;
  return null;
}

function normalizeTickerAd(raw: any): TickerAd {
  const id = String(raw?.id ?? raw?._id ?? raw?.adId ?? raw?.tickerAdId ?? '');
  return {
    id,
    message: String(raw?.message ?? raw?.text ?? raw?.copy ?? '').trim(),
    url: String(raw?.url ?? raw?.href ?? '').trim() || undefined,
    channel: normalizeChannel(raw?.channel ?? raw?.placement ?? raw?.type),
    language: normalizeLanguage(raw?.language ?? raw?.lang),
    dayParts: normalizeDayParts(raw?.dayParts ?? raw?.dayparts),
    startAt: normalizeIso(raw?.startAt ?? raw?.start ?? raw?.startsAt ?? raw?.startDate),
    endAt: normalizeIso(raw?.endAt ?? raw?.end ?? raw?.endsAt ?? raw?.endDate),
    active: normalizeBoolean(raw?.active ?? raw?.isActive ?? raw?.enabled, true),
    priority: clampInteger(raw?.priority ?? raw?.weight, 0, -999, 999),
    frequency: clampInteger(raw?.frequency ?? raw?.everyNItems ?? raw?.interval, 1, 1, 10),
    createdAt: normalizeIso(raw?.createdAt),
    updatedAt: normalizeIso(raw?.updatedAt),
  };
}

function normalizeTickerAds(items: any[]): TickerAd[] {
  return (items || []).map(normalizeTickerAd);
}

async function requestJson<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const method = String(opts.method || 'GET').toUpperCase();
  const headers = new Headers(opts.headers || undefined);
  headers.set('Accept', headers.get('Accept') || 'application/json');

  let body = opts.body;
  if (typeof opts.json !== 'undefined') {
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    body = JSON.stringify(opts.json);
  }

  const res = await adminFetch(url, { ...opts, method, headers, body } as any);
  if (res.status === 204) return {} as T;

  if (!res.ok) {
    const bodyValue = await readBody(res.clone());
    throw new AdminApiError(errorMessage(bodyValue, `HTTP ${res.status} ${res.statusText}`), {
      status: res.status,
      url: res.url || url,
      body: bodyValue,
    });
  }

  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!ctype.includes('application/json')) {
    return (await res.text().catch(() => '')) as T;
  }
  return (await res.json()) as T;
}

export async function listTickerAds(): Promise<TickerAd[]> {
  const raw = await requestJson<any>(BASE, { method: 'GET', cache: 'no-store' } as any);
  return normalizeTickerAds(parseItemsArray(raw));
}

export async function createTickerAd(payload: TickerAdMutation): Promise<TickerAd | null> {
  const raw = await requestJson<any>(BASE, { method: 'POST', json: payload });
  const item = extractItem(raw);
  return item ? normalizeTickerAd(item) : null;
}

export async function updateTickerAd(id: string, payload: TickerAdMutation): Promise<TickerAd | null> {
  const url = `${BASE}/${encodeURIComponent(id)}`;
  try {
    const raw = await requestJson<any>(url, { method: 'PATCH', json: payload });
    const item = extractItem(raw);
    return item ? normalizeTickerAd(item) : null;
  } catch (error) {
    if (!(error instanceof AdminApiError) || error.status !== 405) throw error;
  }

  const raw = await requestJson<any>(url, { method: 'PUT', json: payload });
  const item = extractItem(raw);
  return item ? normalizeTickerAd(item) : null;
}

export async function deleteTickerAd(id: string): Promise<void> {
  await requestJson(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}