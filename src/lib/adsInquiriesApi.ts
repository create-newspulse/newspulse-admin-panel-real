import { adminJson } from '@/lib/http/adminFetch';

export type AdInquiry = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  status: string;
};

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function normalizeInquiry(raw: any): AdInquiry {
  const id = asString(raw?.id ?? raw?._id);
  const name = asString(raw?.name ?? raw?.fullName ?? raw?.full_name);
  const email = asString(raw?.email);
  const message = asString(raw?.message ?? raw?.body ?? raw?.text);
  const createdAt = asString(raw?.createdAt ?? raw?.created_at ?? raw?.submittedAt ?? raw?.submitted_at);
  const status = asString(raw?.status ?? raw?.state ?? 'new');
  return { id, name, email, message, createdAt, status };
}

export async function getAdInquiriesUnreadCount(opts?: { signal?: AbortSignal }): Promise<number> {
  const raw = await adminJson<any>('/admin-api/ads/inquiries/unread-count', { method: 'GET', signal: opts?.signal });
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  const count = raw?.count ?? raw?.unread ?? raw?.unreadCount ?? raw?.data?.count ?? raw?.data?.unreadCount;
  const n = Number(count);
  return Number.isFinite(n) ? n : 0;
}

export async function listAdInquiries(args: {
  status?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<AdInquiry[]> {
  const qs = new URLSearchParams();
  if (args.status) qs.set('status', args.status);
  if (typeof args.page === 'number') qs.set('page', String(args.page));
  if (typeof args.limit === 'number') qs.set('limit', String(args.limit));

  const url = `/admin-api/ads/inquiries${qs.toString() ? `?${qs.toString()}` : ''}`;
  const raw = await adminJson<any>(url, { method: 'GET', signal: args.signal });

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.inquiries)
      ? raw.inquiries
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.data?.inquiries)
          ? raw.data.inquiries
          : [];

  return (list as any[])
    .map(normalizeInquiry)
    .filter((it) => Boolean(it.id));
}

export async function markAdInquiryRead(id: string): Promise<AdInquiry | { ok: true } | unknown> {
  const safeId = encodeURIComponent(String(id));
  const raw = await adminJson<any>(`/admin-api/ads/inquiries/${safeId}/mark-read`, { method: 'PATCH' });

  const inquiry = raw?.inquiry ?? raw?.data?.inquiry ?? raw?.data ?? raw;
  if (inquiry && typeof inquiry === 'object' && (inquiry.id || inquiry._id)) {
    return normalizeInquiry(inquiry);
  }

  return raw ?? { ok: true };
}

export async function setAdInquiryStatus(id: string, status: 'closed' | 'spam' | string): Promise<AdInquiry | { ok: true } | unknown> {
  const safeId = encodeURIComponent(String(id));
  const raw = await adminJson<any>(`/admin-api/ads/inquiries/${safeId}/status`, {
    method: 'PATCH',
    json: { status },
  });

  const inquiry = raw?.inquiry ?? raw?.data?.inquiry ?? raw?.data ?? raw;
  if (inquiry && typeof inquiry === 'object' && (inquiry.id || inquiry._id)) {
    return normalizeInquiry(inquiry);
  }

  return raw ?? { ok: true };
}

export function messagePreview(message: string, maxLen = 80): string {
  const s = asString(message).replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
