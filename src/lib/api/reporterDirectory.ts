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
  // Production contract: backend implementations vary.
  // Prefer /community/reporter-contacts (used by deployed admin), fallback to /community/reporters.
  const paths = ['/community/reporter-contacts', '/community/reporters'] as const;
  let payload: any = null;
  let lastErr: any = null;

  for (const p of paths) {
    try {
      const res = await adminApi.get<any>(p, { params });
      payload = res?.data ?? {};
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      // Only fallback on route-not-found.
      if (status === 404) continue;
      throw err;
    }
  }
  if (lastErr && payload == null) throw lastErr;

  const rowsRaw: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.rows)
          ? payload.rows
          : Array.isArray(payload.contacts)
            ? payload.contacts
            : [];

  const rows: ReporterContact[] = rowsRaw.map((c: any) => {
    const id = String(c._id ?? c.id ?? c.reporterKey ?? c.userId ?? '');
    const fullName = (c.fullName ?? c.name ?? c.userName ?? c.contactName ?? '').toString().trim();
    const email = (c.email ?? c.contactEmail ?? '').toString().trim();
    const phone = (c.phone ?? c.contactPhone ?? '').toString().trim();
    const type = (c.type ?? c.reporterType ?? c.kind ?? '').toString().toLowerCase();
    const status = (c.status ?? '').toString().toLowerCase();
    const verificationStatus = (c.verificationStatus ?? c.verification ?? c.verificationLevel ?? '').toString().toLowerCase();
    const storiesCount = Number(c.storiesCount ?? c.totalStories ?? 0) || 0;
    const lastStoryAt = (c.lastStoryAt ?? c.lastStory ?? c.lastStoryDate ?? '').toString();

    return {
      id: id || cryptoRandomFallbackId(),
      reporterKey: id || null,
      name: fullName || null,
      email: email || null,
      phone: phone || null,
      city: (c.city ?? null),
      state: (c.state ?? null),
      country: (c.country ?? null),
      notes: (c.notes ?? null),
      totalStories: storiesCount,
      pendingStories: Number(c.pendingStories ?? 0) || 0,
      approvedStories: Number(c.approvedStories ?? 0) || 0,
      lastStoryAt,
      reporterType: (type === 'journalist' ? 'journalist' : type === 'community' ? 'community' : undefined),
      verificationLevel: (verificationStatus === 'verified'
        ? 'verified'
        : verificationStatus === 'pending'
          ? 'pending'
          : (verificationStatus === 'rejected' || verificationStatus === 'revoked')
            ? 'revoked'
            : verificationStatus === 'limited'
              ? 'limited'
              : verificationStatus === 'unverified'
                ? 'unverified'
                : verificationStatus === 'community_default'
                  ? 'community_default'
                  : undefined),
      status: (status === 'blocked' || status === 'suspended' ? 'suspended' : status === 'archived' || status === 'banned' ? 'banned' : status ? 'active' : undefined),
    };
  });

  const total: number = typeof payload?.total === 'number' ? payload.total : rows.length;
  return {
    ok: payload?.ok === true || payload?.success === true,
    rows,
    total,
    items: rows,
  } satisfies ReporterContactListResponse;
}

function cryptoRandomFallbackId() {
  // Avoid importing crypto for browser bundles; use a lightweight fallback.
  return `tmp_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
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
