import { CommunitySubmission } from '@/types/CommunitySubmission';
import { adminApi } from '@/lib/adminApi';
import { debug } from '@/lib/debug';

// Canonical paginated submissions list via adminApi
export async function fetchCommunitySubmissions(params: { page?: number; limit?: number; status?: string } = {}): Promise<CommunitySubmission[]> {
  const res = await adminApi.get('/community-reporter/submissions', { params });
  const data = res?.data ?? {};
  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as any).items)
      ? (data as any).items
      : Array.isArray((data as any).submissions)
        ? (data as any).submissions
        : Array.isArray((data as any).data)
          ? (data as any).data
          : [];
  return items.map((s: any) => ({
    id: String(s.id ?? s._id ?? s.ID ?? s.uuid ?? ''),
    headline: s.headline ?? '',
    body: s.body ?? '',
    category: s.category ?? '',
    status: s.status ?? 'pending',
    ...s,
  }));
}

export async function fetchCommunitySubmissionById(id: string): Promise<CommunitySubmission> {
  const path = `/community-reporter/submissions/${id}`;
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

export async function fetchCommunityReporterSubmissions(params?: { status?: 'pending' | 'rejected' | 'all'; page?: number; limit?: number }) {
  const query = { status: params?.status ?? 'pending', page: params?.page, limit: params?.limit };
  const res = await adminApi.get('/community-reporter/submissions', { params: query });
  const data = res?.data ?? {};
  const submissions = Array.isArray(data)
    ? data
    : Array.isArray((data as any).submissions)
      ? (data as any).submissions
      : Array.isArray((data as any).items)
        ? (data as any).items
        : Array.isArray((data as any).data)
          ? (data as any).data
          : [];
  return { submissions };
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
    const res = await adminApi.get('/community-reporter/queue', { params: query });
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

// Simple helper with default status, guaranteed Authorization via adminApi
export async function fetchCommunityReporterQueue(status: 'pending' | 'rejected' = 'pending') {
  const { submissions } = await listCommunityReporterQueue({ status });
  return submissions;
}

// Community Stats API wrapper and type
export interface CommunityStats {
  pendingCount: number;
  rejectedCount: number;
  approvedCount: number;
  totalStories: number;
}

export async function fetchCommunityStats(): Promise<CommunityStats> {
  const res = await adminApi.get('/community/stats');
  const s = res?.data ?? {};
  const stats: CommunityStats = {
    pendingCount: Number(s.pendingCount ?? s.pendingStories ?? s.pending ?? 0),
    rejectedCount: Number(s.rejectedCount ?? s.rejectedStories ?? s.rejected ?? 0),
    approvedCount: Number(s.approvedCount ?? s.approvedStories ?? s.approved ?? 0),
    totalStories: Number(s.totalStories ?? s.total ?? 0),
  };
  return stats;
}

// Actions: restore and hard-delete for rejected/trash tab
export async function restoreCommunitySubmission(id: string) {
  // Canonical admin path under /api/admin/community-reporter
  // Frontend base uses adminApi, which prefixes with /admin-api in dev
  try {
    const res = await adminApi.post(`/community-reporter/submissions/${id}/restore`);
    return res?.data ?? { ok: true };
  } catch (err: any) {
    const status = err?.response?.status;
    if (import.meta.env.DEV) debug('[restoreCommunitySubmission:error]', status, err?.message);
    throw err;
  }
}

export async function hardDeleteCommunitySubmission(id: string) {
  try {
    const res = await adminApi.post(`/community-reporter/submissions/${id}/hard-delete`);
    return res?.data ?? { ok: true };
  } catch (err: any) {
    const status = err?.response?.status;
    if (import.meta.env.DEV) debug('[hardDeleteCommunitySubmission:error]', status, err?.message);
    throw err;
  }
}

// Normalized reporter contacts list for the Reporter Contact Directory page
export async function listContacts(params: Record<string, any> = {}) {
  const res = await adminApi.get('/community-reporter/contacts', { params });

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
