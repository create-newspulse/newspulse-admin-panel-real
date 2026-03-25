import adminApi from '@/api/adminApi';

type UiNotifyError = { status?: number } & Error;

function extractBackendMessage(data: any): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.details === 'string') return data.details;
  return '';
}

function mapAdminActionError(err: any, fallback: string): UiNotifyError {
  const status: number | undefined = err?.response?.status;
  const backendMsg = extractBackendMessage(err?.response?.data);

  let message = backendMsg || err?.message || fallback;
  if (status === 404) message = 'Backend route not found';
  if (status === 403) message = 'Not allowed';
  if (status === 400) message = backendMsg || fallback;
  if (status === 503) message = 'Backend unavailable (Render restarting)';
  if (typeof status === 'number' && status >= 500) message = 'Something went wrong. Please try again.';

  const out: UiNotifyError = new Error(message) as UiNotifyError;
  out.status = status;
  return out;
}

export interface ReporterContact {
  id: string;
  // Stable backend contributor identifier (preferred). `id` is kept as the canonical UI key.
  contributorId?: string | null;
  // Optional legacy contact-record id (when backend still maintains separate contact documents).
  contactId?: string | null;
  reporterKey?: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  district?: string | null;
  // Optional identity/debug fields (admin-only UI)
  identitySource?: 'contact' | 'submission-derived' | 'merged' | string | null;
  linkedStoryCount?: number | null;
  // Prefer this for “last submission”; older UIs used `lastStoryAt`.
  lastSubmissionAt?: string | null;
  // Admin-only private notes (never exposed publicly). Nullable if not set.
  notes?: string | null;
  totalStories: number;
  pendingStories: number;
  approvedStories: number;
  rejectedStories?: number;
  withdrawnStories?: number;
  publishedStories?: number;
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
  // Debug: which backend route actually served the data.
  endpointUsed?: string;
  // Back-compat for any legacy usages reading items
  items?: ReporterContact[];
}

async function fetchReporterContactsFromEndpoint(endpointPath: string, params?: Parameters<typeof listReporterContacts>[0]) {
  const res = await adminApi.get<any>(endpointPath, { params });

  const rawPayload: any = res?.data ?? {};

  // Backend response shapes seen in the wild:
  // - { items: [], total }
  // - { rows: [], total }
  // - { reporters: [], total }
  // - { contributors: [], total }
  // - []
  // - { data: [] }
  const rawItems: any[] = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(rawPayload?.items)
      ? rawPayload.items
      : Array.isArray(rawPayload?.rows)
        ? rawPayload.rows
        : Array.isArray(rawPayload?.reporters)
          ? rawPayload.reporters
          : Array.isArray(rawPayload?.contributors)
            ? rawPayload.contributors
            : Array.isArray(rawPayload?.data)
              ? rawPayload.data
              : Array.isArray(rawPayload?.data?.items)
                ? rawPayload.data.items
                : Array.isArray(rawPayload?.data?.rows)
                  ? rawPayload.data.rows
                  : [];

  const total = typeof rawPayload?.total === 'number'
    ? rawPayload.total
    : typeof rawPayload?.data?.total === 'number'
      ? rawPayload.data.total
      : rawItems.length;

  // Keep the page's expected response mapping shape.
  const payload = { ...(rawPayload ?? {}), items: rawItems, total };

  // If backend uses 200 with { ok:false }, treat it as an error (do NOT fall back to empty UI state).
  if (payload && payload.ok === false) {
    const msg = extractBackendMessage(payload) || 'Failed to load reporter contacts';
    const e: UiNotifyError = new Error(msg) as UiNotifyError;
    // Preserve a status for UI banners; 200 indicates transport succeeded but app-level failed.
    e.status = 200;
    throw e;
  }

  const rowsRaw: any[] = Array.isArray(payload.items) ? payload.items : [];

  const rows: ReporterContact[] = rowsRaw.map((c: any) => {
    const contributorIdRaw = c.contributorId ?? c.contributorID ?? c.contributor?.id ?? c.contributor?._id;

    const fullName = (c.fullName ?? c.name ?? c.displayName ?? c.userName ?? c.contactName ?? '').toString().trim();
    const email = (c.email ?? c.contactEmail ?? c.contact?.email ?? c.identity?.email ?? '').toString().trim();
    const phone = (
      c.phone
      ?? c.phoneFull
      ?? c.phoneNumber
      ?? c.contactPhone
      ?? c.contact?.phone
      ?? c.identity?.phone
      ?? ''
    ).toString().trim();

    const hasLegacyContactFields = !!(
      c.contactEmail
      || c.contactPhone
      || c.contactName
      || c.contact
    );

    const type = (c.type ?? c.reporterType ?? c.kind ?? c.role ?? '').toString().toLowerCase();
    const status = (c.status ?? c.reporterStatus ?? '').toString().toLowerCase();
    const verificationStatus = (c.verificationStatus ?? c.verification ?? c.verificationLevel ?? c.verification?.level ?? '').toString().toLowerCase();

    const counts = (c.counts ?? c.stats ?? c.storyCounts ?? c.submissionCounts ?? c.submissions ?? null) as any;
    const totalStories = Number(
      c.storiesCount
      ?? c.totalStories
      ?? counts?.total
      ?? counts?.all
      ?? counts?.stories
      ?? 0
    ) || 0;
    const approvedStories = Number(c.approvedStories ?? counts?.approved ?? counts?.accepted ?? 0) || 0;
    const pendingStories = Number(c.pendingStories ?? counts?.pending ?? counts?.under_review ?? counts?.underReview ?? 0) || 0;
    const rejectedStories = Number(c.rejectedStories ?? counts?.rejected ?? 0) || 0;
    const withdrawnStories = Number(c.withdrawnStories ?? counts?.withdrawn ?? 0) || 0;
    const publishedStories = Number(c.publishedStories ?? counts?.published ?? counts?.live ?? 0) || 0;

    const lastSubmissionAt = String(
      c.lastSubmissionAt
      ?? c.lastSubmittedAt
      ?? c.lastStoryAt
      ?? c.lastStory
      ?? c.lastStoryDate
      ?? c.activity?.lastSubmissionAt
      ?? c.activity?.lastStoryAt
      ?? ''
    ).trim();

    const city = (c.city ?? c.cityTownVillage ?? c.cityName ?? c.location?.city ?? c.locationDetail?.city ?? c.location?.town ?? null);
    const state = (c.state ?? c.stateName ?? c.stateCode ?? c.location?.state ?? c.locationDetail?.state ?? c.location?.region ?? null);
    const country = (c.country ?? c.countryName ?? c.location?.country ?? c.locationDetail?.country ?? c.location?.nation ?? null);
    const district = (c.district ?? c.location?.district ?? c.location?.area ?? c.locationDetail?.district ?? null);

    const identitySource = (c.identitySource ?? c.identity?.source ?? c.source ?? c.sourceKind ?? null);
    const linkedStoryCount = (c.linkedStoryCount ?? c.linkedStories ?? c.storyCount ?? totalStories ?? null);

    const contactIdRaw = c.contactId ?? c.contactID ?? c.contactRecordId ?? c.contactRecordID ?? c.contact?._id ?? c.contact?.id;
    const contactId = String(contactIdRaw ?? '').trim();

    // For legacy contact-record responses where the row itself is the contact document,
    // populate contactId from the row id to preserve “View stories”/delete flows.
    const legacyRowId = String(c._id ?? c.id ?? '').trim();
    const derivedContactId = !contactId && hasLegacyContactFields && !contributorIdRaw ? legacyRowId : '';

    const idRaw = contributorIdRaw ?? derivedContactId ?? c._id ?? c.id ?? c.reporterId ?? c.userId ?? c.reporterKey ?? c.key;
    const idCandidate = String(idRaw ?? '').trim();

    const stableId = idCandidate || stableAnonId({
      fullName,
      email: email.toLowerCase(),
      phone,
      city,
      state,
      country,
      district,
    });
    const reporterKey = String(c.reporterKey ?? c.identityKey ?? c.key ?? contributorIdRaw ?? idRaw ?? '').trim() || stableId;

    return {
      id: stableId,
      contributorId: contributorIdRaw != null ? String(contributorIdRaw).trim() || null : null,
      contactId: (contactId || derivedContactId) || null,
      reporterKey: reporterKey || null,
      name: fullName || null,
      email: email || null,
      phone: phone || null,
      city: (city ?? null),
      state: (state ?? null),
      country: (country ?? null),
      district: district != null ? String(district) : null,
      identitySource: identitySource != null ? String(identitySource) : null,
      linkedStoryCount: linkedStoryCount != null ? Number(linkedStoryCount) || null : null,
      lastSubmissionAt: lastSubmissionAt || null,
      notes: (c.notes ?? null),
      totalStories,
      pendingStories,
      approvedStories,
      rejectedStories,
      withdrawnStories,
      publishedStories,
      lastStoryAt: lastSubmissionAt || '',
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
      status: (status === 'blocked' || status === 'suspended' ? 'suspended' : status === 'archived' || status === 'banned' ? 'banned' : status === 'watchlist' ? 'watchlist' : status ? 'active' : undefined),
      ethicsStrikes: (typeof c.ethicsStrikes === 'number' ? c.ethicsStrikes : (typeof c.strikes === 'number' ? c.strikes : null)),
      organisationName: c.organisationName ?? c.organizationName ?? null,
      organisationType: c.organisationType ?? c.organizationType ?? null,
      positionTitle: c.positionTitle ?? null,
      beatsProfessional: Array.isArray(c.beatsProfessional) ? c.beatsProfessional : (Array.isArray(c.beats) ? c.beats : null),
      yearsExperience: (typeof c.yearsExperience === 'number' ? c.yearsExperience : null),
      languages: Array.isArray(c.languages) ? c.languages : null,
      websiteOrPortfolio: c.websiteOrPortfolio ?? null,
      socialLinks: (c.socialLinks ?? null),
      journalistCharterAccepted: (typeof c.journalistCharterAccepted === 'boolean' ? c.journalistCharterAccepted : null),
      charterAcceptedAt: c.charterAcceptedAt ?? null,
    };
  });

  const totalOut: number = typeof payload?.total === 'number' ? payload.total : rows.length;
  return {
    ok: payload?.ok === true || payload?.success === true,
    rows,
    total: totalOut,
    items: rows,
    endpointUsed: endpointPath,
  } satisfies ReporterContactListResponse;
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
  try {
    // IMPORTANT: Contributor Network must reflect unified contributor identities derived from
    // community submissions. Prefer the unified contributor dataset route when present.
    // Backend routes for reporter directory are mounted under:
    // - proxy mode:  /admin-api/admin/community/*
    // - direct mode: /api/admin/community/*
    // (`adminApi` normalizes the mode-specific prefix automatically.)
    const candidates = ['/community/contributors', '/community/reporters'];

    let lastErr: any = null;
    for (const endpointPath of candidates) {
      try {
        return await fetchReporterContactsFromEndpoint(endpointPath, params);
      } catch (err: any) {
        lastErr = err;
        const status: number | undefined = err?.response?.status ?? err?.status;
        if (status === 404 || status === 405) continue;
        throw err;
      }
    }

    throw lastErr || new Error('Failed to load reporter contacts');
  } catch (err: any) {
    throw mapAdminActionError(err, 'Failed to load reporter contacts');
  }
}

export async function listReporterContactsAll(params?: Parameters<typeof listReporterContacts>[0]) {
  // Fetch all pages so the directory reflects backend totals.
  // This avoids showing an artificially-small dataset when backend has many contributors.
  const limit = Math.max(1, Math.min(Number(params?.limit ?? 500) || 500, 1000));
  const first = await listReporterContacts({ ...(params || {}), page: 1, limit });
  const endpointUsed = first.endpointUsed;

  const mergedById = new Map<string, ReporterContact>();
  const mergeIn = (rows: ReporterContact[]) => {
    for (const r of rows) {
      const prev = mergedById.get(r.id);
      if (!prev) {
        mergedById.set(r.id, r);
        continue;
      }
      mergedById.set(r.id, {
        ...prev,
        ...r,
        contributorId: (prev.contributorId ?? r.contributorId) ?? null,
        contactId: (prev.contactId ?? r.contactId) ?? null,
        reporterKey: (prev.reporterKey ?? r.reporterKey) ?? null,
        name: prev.name || r.name || null,
        email: prev.email || r.email || null,
        phone: prev.phone || r.phone || null,
        city: prev.city || r.city || null,
        state: prev.state || r.state || null,
        country: prev.country || r.country || null,
        district: prev.district || r.district || null,
        identitySource: prev.identitySource || r.identitySource || null,
        linkedStoryCount: (typeof prev.linkedStoryCount === 'number' ? prev.linkedStoryCount : null) ?? (typeof r.linkedStoryCount === 'number' ? r.linkedStoryCount : null),
        lastSubmissionAt: prev.lastSubmissionAt || r.lastSubmissionAt || null,
        notes: prev.notes || r.notes || null,
        totalStories: Math.max(Number(prev.totalStories || 0), Number(r.totalStories || 0)),
        approvedStories: Math.max(Number(prev.approvedStories || 0), Number(r.approvedStories || 0)),
        pendingStories: Math.max(Number(prev.pendingStories || 0), Number(r.pendingStories || 0)),
        rejectedStories: Math.max(Number(prev.rejectedStories || 0), Number(r.rejectedStories || 0)),
        withdrawnStories: Math.max(Number(prev.withdrawnStories || 0), Number(r.withdrawnStories || 0)),
        publishedStories: Math.max(Number(prev.publishedStories || 0), Number(r.publishedStories || 0)),
        lastStoryAt: prev.lastStoryAt || r.lastStoryAt || '',
      });
    }
  };

  mergeIn(first.rows || first.items || []);

  // If backend doesn't provide an explicit total, our wrapper falls back to `rows.length`.
  // In that situation we should treat the expected total as unknown and keep paging
  // until the backend stops returning *new* identities.
  const firstCount = Array.isArray(first.rows) ? first.rows.length : (Array.isArray(first.items) ? first.items.length : 0);
  const totalExpected = (typeof first.total === 'number' && first.total > firstCount)
    ? first.total
    : Number.POSITIVE_INFINITY;
  const maxPages = 50;

  for (let page = 2; page <= maxPages; page++) {
    if (Number.isFinite(totalExpected) && mergedById.size >= totalExpected) break;
    // If endpointUsed is unknown, fall back to listReporterContacts (it will re-select).
    const pageRes = endpointUsed
      ? await fetchReporterContactsFromEndpoint(endpointUsed, { ...(params || {}), page, limit })
      : await listReporterContacts({ ...(params || {}), page, limit });
    const pageRows = pageRes.rows || pageRes.items || [];
    if (pageRows.length === 0) break;

    const before = mergedById.size;
    mergeIn(pageRows);
    const after = mergedById.size;
    // Stop when paging yields no new identities (prevents infinite loops if backend ignores page).
    if (after <= before) break;
  }

  const rows = Array.from(mergedById.values());
  return {
    ok: first.ok,
    rows,
    items: rows,
    total: (Number.isFinite(totalExpected) ? totalExpected : rows.length),
    endpointUsed,
  } satisfies ReporterContactListResponse;
}

function stableAnonId(input: Record<string, unknown>) {
  // Deterministic fallback id when backend does not provide a stable contributor id.
  // Avoids React key collisions and prevents “collapsed” rows.
  const s = JSON.stringify(input);
  return `anon_${fnv1a32(s)}`;
}

function fnv1a32(str: string): string {
  // 32-bit FNV-1a; returns unsigned hex string.
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface RebuildReporterDirectoryResult {
  ok: boolean;
  message?: string;
  endpointUsed?: string;
  upserted?: number;
  skippedNoEmail?: number;
}

// Optional repair/rebuild action: prefers a backend "repair" endpoint when available.
// Falls back to the legacy contacts backfill endpoint.
export async function rebuildReporterDirectory(): Promise<RebuildReporterDirectoryResult> {
  const candidates: Array<{ method: 'post'; path: string }> = [
    { method: 'post', path: '/community/reporters/repair' },
    { method: 'post', path: '/community/reporters/rebuild' },
    { method: 'post', path: '/community/contributors/repair' },
    { method: 'post', path: '/community/contributors/rebuild' },
    { method: 'post', path: '/community-reporter/contacts/backfill' },
  ];

  let lastErr: any = null;
  for (const c of candidates) {
    try {
      const res = await adminApi.post<any>(c.path);
      const data = res?.data ?? {};
      if (data?.ok === false || data?.success === false) {
        throw new Error(extractBackendMessage(data) || 'Rebuild failed');
      }
      return {
        ok: true,
        endpointUsed: c.path,
        message: extractBackendMessage(data) || undefined,
        upserted: Number(data?.upserted ?? data?.updated ?? data?.rebuilt ?? 0) || undefined,
        skippedNoEmail: Number(data?.skippedNoEmail ?? data?.skipped ?? 0) || undefined,
      };
    } catch (err: any) {
      lastErr = err;
      const status: number | undefined = err?.response?.status;
      // Continue on "not implemented" style responses.
      if (status === 404 || status === 405) continue;
      // Abort early on auth errors.
      if (status === 401 || status === 403) break;
      // For other errors, keep trying next candidate but preserve message.
      continue;
    }
  }

  const msg = lastErr?.message || 'Rebuild endpoint not available';
  throw mapAdminActionError(lastErr, msg);
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

function readableAdminApiError(err: any, fallback: string) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const msg =
    (data && (data.message || data.error || data.details))
    || err?.message
    || fallback;

  if (status === 401) return 'Unauthorized. Please log in again.';
  if (status === 403) return 'Forbidden. You do not have permission to do that.';
  if (status === 404) return 'Not found. This action may not be supported in this environment.';
  if (typeof status === 'number' && status >= 500) return msg || 'Server error. Please try again.';
  return msg || fallback;
}

export async function deleteReporterContact(args: {
  id: string;
  reporterKey?: string | null;
  email?: string | null;
}) {
  const id = String(args.id || '').trim();
  if (!id) throw new Error('Missing reporter contact id');
  try {
    const res = await adminApi.delete<any>(`/admin/community-reporter/contacts/${encodeURIComponent(id)}`);
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Delete failed');
    return { ok: true };
  } catch (err: any) {
    // IMPORTANT: when backend returns a specific 400 message (e.g. linked stories exist), we must surface it verbatim.
    throw mapAdminActionError(err, 'Failed to delete reporter contact');
  }
}

export async function bulkDeleteReporterContacts(args: {
  ids: string[];
  contactsById?: Map<string, Pick<ReporterContact, 'id' | 'reporterKey' | 'email'>>;
}) {
  const ids = (args.ids || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (ids.length === 0) return { ok: true, deleted: 0 };

  try {
    const res = await adminApi.post<any>(
      '/admin/community-reporter/contacts/bulk-delete',
      { ids },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Bulk delete failed');
    return { ok: true, deleted: ids.length };
  } catch (err: any) {
    throw mapAdminActionError(err, 'Failed to delete selected contacts');
  }
}

export interface ReporterContactsBackfillResult {
  ok: boolean;
  upserted: number;
  skippedNoEmail: number;
}

export async function backfillReporterContacts(): Promise<ReporterContactsBackfillResult> {
  try {
    const res = await adminApi.post<any>('/community-reporter/contacts/backfill');
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Backfill failed');

    const upserted = Number(
      data?.upserted
        ?? data?.upsertedCount
        ?? data?.updated
        ?? data?.updatedCount
        ?? data?.reportersUpdated
        ?? 0
    ) || 0;

    const skippedNoEmail = Number(
      data?.skippedNoEmail
        ?? data?.skipped
        ?? data?.skippedCount
        ?? data?.skippedNoEmailCount
        ?? 0
    ) || 0;

    return {
      ok: data?.ok === true || data?.success === true || typeof data?.ok === 'undefined',
      upserted,
      skippedNoEmail,
    };
  } catch (err: any) {
    const status: number | undefined = err?.response?.status;
    const backendMsg = extractBackendMessage(err?.response?.data);

    let message = backendMsg || err?.message || 'Backfill failed';
    if (status === 403) message = 'Not allowed';
    if (typeof status === 'number' && status >= 500) message = backendMsg || 'Backfill failed';

    const out: UiNotifyError = new Error(message) as UiNotifyError;
    out.status = status;
    throw out;
  }
}

export interface ReporterStory {
  id: string;
  title: string;
  status?: string | null;
  language?: string | null;
  createdAt?: string | null;
  approvalState?: string | null;
}

function normalizeStory(raw: any): ReporterStory {
  const id = String(raw?._id ?? raw?.id ?? raw?.storyId ?? '').trim();
  const title = String(raw?.headline ?? raw?.title ?? raw?.heading ?? raw?.name ?? '').trim();
  const status = raw?.status ?? raw?.state ?? raw?.publishStatus ?? raw?.moderationState ?? null;
  const language = raw?.language ?? raw?.lang ?? raw?.locale ?? null;
  const createdAt = raw?.createdAt ?? raw?.created ?? raw?.submittedAt ?? raw?.created_date ?? null;
  const approvalState = raw?.approvalState ?? raw?.approval ?? raw?.reviewStatus ?? raw?.moderationStatus ?? null;
  return {
    id,
    title: title || '(untitled)',
    status: status != null ? String(status) : null,
    language: language != null ? String(language) : null,
    createdAt: createdAt != null ? String(createdAt) : null,
    approvalState: approvalState != null ? String(approvalState) : null,
  };
}

export async function listReporterStoriesForContact(contactId: string): Promise<{ items: ReporterStory[] }>{
  const id = String(contactId || '').trim();
  if (!id) throw new Error('Missing contact id');
  try {
    const res = await adminApi.get<any>(`/admin/community-reporter/contacts/${encodeURIComponent(id)}/stories`);
    const payload = res?.data ?? {};
    const rawItems: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.rows)
          ? payload.rows
          : Array.isArray(payload.stories)
            ? payload.stories
            : Array.isArray(payload.data)
              ? payload.data
              : [];
    return { items: rawItems.map(normalizeStory).filter(s => !!s.id) };
  } catch (err: any) {
    throw mapAdminActionError(err, 'Failed to load reporter stories');
  }
}

export async function deleteReporterStory(storyId: string) {
  const id = String(storyId || '').trim();
  if (!id) throw new Error('Missing story id');
  try {
    const res = await adminApi.delete<any>(`/admin/community-reporter/stories/${encodeURIComponent(id)}`);
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Delete failed');
    return { ok: true };
  } catch (err: any) {
    throw mapAdminActionError(err, 'Failed to delete story');
  }
}

export async function bulkDeleteReporterStories(ids: string[]) {
  const clean = (ids || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (clean.length === 0) return { ok: true, deleted: 0 };
  try {
    const res = await adminApi.post<any>(
      '/admin/community-reporter/stories/bulk-delete',
      { ids: clean },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Bulk delete failed');
    return { ok: true, deleted: clean.length };
  } catch (err: any) {
    throw mapAdminActionError(err, 'Failed to delete selected stories');
  }
}
