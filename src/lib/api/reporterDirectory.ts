import adminApi from '@/api/adminApi';

export interface ReporterContact {
  id: string;
  reporterKey?: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  // Admin-only private notes (never exposed publicly). Nullable if not set.
  notes?: string | null;
  totalStories: number;
  pendingStories: number;
  approvedStories: number;
  lastStoryAt: string; // ISO date
  // Extended fields
  reporterType?: 'journalist' | 'community';
  verificationLevel?: 'community_default' | 'pending' | 'verified' | 'limited' | 'revoked' | 'unverified';
  status?: 'active' | 'watchlist' | 'suspended' | 'banned';
  ethicsStrikes?: number | null;
  organisationName?: string | null;
  organisationType?: string | null;
  positionTitle?: string | null;
  beatsProfessional?: string[] | null;
  yearsExperience?: number | null;
  languages?: string[] | null;
  websiteOrPortfolio?: string | null;
  socialLinks?: { linkedin?: string; twitter?: string } | null;
  journalistCharterAccepted?: boolean | null;
  charterAcceptedAt?: string | null;
}

export interface ReporterContactListResponse {
  ok?: boolean;
  // New canonical shape returned to UI consumers
  rows: ReporterContact[];
  total: number;
  // Back-compat for any legacy usages reading items
  items?: ReporterContact[];
}

export async function listReporterContacts(params?: {
  search?: string;
  city?: string;
  state?: string;
  country?: string;
  type?: 'community' | 'journalist';
  status?: 'active' | 'blocked' | 'archived';
  hasNotes?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'lastStoryAt' | 'totalStories';
  sortDir?: 'asc' | 'desc';
}) {
  // Updated canonical backend route: GET /api/admin/reporters
  const res = await adminApi.get<any>('/reporters', { params });

  type ApiContact = {
    _id: string;
    fullName: string;
    email: string;
    phone?: string;
    city?: string;
    state?: string;
    country?: string;
    type: 'community' | 'journalist';
    verificationStatus: 'none' | 'pending' | 'verified' | 'rejected';
    status: 'active' | 'blocked' | 'archived';
    storiesCount: number;
    lastStoryAt?: string;
    activity?: 'active' | 'new';
    notes?: string;
  };

  const payload = res?.data ?? {};
  const rowsRaw: ApiContact[] = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.rows)
        ? payload.rows
        : [];
  const rows: ReporterContact[] = rowsRaw.map((c) => ({
    id: String(c._id),
    reporterKey: c._id,
    name: c.fullName ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    country: c.country ?? null,
    notes: c.notes ?? null,
    totalStories: c.storiesCount ?? 0,
    pendingStories: 0,
    approvedStories: 0,
    lastStoryAt: c.lastStoryAt ?? '',
    reporterType: c.type,
    verificationLevel: (c.verificationStatus === 'verified'
      ? 'verified'
      : c.verificationStatus === 'pending'
        ? 'pending'
        : c.verificationStatus === 'rejected'
          ? 'revoked'
          : 'unverified'),
    status: (c.status === 'blocked' ? 'suspended' : c.status === 'archived' ? 'banned' : 'active'),
  }));
  const total: number = typeof payload.total === 'number' ? payload.total : rows.length;
  return {
    ok: payload.ok === true || payload.success === true,
    rows,
    total,
    items: rows,
  } satisfies ReporterContactListResponse;
}

// Update private admin-only reporter notes. Backend should secure this route.
export async function updateReporterContactNotes(reporterKey: string, notes: string) {
  try {
    const res = await adminApi.post<{ ok: boolean; notes?: string }>(
      '/admin/community/reporter-contact-notes',
      { reporterKey, notes }
    );
    if (!res.data?.ok) throw new Error('Failed to save reporter notes');
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401) {
      const e = new Error('Admin session expired. Please log in again.') as any;
      e.isUnauthorized = true;
      throw e;
    }
    if (status === 404) {
      const e = new Error('Notes endpoint not available in this environment.') as any;
      e.isNotImplemented = true;
      throw e;
    }
    throw err;
  }
}
