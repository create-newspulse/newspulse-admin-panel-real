import { AdminApiError, adminFetch, adminJson, adminPost } from '@/lib/http/adminFetch';

export const ADS_INQUIRIES_BASE = '/admin-api/ads/inquiries';
const DEFAULT_LOCAL_ADMIN_API_TARGET = 'http://localhost:5000';

export type AdInquiry = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  status: string;
  hasReply?: boolean;
  lastRepliedAt?: string;
  lastRepliedBy?: string;
  replyCount?: number;
  lastReplySubject?: string;
};

export type AdInquiryStatus = 'new' | 'read' | 'deleted';

export type AdInquiryListResult = {
  items: AdInquiry[];
  total: number | null;
  raw: unknown;
  source: string;
};

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function asOptionalNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeInquiry(raw: any): AdInquiry {
  const id = asString(raw?._id ?? raw?.id);
  const name = asString(raw?.name ?? raw?.fullName ?? raw?.full_name);
  const email = asString(raw?.email);
  const message = asString(raw?.message ?? raw?.body ?? raw?.text);
  const createdAt = asString(raw?.createdAt ?? raw?.created_at ?? raw?.submittedAt ?? raw?.submitted_at);
  const status = asString(raw?.status ?? raw?.state ?? 'new');
  const lastRepliedAt = asString(raw?.lastRepliedAt ?? raw?.last_replied_at);
  const lastRepliedBy = asString(raw?.lastRepliedBy ?? raw?.last_replied_by ?? raw?.repliedBy ?? raw?.replyBy);
  const replyCount = asOptionalNumber(raw?.replyCount ?? raw?.reply_count ?? raw?.repliesCount ?? raw?.replies_count);
  const lastReplySubject = asString(raw?.lastReplySubject ?? raw?.last_reply_subject ?? raw?.replySubject ?? raw?.last_subject);
  const hasReplyFallback = Boolean(lastRepliedAt || lastReplySubject || ((replyCount ?? 0) > 0));
  const hasReply = Boolean(raw?.hasReply ?? raw?.has_reply ?? hasReplyFallback);
  return { id, name, email, message, createdAt, status, hasReply, lastRepliedAt, lastRepliedBy, replyCount, lastReplySubject };
}

function inquiryUrl(path = ''): string {
  const suffix = String(path || '').trim();
  if (!suffix) return ADS_INQUIRIES_BASE;
  return `${ADS_INQUIRIES_BASE}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

async function readMutationBody(response: Response): Promise<unknown> {
  if (response.status === 204) return {};

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    const text = await response.text();
    return text || undefined;
  } catch {
    return undefined;
  }
}

function mutationErrorMessage(body: unknown, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === 'string') return body;

  const anyBody = body as any;
  const message = anyBody?.message ?? anyBody?.error ?? anyBody?.details;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

async function runInquiryMutation<T>(args: {
  action: string;
  method: 'PATCH' | 'DELETE';
  path: string;
  json?: unknown;
}): Promise<T> {
  const url = inquiryUrl(args.path);

  if (import.meta.env.DEV) {
    logAdsInquiriesDiagnostic(args.action, {
      url,
      method: args.method,
      message: 'Mutation request started',
    });
  }

  try {
    const response = await adminFetch(url, {
      method: args.method,
      json: args.json,
    });
    const raw = await readMutationBody(response);

    if (import.meta.env.DEV) {
      logAdsInquiriesDiagnostic(args.action, {
        url,
        method: args.method,
        status: response.status,
        raw,
      });
    }

    if (!response.ok) {
      throw new AdminApiError(
        mutationErrorMessage(raw, `HTTP ${response.status} ${response.statusText}`),
        {
          status: response.status,
          url,
          body: raw,
          code: response.status === 503 ? 'DB_UNAVAILABLE' : undefined,
        }
      );
    }

    return (raw ?? { ok: true }) as T;
  } catch (err: any) {
    if (import.meta.env.DEV) {
      logAdsInquiriesDiagnostic(args.action, {
        url,
        method: args.method,
        status: typeof err?.status === 'number' ? err.status : undefined,
        code: err?.code,
        message: err?.message || 'Mutation request failed',
      });
    }
    throw err;
  }
}

export function getAdsInquiriesAdminApiTarget(): string {
  const env = (import.meta as any)?.env || {};
  return String(
    env.VITE_ADMIN_API_TARGET
    || env.VITE_DEV_PROXY_TARGET
    || env.VITE_BACKEND_ORIGIN
    || DEFAULT_LOCAL_ADMIN_API_TARGET
  ).trim();
}

export function logAdsInquiriesDiagnostic(action: string, detail: {
  url?: string;
  method?: string;
  status?: number;
  message?: string;
  code?: string;
  raw?: unknown;
  source?: string;
} = {}): void {
  if (!import.meta.env.DEV) return;
  try {
    // eslint-disable-next-line no-console
    console.warn('[AdsManager:api]', {
      action,
      adminApiTarget: getAdsInquiriesAdminApiTarget(),
      requestUrl: detail.url,
      requestMethod: detail.method,
      responseStatus: detail.status,
      code: detail.code,
      source: detail.source,
      message: detail.message,
      raw: detail.raw,
    });
  } catch {
    // ignore
  }
}

function pickInquiryArray(raw: any): { list: any[]; source: string } {
  if (Array.isArray(raw)) return { list: raw, source: 'root' };
  if (Array.isArray(raw?.inquiries)) return { list: raw.inquiries, source: 'inquiries' };
  if (Array.isArray(raw?.items)) return { list: raw.items, source: 'items' };
  if (Array.isArray(raw?.rows)) return { list: raw.rows, source: 'rows' };
  if (Array.isArray(raw?.results)) return { list: raw.results, source: 'results' };
  if (Array.isArray(raw?.records)) return { list: raw.records, source: 'records' };
  if (Array.isArray(raw?.data?.inquiries)) return { list: raw.data.inquiries, source: 'data.inquiries' };
  if (Array.isArray(raw?.data?.items)) return { list: raw.data.items, source: 'data.items' };
  if (Array.isArray(raw?.data?.rows)) return { list: raw.data.rows, source: 'data.rows' };
  if (Array.isArray(raw?.data?.results)) return { list: raw.data.results, source: 'data.results' };
  if (Array.isArray(raw?.data?.records)) return { list: raw.data.records, source: 'data.records' };
  if (Array.isArray(raw?.data)) return { list: raw.data, source: 'data' };
  return { list: [], source: 'none' };
}

function pickInquiryTotal(raw: any, fallbackLength: number): number | null {
  const total = raw?.total ?? raw?.count ?? raw?.totalCount ?? raw?.pagination?.total ?? raw?.data?.total ?? raw?.data?.count ?? raw?.data?.totalCount;
  const n = Number(total);
  if (Number.isFinite(n)) return n;
  return fallbackLength;
}

export async function getAdInquiriesUnreadCount(opts?: { signal?: AbortSignal }): Promise<number> {
  const raw = await adminJson<any>(inquiryUrl('/unread-count'), { method: 'GET', signal: opts?.signal });
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  const count = raw?.count ?? raw?.unread ?? raw?.unreadCount ?? raw?.data?.count ?? raw?.data?.unreadCount;
  const n = Number(count);
  return Number.isFinite(n) ? n : 0;
}

export async function getAdInquiryStatusCount(status: AdInquiryStatus, opts?: { signal?: AbortSignal }): Promise<number> {
  const qs = new URLSearchParams({ status, page: '1', limit: '1', search: '' });
  const url = `${inquiryUrl()}?${qs.toString()}`;
  const raw = await adminJson<any>(url, { method: 'GET', signal: opts?.signal });
  const extracted = pickInquiryArray(raw);
  const total = pickInquiryTotal(raw, extracted.list.length);
  return typeof total === 'number' && Number.isFinite(total) ? total : extracted.list.length;
}

export async function listAdInquiries(args: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
  signal?: AbortSignal;
}): Promise<AdInquiryListResult> {
  const qs = new URLSearchParams();
  if (args.status) qs.set('status', args.status);
  if (typeof args.page === 'number') qs.set('page', String(args.page));
  if (typeof args.limit === 'number') qs.set('limit', String(args.limit));
  if (typeof args.search === 'string') qs.set('search', args.search);

  const url = `${inquiryUrl()}${qs.toString() ? `?${qs.toString()}` : ''}`;
  const raw = await adminJson<any>(url, { method: 'GET', signal: args.signal });
  const extracted = pickInquiryArray(raw);
  const items = (extracted.list as any[])
    .map(normalizeInquiry)
    .filter((it) => Boolean(it.id));
  const total = pickInquiryTotal(raw, items.length);

  if (import.meta.env.DEV) {
    logAdsInquiriesDiagnostic('list:raw-response', {
      url,
      source: extracted.source,
      raw,
      message: `Parsed ${items.length} inquiries from ${extracted.source}`,
    });
  }

  return { items, total, raw, source: extracted.source };
}

export async function markAdInquiryRead(id: string): Promise<AdInquiry | { ok: true } | unknown> {
  const safeId = encodeURIComponent(String(id));
  const raw = await runInquiryMutation<any>({
    action: 'mark-read',
    method: 'PATCH',
    path: `/${safeId}/read`,
  });

  const inquiry = raw?.inquiry ?? raw?.data?.inquiry ?? raw?.data ?? raw;
  if (inquiry && typeof inquiry === 'object' && (inquiry.id || inquiry._id)) {
    return normalizeInquiry(inquiry);
  }

  return raw ?? { ok: true };
}

export async function moveAdInquiryToTrash(id: string): Promise<AdInquiry | { ok: true } | unknown> {
  const safeId = encodeURIComponent(String(id));
  const raw = await runInquiryMutation<any>({
    action: 'move-to-trash',
    method: 'PATCH',
    path: `/${safeId}/trash`,
  });

  const inquiry = raw?.inquiry ?? raw?.data?.inquiry ?? raw?.data ?? raw;
  if (inquiry && typeof inquiry === 'object' && (inquiry.id || inquiry._id)) {
    return normalizeInquiry(inquiry);
  }

  return raw ?? { ok: true };
}

export async function deleteAdInquiry(id: string): Promise<AdInquiry | { ok: true } | unknown> {
  return moveAdInquiryToTrash(id);
}

export async function restoreAdInquiry(id: string): Promise<AdInquiry | { ok: true } | unknown> {
  const safeId = encodeURIComponent(String(id));
  const raw = await runInquiryMutation<any>({
    action: 'restore',
    method: 'PATCH',
    path: `/${safeId}/restore`,
  });

  const inquiry = raw?.inquiry ?? raw?.data?.inquiry ?? raw?.data ?? raw;
  if (inquiry && typeof inquiry === 'object' && (inquiry.id || inquiry._id)) {
    return normalizeInquiry(inquiry);
  }

  return raw ?? { ok: true };
}

export async function markAdInquiriesRead(ids: string[]): Promise<{ ok: true } | unknown> {
  const safeIds = ids.map((id) => String(id || '').trim()).filter(Boolean);
  return runInquiryMutation<any>({
    action: 'bulk-mark-read',
    method: 'PATCH',
    path: '/bulk/read',
    json: { ids: safeIds },
  });
}

export async function moveAdInquiriesToTrash(ids: string[]): Promise<{ ok: true } | unknown> {
  const safeIds = ids.map((id) => String(id || '').trim()).filter(Boolean);
  return runInquiryMutation<any>({
    action: 'bulk-move-to-trash',
    method: 'PATCH',
    path: '/bulk/trash',
    json: { ids: safeIds },
  });
}

export async function restoreAdInquiries(ids: string[]): Promise<{ ok: true } | unknown> {
  const safeIds = ids.map((id) => String(id || '').trim()).filter(Boolean);
  return runInquiryMutation<any>({
    action: 'bulk-restore',
    method: 'PATCH',
    path: '/bulk/restore',
    json: { ids: safeIds },
  });
}

export async function permanentlyDeleteAdInquiries(ids: string[]): Promise<{ ok: true } | unknown> {
  const safeIds = ids.map((id) => String(id || '').trim()).filter(Boolean);
  return runInquiryMutation<any>({
    action: 'bulk-permanent-delete',
    method: 'DELETE',
    path: '/bulk/permanent',
    json: { ids: safeIds },
  });
}

export async function permanentlyDeleteAdInquiry(id: string): Promise<{ ok: true } | unknown> {
  const safeId = encodeURIComponent(String(id));
  return runInquiryMutation<any>({
    action: 'permanent-delete',
    method: 'DELETE',
    path: `/${safeId}/permanent`,
  });
}

export type AdInquiryReplyPayload = {
  subject: string;
  message: string;
};

export async function replyToAdInquiry(id: string, payload: AdInquiryReplyPayload): Promise<any> {
  const safeId = encodeURIComponent(String(id));

  // Contract (must be exact):
  //   POST /admin-api/ads/inquiries/:id/reply
  // Body:
  //   { subject, message }
  // No retries/fallbacks here; caller handles errors.
  return adminPost(inquiryUrl(`/${safeId}/reply`), {
    subject: asString(payload?.subject),
    message: asString(payload?.message),
  });
}

export function messagePreview(message: string, maxLen = 80): string {
  const s = asString(message).replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
