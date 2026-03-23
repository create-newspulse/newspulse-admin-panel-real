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
  try {
    // Backend routes for reporter directory are mounted under:
    // - proxy mode:  /admin-api/admin/community/reporters
    // - direct mode: /api/admin/community/reporters
    // (`adminApi` normalizes the mode-specific prefix automatically.)
    const res = await adminApi.get<any>('/community/reporters', { params });

    // Keep the page's expected response mapping shape.
    const items = res?.data?.items ?? [];
    const total = res?.data?.total ?? 0;
    const payload = { ...(res?.data ?? {}), items, total };

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
    const id = String(c._id ?? c.id ?? c.reporterKey ?? c.userId ?? '');
    const fullName = (c.fullName ?? c.name ?? c.userName ?? c.contactName ?? '').toString().trim();
    const email = (c.email ?? c.contactEmail ?? '').toString().trim();
    const phone = (
      c.phone
      ?? c.phoneFull
      ?? c.phoneNumber
      ?? c.contactPhone
      ?? c.contact?.phone
      ?? ''
    ).toString().trim();
    const type = (c.type ?? c.reporterType ?? c.kind ?? '').toString().toLowerCase();
    const status = (c.status ?? '').toString().toLowerCase();
    const verificationStatus = (c.verificationStatus ?? c.verification ?? c.verificationLevel ?? '').toString().toLowerCase();
    const storiesCount = Number(c.storiesCount ?? c.totalStories ?? 0) || 0;
    const lastStoryAt = (c.lastStoryAt ?? c.lastStory ?? c.lastStoryDate ?? '').toString();

    const city = (c.city ?? c.cityTownVillage ?? c.cityName ?? c.location?.city ?? c.locationDetail?.city ?? null);
    const state = (c.state ?? c.stateName ?? c.stateCode ?? c.location?.state ?? c.locationDetail?.state ?? null);
    const country = (c.country ?? c.countryName ?? c.location?.country ?? c.locationDetail?.country ?? null);

    return {
      id: id || cryptoRandomFallbackId(),
      reporterKey: id || null,
      name: fullName || null,
      email: email || null,
      phone: phone || null,
      city: (city ?? null),
      state: (state ?? null),
      country: (country ?? null),
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

    const totalOut: number = typeof payload?.total === 'number' ? payload.total : rows.length;
    return {
      ok: payload?.ok === true || payload?.success === true,
      rows,
      total: totalOut,
      items: rows,
    } satisfies ReporterContactListResponse;
  } catch (err: any) {
    throw mapAdminActionError(err, 'Failed to load reporter contacts');
  }
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
