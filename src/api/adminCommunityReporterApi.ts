import { CommunitySubmission } from '@/types/CommunitySubmission';
import { adminApi } from '@/lib/adminApi';
import { debug } from '@/lib/debug';

// Legacy-style simple fetch without AI/risk mapping
export async function fetchCommunitySubmissions(): Promise<CommunitySubmission[]> {
  const res = await fetch('/api/admin/community-reporter');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data ?? []).map((s: any) => ({
    id: String(s.id ?? s._id ?? s.ID ?? s.uuid ?? ''),
    headline: s.headline ?? '',
    body: s.body ?? '',
    category: s.category ?? '',
    status: s.status ?? 'pending',
    ...s,
  }));
}

export async function fetchCommunitySubmissionById(id: string): Promise<CommunitySubmission> {
  const path = `/api/admin/community-reporter/submissions/${id}`;
  try {
    const res = await adminApi.get(path);
    const s = res.data?.submission ?? res.data ?? {};
    return {
      id: String(s.id ?? s._id ?? s.ID ?? s.uuid ?? id),
      headline: s.headline ?? '',
      body: s.body ?? '',
      category: s.category ?? '',
      status: s.status ?? 'pending',
      ...s,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    if (status) throw new Error(`HTTP ${status}`);
    throw e;
  }
}

export async function fetchCommunityReporterSubmissions(params?: { status?: 'pending' | 'rejected' | 'all' }) {
  // Canonical admin path; include status filter if provided,
  // with robust response normalization to avoid UI being stuck.
  const candidates = [
    { path: '/api/admin/community-reporter/submissions', supportsParams: true },
    { path: '/api/community/submissions', supportsParams: false },
    { path: '/community/submissions', supportsParams: false }
  ] as const;
  let lastErr: any = null;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => { try { controller.abort(); } catch {} }, 10000) : null;
  for (const c of candidates) {
    try {
      const cfg = c.supportsParams ? { params: { status: params?.status || 'pending' } } : {};
      const res = await adminApi.get(c.path, { ...(cfg as any), signal: controller ? (controller as any).signal : undefined } as any);
      if (import.meta.env.DEV) debug('[communityReporterApi] GET', c.path, 'status=', res.status);
      const data = res?.data ?? {};
      // Normalize common shapes: {items: [...]}, {submissions: [...]}, or array
      const submissions = Array.isArray(data)
        ? data
        : Array.isArray(data.submissions)
          ? data.submissions
          : Array.isArray(data.items)
            ? data.items
            : Array.isArray(data.data)
              ? data.data
              : [];
      if (timer) try { clearTimeout(timer); } catch {}
      return { submissions };
    } catch (e: any) {
      lastErr = e;
    }
  }
  // Graceful dev fallback to avoid UI lock if backend down
  if (import.meta.env.DEV) {
    debug('[communityReporterApi] all paths failed; returning empty list fallback');
    return { submissions: [] };
  }
  // Surface meaningful error
  const status = lastErr?.response?.status;
  if (status) throw new Error(`HTTP ${status}`);
  throw lastErr || new Error('Failed to load submissions');
}

// New explicit queue fetch with filter parameters passed to backend.
export async function listCommunityReporterQueue(params: {
  status: 'pending' | 'rejected';
  priority?: 'FOUNDER_REVIEW' | 'EDITOR_REVIEW' | 'LOW_PRIORITY';
  risk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'FLAGGED';
  source?: 'community' | 'journalists';
  aiPickOnly?: boolean;
}) {
  const query: Record<string, any> = { status: params.status };
  if (params.priority && params.priority !== 'ALL') query.priority = params.priority;
  if (params.risk && params.risk !== 'ALL') query.risk = params.risk;
  if (params.source) query.source = params.source; // omit when ALL
  if (params.aiPickOnly) query.aiPick = true;
  try {
    // Use canonical backend route for the queue
    const res = await adminApi.get('/api/community-reporter/queue', { params: query });
    const data = res?.data ?? {};
    const submissions = Array.isArray(data.submissions)
      ? data.submissions
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
    if (import.meta.env.DEV) debug('[communityReporterQueue] params', query, 'count=', submissions.length);
    return { submissions };
  } catch (err: any) {
    const status = err?.response?.status;
    if (import.meta.env.DEV) debug('[communityReporterQueue:error]', status, err?.message);
    throw err;
  }
}

// Actions: restore and hard-delete for rejected/trash tab
export async function restoreCommunitySubmission(id: string) {
  // Canonical admin path under /api/admin/community-reporter
  // Frontend base uses adminApi, which prefixes with /admin-api in dev
  try {
    const res = await adminApi.post(`/api/admin/community-reporter/submissions/${id}/restore`);
    return res?.data ?? { ok: true };
  } catch (err: any) {
    const status = err?.response?.status;
    if (import.meta.env.DEV) debug('[restoreCommunitySubmission:error]', status, err?.message);
    throw err;
  }
}

export async function hardDeleteCommunitySubmission(id: string) {
  try {
    const res = await adminApi.post(`/api/admin/community-reporter/submissions/${id}/hard-delete`);
    return res?.data ?? { ok: true };
  } catch (err: any) {
    const status = err?.response?.status;
    if (import.meta.env.DEV) debug('[hardDeleteCommunitySubmission:error]', status, err?.message);
    throw err;
  }
}

// Normalized reporter contacts list for the Reporter Contact Directory page
export async function listContacts(params: Record<string, any> = {}) {
  const res = await adminApi.get('/api/community-reporter/contacts', { params });

  type ApiPayload = {
    ok?: boolean;
    success?: boolean;
    status?: number;
    data?: any[];
    total?: number;
  };

  const payload = res.data as ApiPayload;
  const contacts = Array.isArray(payload.data) ? payload.data : [];
  const total = typeof payload.total === 'number' ? payload.total : contacts.length;

  return { contacts, total };
}
