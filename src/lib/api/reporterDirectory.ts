import adminApi from '@/api/adminApi';
import { adminUrl } from '@/lib/api';

type UiNotifyError = { status?: number } & Error;

function extractBackendMessage(data: any): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.details === 'string') return data.details;
  return '';
}

function readOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (['true', '1', 'yes', 'enabled', 'active', 'verified'].includes(raw)) return true;
  if (['false', '0', 'no', 'disabled', 'inactive', 'unverified'].includes(raw)) return false;
  return null;
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
  directoryStatus?: 'active' | 'removed' | string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  phoneRaw?: string | null;
  whatsapp?: string | null;
  debugSourceUrl?: string | null;
  debugRawContact?: unknown;
  city: string | null;
  state: string | null;
  country: string | null;
  district?: string | null;
  area?: string | null;
  areaType?: string | null;
  coverageScope?: string | null;
  coverageLanguage?: string[] | null;
  assignedSpecialization?: string | null;
  // Optional identity/debug fields (admin-only UI)
  identitySource?: 'contact' | 'submission-derived' | 'merged' | string | null;
  emailVerified?: boolean | null;
  authStatus?: string | null;
  authProvider?: string | null;
  portalAuthEnabled?: boolean | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  status?: 'active' | 'blocked' | 'archived' | 'watchlist' | 'suspended' | 'banned' | string;
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
  stats?: ReporterContactListStats;
  // Debug: which backend route actually served the data.
  endpointUsed?: string;
  requestTrace?: ReporterRequestTrace;
  // Back-compat for any legacy usages reading items
  items?: ReporterContact[];
}

type ReporterDirectoryLoadOptions = {
  includeSubmissionFallback?: boolean;
  view?: 'active' | 'removed';
};

type SubmissionDerivedReporterAggregate = {
  row: ReporterContact;
  storyIds: Set<string>;
};

export interface ReporterContactListStats {
  totalReporters: number;
  verified: number;
  missingPhone: number;
  missingLocation: number;
  activeThisMonth: number;
  newThisMonth: number;
}

export interface ReporterRequestTracePage {
  url: string;
  page: number;
  limit: number;
  rowCount: number;
}

export interface ReporterRequestTrace {
  requestUrl: string;
  queryParams: Record<string, string>;
  limit: number;
  pageRequests: ReporterRequestTracePage[];
  responseRowCount: number;
}

type ReporterContactQueryParams = {
  search?: string;
  q?: string;
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  area?: string;
  beats?: string;
  verification?: string;
  activity?: string;
  type?: 'community' | 'journalist';
  status?: 'active' | 'blocked' | 'archived';
  hasNotes?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'lastStoryAt' | 'totalStories';
  sortDir?: 'asc' | 'desc';
};

const REPORTER_CONTACTS_ACTIVE_PATH = '/community-reporter/contacts';
const REPORTER_CONTACTS_REMOVED_PATH = '/community-reporter/contacts/removed';
const REPORTER_CONTACTS_BULK_HIDE_PATH = '/community-reporter/contacts/bulk-hide';
const REPORTER_CONTACTS_BULK_RESTORE_PATH = '/community-reporter/contacts/bulk-restore';
const REPORTER_CONTACTS_BULK_DELETE_PATH = '/community-reporter/contacts/bulk-delete';

function logReporterContactsApi(input: {
  action: string;
  method: string;
  url: string;
  id?: string | null;
  status?: number | null;
  count?: number | null;
}) {
  if (!import.meta.env.DEV) return;
  try {
    console.info('[reporter-contacts-ui-api]', {
      action: input.action,
      url: input.url,
      method: input.method,
      id: input.id ?? null,
      status: input.status ?? null,
      count: input.count ?? null,
    });
  } catch {
    // ignore logging failures
  }
}

async function fetchReporterContactsFromEndpoint(endpointPath: string, params?: ReporterContactQueryParams) {
  const requestParams = buildReporterContactParams(params);
  const queryParams = Object.fromEntries(requestParams.entries());
  const page = Number(queryParams.page || params?.page || 1) || 1;
  const limit = Number(queryParams.limit || params?.limit || 200) || 200;
  const requestUrl = (() => {
    const full = adminUrl(endpointPath);
    const qs = requestParams.toString();
    return qs ? `${full}?${qs}` : full;
  })();
  logReporterContactsApi({ action: endpointPath === REPORTER_CONTACTS_REMOVED_PATH ? 'list-removed' : 'list', method: 'GET', url: requestUrl });

  const res = await adminApi.get<any>(endpointPath, { params: requestParams });

  const rawPayload: any = res?.data ?? {};

  // Backend response shapes seen in the wild:
  // - { items: [], total }
  // - { rows: [], total }
  // - { contacts: [], meta: { total } }
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
        : Array.isArray(rawPayload?.contacts)
          ? rawPayload.contacts
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
                  : Array.isArray(rawPayload?.data?.contacts)
                    ? rawPayload.data.contacts
                  : [];

  const total = typeof rawPayload?.total === 'number'
    ? rawPayload.total
    : typeof rawPayload?.meta?.total === 'number'
      ? rawPayload.meta.total
    : typeof rawPayload?.data?.total === 'number'
      ? rawPayload.data.total
      : typeof rawPayload?.data?.meta?.total === 'number'
        ? rawPayload.data.meta.total
      : rawItems.length;

  const rawStats = rawPayload?.stats ?? rawPayload?.meta?.stats ?? rawPayload?.data?.stats ?? null;

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
    const phoneCountryCode = String(c.phoneCountryCode ?? c.countryCode ?? c.phone?.countryCode ?? '').trim();
    const phoneNumber = String(c.phoneNumber ?? c.contactPhoneNumber ?? c.phone?.number ?? '').trim();
    const rawPhoneCandidates = [
      c.phone,
      c.rawPhone,
      c.phoneRaw,
      c.phoneE164,
      c.phoneFull,
      c.unmaskedPhone,
      c.originalPhone,
      c.mobile,
      c.reporterMobile,
      c.mobileNumber,
      c.contactNumber,
      c.contact?.contactNumber,
      c.profile?.contactNumber,
      c.identity?.contactNumber,
      c.reporter?.contactNumber,
      c.reporterPhone,
      c.contactPhoneFull,
      c.contactPhone,
      c.contact?.phone,
      c.contact?.phoneRaw,
      c.contact?.rawPhone,
      c.contact?.phoneE164,
      c.contact?.phoneValue,
      c.contact?.phoneFull,
      c.contact?.phoneNumber,
      c.contact?.mobile,
      c.contact?.mobileNumber,
      c.profile?.phone,
      c.profile?.phoneRaw,
      c.profile?.rawPhone,
      c.profile?.phoneE164,
      c.profile?.mobile,
      c.identity?.phone,
      c.identity?.phoneRaw,
      c.identity?.rawPhone,
      c.identity?.phoneE164,
      c.identity?.phoneNumber,
      c.identity?.mobile,
      c.reporter?.phone,
      c.reporter?.mobile,
      c.reporter?.mobileNumber,
      c.reporter?.phoneRaw,
      c.reporter?.rawPhone,
      c.reporter?.phoneE164,
      c.phone?.raw,
      c.phone?.value,
      c.phone?.e164,
      c.phone?.full,
      [phoneCountryCode, phoneNumber].filter(Boolean).join(' '),
    ];
    const phoneFull = chooseAdminRawPhone(rawPhoneCandidates);
    const phoneMasked = String(
      c.phoneFormatted
      ?? c.maskedPhone
      ?? c.phoneMasked
      ?? c.safePhone
      ?? c.displayPhone
      ?? c.phonePreview
      ?? c.summaryPhone
      ?? c.previewPhone
      ?? c.contact?.phonePreview
      ?? c.profile?.phonePreview
      ?? ''
    ).trim();
    const phoneRaw = chooseAdminRawPhone([
      phoneFull,
    ]);
    const whatsapp = chooseAdminRawPhone([
      c.whatsappNumber,
      c.whatsapp,
      c.whatsApp,
      c.contact?.whatsappNumber,
      c.contact?.whatsapp,
      c.contact?.whatsApp,
      c.profile?.whatsappNumber,
      c.profile?.whatsapp,
      c.profile?.whatsApp,
      c.identity?.whatsappNumber,
      c.identity?.whatsapp,
      c.identity?.whatsApp,
      c.reporter?.whatsapp,
      c.reporter?.whatsappNumber,
      c.reporter?.whatsApp,
    ]);
    const phone = phoneRaw || phoneMasked || '';

    const hasLegacyContactFields = !!(
      c.contactEmail
      || c.contactPhone
      || c.contactName
      || c.contact
    );

    const type = normalizeReporterType(c.type ?? c.reporterType ?? c.kind ?? c.role ?? c.accountType ?? c.userType ?? c.profileType ?? '');
    const status = normalizeReporterStatus(c.status ?? c.reporterStatus ?? c.accountStatus ?? c.directoryStatus ?? c.lifecycleStatus ?? '');
    const verificationStatus = normalizeVerificationLevel(
      c.verificationStatus
      ?? c.verification
      ?? c.verificationLevel
      ?? c.verification?.level
      ?? c.verified
      ?? c.isVerified
      ?? c.emailVerified
      ?? ''
    );

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

    const city = (c.city ?? c.cityTownVillage ?? c.cityName ?? c.contact?.city ?? c.profile?.city ?? c.identity?.city ?? c.reporter?.city ?? c.location?.city ?? c.locationDetail?.city ?? c.location?.town ?? c.location?.cityTownVillage ?? c.talukaName ?? null);
    const state = (c.state ?? c.stateName ?? c.stateCode ?? c.contact?.state ?? c.profile?.state ?? c.identity?.state ?? c.reporter?.state ?? c.location?.state ?? c.locationDetail?.state ?? c.location?.region ?? null);
    const country = (c.country ?? c.countryName ?? c.contact?.country ?? c.profile?.country ?? c.identity?.country ?? c.reporter?.country ?? c.location?.country ?? c.locationDetail?.country ?? c.location?.nation ?? null);
    const district = (c.district ?? c.districtName ?? c.contact?.district ?? c.profile?.district ?? c.identity?.district ?? c.reporter?.district ?? c.location?.district ?? c.location?.area ?? c.locationDetail?.district ?? c.talukaName ?? null);
    const area = (c.area ?? c.coverageArea ?? c.contact?.area ?? c.profile?.area ?? c.identity?.area ?? c.reporter?.area ?? c.location?.area ?? c.location?.locality ?? c.locality ?? c.subLocality ?? null);
    const areaType = (c.areaType ?? c.contact?.areaType ?? c.profile?.areaType ?? c.identity?.areaType ?? c.reporter?.areaType ?? c.location?.areaType ?? c.locationDetail?.areaType ?? null);
    const coverageScope = (c.coverageScope ?? c.contact?.coverageScope ?? c.profile?.coverageScope ?? c.identity?.coverageScope ?? c.reporter?.coverageScope ?? c.coverage?.scope ?? c.scope ?? null);
    const coverageLanguage = Array.isArray(c.coverageLanguage)
      ? c.coverageLanguage
      : Array.isArray(c.coverageLanguages)
        ? c.coverageLanguages
        : Array.isArray(c.languages)
          ? c.languages
          : Array.isArray(c.languagesProfessional)
            ? c.languagesProfessional
            : null;
    const assignedSpecialization = (
      c.assignedSpecialization
      ?? c.specialization
      ?? c.specialisation
      ?? c.coverage?.specialization
      ?? c.assignment?.specialization
      ?? null
    );

    const identitySource = (c.identitySource ?? c.identity?.source ?? c.source ?? c.sourceKind ?? null);
    const linkedStoryCount = (c.linkedStoryCount ?? c.linkedStories ?? c.storyCount ?? totalStories ?? null);

    const rootUnderscoreId = String(c._id ?? '').trim();
    const rootId = String(c.id ?? '').trim();
    const contactIdRaw = c.contactId ?? c.contactID ?? c.contactRecordId ?? c.contactRecordID ?? c.contact?._id ?? c.contact?.id;
    const contactId = String(contactIdRaw ?? '').trim();
    const endpointContactId = endpointPath.startsWith('/community-reporter/contacts')
      ? (rootUnderscoreId || rootId)
      : '';

    // For legacy contact-record responses where the row itself is the contact document,
    // populate contactId from the row id to preserve “View stories”/delete flows.
    const legacyRowId = rootUnderscoreId || rootId;
    const derivedContactId = !contactId && hasLegacyContactFields && !contributorIdRaw ? legacyRowId : '';
    const resolvedContactId = contactId || endpointContactId || derivedContactId;

    const idRaw = resolvedContactId ?? c._id ?? c.id ?? contributorIdRaw ?? c.reporterId ?? c.userId ?? c.reporterKey ?? c.key;
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

    const mappedRow = {
      id: stableId,
      contributorId: contributorIdRaw != null ? String(contributorIdRaw).trim() || null : null,
      contactId: resolvedContactId || null,
      reporterKey: reporterKey || null,
      name: fullName || null,
      email: email || null,
      phone: phone || null,
      phoneRaw: phoneRaw || null,
      whatsapp: whatsapp || null,
      debugSourceUrl: import.meta.env.DEV ? requestUrl : null,
      debugRawContact: import.meta.env.DEV ? c : null,
      city: (city ?? null),
      state: (state ?? null),
      country: (country ?? null),
      district: district != null ? String(district) : null,
      area: area != null ? String(area) : null,
      areaType: areaType != null ? String(areaType) : null,
      coverageScope: coverageScope != null ? String(coverageScope) : null,
      coverageLanguage: coverageLanguage ? coverageLanguage.map((value: any) => String(value || '').trim()).filter(Boolean) : null,
      assignedSpecialization: assignedSpecialization != null ? String(assignedSpecialization) : null,
      identitySource: identitySource != null ? String(identitySource) : null,
      emailVerified: readOptionalBoolean(c.emailVerified ?? c.verifiedEmail ?? c.auth?.emailVerified ?? c.identity?.emailVerified ?? c.reporter?.emailVerified),
      authStatus: (c.authStatus ?? c.portalAuthStatus ?? c.reporterAuthStatus ?? c.auth?.status ?? c.identity?.authStatus ?? c.reporter?.authStatus ?? null) != null
        ? String(c.authStatus ?? c.portalAuthStatus ?? c.reporterAuthStatus ?? c.auth?.status ?? c.identity?.authStatus ?? c.reporter?.authStatus)
        : null,
      authProvider: (c.authProvider ?? c.portalAuthProvider ?? c.reporterAuthProvider ?? c.auth?.provider ?? c.identity?.authProvider ?? c.reporter?.authProvider ?? null) != null
        ? String(c.authProvider ?? c.portalAuthProvider ?? c.reporterAuthProvider ?? c.auth?.provider ?? c.identity?.authProvider ?? c.reporter?.authProvider)
        : null,
      portalAuthEnabled: readOptionalBoolean(c.portalAuthEnabled ?? c.auth?.enabled ?? c.identity?.portalAuthEnabled ?? c.identity?.authEnabled ?? c.reporter?.portalAuthEnabled ?? c.reporter?.authEnabled),
      lastLoginAt: (c.lastLoginAt ?? c.portalLastLoginAt ?? c.reporterLastLoginAt ?? c.auth?.lastLoginAt ?? c.identity?.lastLoginAt ?? c.reporter?.lastLoginAt ?? null) != null
        ? String(c.lastLoginAt ?? c.portalLastLoginAt ?? c.reporterLastLoginAt ?? c.auth?.lastLoginAt ?? c.identity?.lastLoginAt ?? c.reporter?.lastLoginAt)
        : null,
      createdAt: (c.createdAt ?? c.contact?.createdAt ?? c.profile?.createdAt ?? null) != null
        ? String(c.createdAt ?? c.contact?.createdAt ?? c.profile?.createdAt)
        : null,
      updatedAt: (c.updatedAt ?? c.contact?.updatedAt ?? c.profile?.updatedAt ?? null) != null
        ? String(c.updatedAt ?? c.contact?.updatedAt ?? c.profile?.updatedAt)
        : null,
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
      reporterType: type,
      verificationLevel: verificationStatus,
      status,
      ethicsStrikes: (typeof c.ethicsStrikes === 'number' ? c.ethicsStrikes : (typeof c.strikes === 'number' ? c.strikes : null)),
      organisationName: c.organisationName ?? c.organizationName ?? c.organization ?? c.publication ?? null,
      organisationType: c.organisationType ?? c.organizationType ?? null,
      positionTitle: c.positionTitle ?? c.position ?? c.designation ?? null,
      beatsProfessional: Array.isArray(c.beatsProfessional) ? c.beatsProfessional : (Array.isArray(c.beats) ? c.beats : null),
      yearsExperience: (typeof c.yearsExperience === 'number' ? c.yearsExperience : null),
      languages: Array.isArray(c.languages) ? c.languages : (Array.isArray(c.languagesProfessional) ? c.languagesProfessional : null),
      websiteOrPortfolio: c.websiteOrPortfolio ?? c.website ?? null,
      socialLinks: (c.socialLinks ?? c.social ?? null),
      journalistCharterAccepted: (typeof c.journalistCharterAccepted === 'boolean' ? c.journalistCharterAccepted : null),
      charterAcceptedAt: c.charterAcceptedAt ?? null,
    };

    if (import.meta.env.DEV) {
      try {
        console.info('[reporter-row-map]', {
          raw: c,
          mapped: mappedRow,
          _id: rootUnderscoreId || null,
          id: rootId || null,
          contactId: resolvedContactId || null,
          reporterId: String(c.reporterId ?? c.userId ?? contributorIdRaw ?? '').trim() || null,
          email: email || null,
        });
      } catch {
        // ignore logging failures
      }
    }

    return mappedRow;
  });

  const totalOut: number = typeof payload?.total === 'number' ? payload.total : rows.length;
  const parsedStats = parseReporterContactStats(rawStats, rows);

  if (import.meta.env.DEV) {
    try {
      // eslint-disable-next-line no-console
      console.info('[reporter-contacts-ui] fetch', {
        url: requestUrl,
        raw: rawPayload,
        parsedCount: rows.length,
        parsedStats,
      });
    } catch {
      // ignore logging failures
    }
  }

  logReporterContactsApi({
    action: endpointPath === REPORTER_CONTACTS_REMOVED_PATH ? 'list-removed' : 'list',
    method: 'GET',
    url: requestUrl,
    status: typeof res?.status === 'number' ? res.status : null,
    count: rows.length,
  });

  return {
    ok: payload?.ok === true || payload?.success === true,
    rows,
    total: totalOut,
    stats: parsedStats,
    items: rows,
    endpointUsed: endpointPath,
    requestTrace: {
      requestUrl,
      queryParams,
      limit,
      pageRequests: [{ url: requestUrl, page, limit, rowCount: rows.length }],
      responseRowCount: rows.length,
    },
  } satisfies ReporterContactListResponse;
}

export async function listReporterContacts(params?: ReporterContactQueryParams, options?: ReporterDirectoryLoadOptions): Promise<ReporterContactListResponse> {
  try {
    const endpointPath = options?.view === 'removed' ? REPORTER_CONTACTS_REMOVED_PATH : REPORTER_CONTACTS_ACTIVE_PATH;
    return await fetchReporterContactsFromEndpoint(endpointPath, params);
  } catch (err: any) {
    throw mapAdminActionError(err, 'Failed to load reporter contacts');
  }
}

export async function listReporterContactsAll(params?: ReporterContactQueryParams, options?: ReporterDirectoryLoadOptions) {
  // Fetch all pages so the directory reflects backend totals.
  // This avoids showing an artificially-small dataset when backend has many contributors.
  const limit = Math.max(1, Math.min(Number(params?.limit ?? 500) || 500, 1000));
  const first = await listReporterContacts({ ...(params || {}), page: 1, limit }, options);
  const endpointUsed = first.endpointUsed;
  const pageRequests: ReporterRequestTracePage[] = [...(first.requestTrace?.pageRequests || [])];

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
        phoneRaw: prev.phoneRaw || r.phoneRaw || null,
        whatsapp: prev.whatsapp || r.whatsapp || null,
        city: prev.city || r.city || null,
        state: prev.state || r.state || null,
        country: prev.country || r.country || null,
        district: prev.district || r.district || null,
        area: prev.area || r.area || null,
        areaType: prev.areaType || r.areaType || null,
        coverageScope: prev.coverageScope || r.coverageScope || null,
        coverageLanguage: prev.coverageLanguage?.length ? prev.coverageLanguage : (r.coverageLanguage?.length ? r.coverageLanguage : null),
        assignedSpecialization: prev.assignedSpecialization || r.assignedSpecialization || null,
        identitySource: prev.identitySource || r.identitySource || null,
        emailVerified: prev.emailVerified ?? r.emailVerified ?? null,
        authStatus: prev.authStatus || r.authStatus || null,
        authProvider: prev.authProvider || r.authProvider || null,
        portalAuthEnabled: prev.portalAuthEnabled ?? r.portalAuthEnabled ?? null,
        lastLoginAt: prev.lastLoginAt || r.lastLoginAt || null,
        createdAt: prev.createdAt || r.createdAt || null,
        updatedAt: prev.updatedAt || r.updatedAt || null,
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
      : await listReporterContacts({ ...(params || {}), page, limit }, options);
    if (pageRes.requestTrace?.pageRequests?.length) pageRequests.push(...pageRes.requestTrace.pageRequests);
    const pageRows = pageRes.rows || pageRes.items || [];
    if (pageRows.length === 0) break;

    const before = mergedById.size;
    mergeIn(pageRows);
    const after = mergedById.size;
    // Stop when paging yields no new identities (prevents infinite loops if backend ignores page).
    if (after <= before) break;
  }

  const rows = Array.from(mergedById.values());
  const mergedRows = options?.includeSubmissionFallback && options?.view !== 'removed'
    ? await mergeReporterContactsWithSubmissionFallback(rows)
    : rows;
  return {
    ok: first.ok,
    rows: mergedRows,
    items: mergedRows,
    total: Math.max(Number.isFinite(totalExpected) ? totalExpected : rows.length, mergedRows.length),
    stats: parseReporterContactStats(first.stats, mergedRows),
    endpointUsed,
    requestTrace: {
      requestUrl: first.requestTrace?.requestUrl || '',
      queryParams: first.requestTrace?.queryParams || {},
      limit,
      pageRequests,
      responseRowCount: mergedRows.length,
    },
  } satisfies ReporterContactListResponse;
}

async function mergeReporterContactsWithSubmissionFallback(rows: ReporterContact[]) {
  const submissionRows = await fetchSubmissionDerivedReporterContacts();
  if (!submissionRows.length) return rows;

  const mergedById = new Map<string, ReporterContact>();
  rows.forEach((row) => mergedById.set(row.id, row));

  for (const submissionRow of submissionRows) {
    const existing = findMatchingReporterContact(Array.from(mergedById.values()), submissionRow);
    if (!existing) {
      mergedById.set(submissionRow.id, submissionRow);
      continue;
    }

    mergedById.set(existing.id, mergeReporterContactRecords(existing, submissionRow));
  }

  return Array.from(mergedById.values());
}

async function fetchSubmissionDerivedReporterContacts() {
  const limit = 500;
  const maxPages = 20;
  const aggregates = new Map<string, SubmissionDerivedReporterAggregate>();

  for (let page = 1; page <= maxPages; page++) {
    let payload: any;
    try {
      const res = await adminApi.get<any>('/community-reporter/submissions', {
        params: { page, limit, status: 'all' },
      });
      payload = res?.data ?? {};
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 404 || status === 405) return [];
      break;
    }

    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.submissions)
          ? payload.submissions
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.items)
              ? payload.data.items
              : Array.isArray(payload?.data?.submissions)
                ? payload.data.submissions
                : [];

    if (!items.length) break;

    for (const submission of items) {
      const normalized = normalizeSubmissionDerivedReporterContact(submission);
      if (!normalized) continue;

      const aggregate = aggregates.get(normalized.id);
      if (!aggregate) {
        const nextSet = new Set<string>();
        if (normalized.contactId) nextSet.add(normalized.contactId);
        aggregates.set(normalized.id, { row: normalized, storyIds: nextSet });
        continue;
      }

      if (normalized.contactId) aggregate.storyIds.add(normalized.contactId);
      aggregate.row = mergeReporterContactRecords(aggregate.row, normalized);
      aggregate.row.totalStories = aggregate.storyIds.size;
      aggregate.row.approvedStories = Math.max(aggregate.row.approvedStories, normalized.approvedStories);
      aggregate.row.pendingStories = Math.max(aggregate.row.pendingStories, normalized.pendingStories);
      aggregate.row.rejectedStories = Math.max(Number(aggregate.row.rejectedStories || 0), Number(normalized.rejectedStories || 0));
      aggregate.row.lastSubmissionAt = latestIso(aggregate.row.lastSubmissionAt, normalized.lastSubmissionAt);
      aggregate.row.lastStoryAt = latestIso(aggregate.row.lastStoryAt, normalized.lastStoryAt) || '';
    }

    if (items.length < limit) break;
  }

  return Array.from(aggregates.values()).map(({ row, storyIds }) => ({
    ...row,
    totalStories: Math.max(Number(row.totalStories || 0), storyIds.size),
    linkedStoryCount: Math.max(Number(row.linkedStoryCount || 0), storyIds.size),
  }));
}

function normalizeSubmissionDerivedReporterContact(submission: any): ReporterContact | null {
  const raw = submission && typeof submission === 'object' ? submission : {};
  const email = pickFirstString([
    raw.contactEmail,
    raw.email,
    raw.reporterEmail,
    raw.contact?.email,
    raw.identity?.email,
    raw.reporter?.email,
    raw.user?.email,
  ]).trim();
  const phone = chooseAdminRawPhone([
    raw.contactPhone,
    raw.phone,
    raw.mobile,
    raw.mobileNumber,
    raw.contactNumber,
    raw.reporterPhone,
    raw.contact?.phone,
    raw.contact?.mobile,
    raw.contact?.mobileNumber,
    raw.contact?.contactNumber,
    raw.identity?.phone,
    raw.identity?.mobile,
    raw.identity?.contactNumber,
    raw.reporter?.phone,
    raw.reporter?.mobile,
    raw.reporter?.mobileNumber,
    raw.reporter?.contactNumber,
    raw.phoneNumber,
    raw.contactPhoneNumber,
    raw.whatsapp,
    raw.whatsappNumber,
  ]);
  const contactMethod = String(raw.contactMethod ?? raw.contact?.preferredContact ?? raw.contact?.method ?? '').trim().toLowerCase();
  const whatsapp = chooseAdminRawPhone([
    raw.whatsapp,
    raw.whatsappNumber,
    raw.whatsApp,
    raw.contact?.whatsapp,
    raw.contact?.whatsappNumber,
    raw.contact?.whatsApp,
    raw.identity?.whatsapp,
    raw.identity?.whatsappNumber,
    raw.identity?.whatsApp,
    raw.reporter?.whatsapp,
    raw.reporter?.whatsappNumber,
    raw.reporter?.whatsApp,
    contactMethod === 'whatsapp' ? phone : '',
  ]);
  const fullName = pickFirstString([
    raw.contactName,
    raw.reporterName,
    raw.userName,
    raw.name,
    raw.contact?.name,
    raw.identity?.name,
    raw.reporter?.name,
    raw.reporter?.fullName,
    raw.user?.name,
  ]);
  const city = pickFirstString([raw.city, raw.location?.city, raw.location?.town, raw.cityTownVillage, raw.contact?.city, raw.identity?.city, raw.reporter?.city]);
  const district = pickFirstString([raw.district, raw.location?.district, raw.location?.area, raw.districtName, raw.contact?.district, raw.identity?.district, raw.reporter?.district]);
  const state = pickFirstString([raw.state, raw.location?.state, raw.location?.region, raw.stateName, raw.contact?.state, raw.identity?.state, raw.reporter?.state]);
  const country = pickFirstString([raw.country, raw.location?.country, raw.location?.nation, raw.countryName, raw.contact?.country, raw.identity?.country, raw.reporter?.country]);
  const contributorId = pickFirstString([raw.reporterContributorId, raw.contributorId, raw.identity?.contributorId, raw.reporter?.contributorId, raw.user?.contributorId]);
  const reporterKey = pickFirstString([raw.reporterKey, raw.identity?.reporterKey, raw.reporter?.reporterKey, raw.userId, raw.user?.id, contributorId, email.toLowerCase()]);
  const submissionId = pickFirstString([raw.id, raw._id, raw.ID, raw.uuid, raw.referenceId, raw.refId]);
  const authStatus = pickFirstString([raw.reporterAuthStatus, raw.authStatus, raw.portalAuthStatus, raw.identity?.authStatus, raw.reporter?.authStatus]);
  const authProvider = pickFirstString([raw.reporterAuthProvider, raw.authProvider, raw.portalAuthProvider, raw.identity?.authProvider, raw.reporter?.authProvider]);
  const lastLoginAt = pickFirstString([raw.reporterLastLoginAt, raw.lastLoginAt, raw.identity?.lastLoginAt, raw.reporter?.lastLoginAt]) || null;
  const verificationLevel = normalizeVerificationLevel(raw.reporterVerificationLevel ?? raw.verificationLevel ?? raw.identity?.verificationLevel ?? raw.reporter?.verificationLevel ?? '');
  const status = normalizeReporterStatus(raw.reporterStatus ?? raw.status ?? raw.identity?.status ?? raw.reporter?.status ?? '');
  const createdAt = pickFirstString([raw.createdAt, raw.submittedAt, raw.updatedAt]);
  const storyStatus = String(raw.status ?? raw.reviewStatus ?? raw.workflowStatus ?? '').trim().toLowerCase();

  if (!fullName && !email && !phone && !whatsapp) return null;

  const stableId = contributorId || reporterKey || stableAnonId({
    fullName,
    email: email.toLowerCase(),
    phone: phone || whatsapp,
    city,
    district,
    state,
    country,
  });

  return {
    id: stableId,
    contributorId: contributorId || null,
    contactId: null,
    reporterKey: reporterKey || stableId,
    name: fullName || null,
    email: email || null,
    phone: phone || null,
    phoneRaw: phone || null,
    whatsapp: whatsapp || null,
    debugSourceUrl: import.meta.env.DEV ? '/community-reporter/submissions' : null,
    debugRawContact: import.meta.env.DEV ? raw : null,
    city: city || null,
    state: state || null,
    country: country || null,
    district: district || null,
    area: pickFirstString([raw.area, raw.location?.area, raw.locality, raw.subLocality]) || null,
    areaType: pickFirstString([raw.areaType, raw.location?.areaType]) || null,
    coverageScope: pickFirstString([raw.coverageScope, raw.contact?.coverageScope, raw.identity?.coverageScope]) || null,
    coverageLanguage: Array.isArray(raw.coverageLanguage)
      ? raw.coverageLanguage.map((value: any) => String(value || '').trim()).filter(Boolean)
      : Array.isArray(raw.coverageLanguages)
        ? raw.coverageLanguages.map((value: any) => String(value || '').trim()).filter(Boolean)
        : Array.isArray(raw.languages)
          ? raw.languages.map((value: any) => String(value || '').trim()).filter(Boolean)
          : null,
    assignedSpecialization: pickFirstString([raw.assignedSpecialization, raw.specialization, raw.specialisation]) || null,
    identitySource: 'submission-derived',
    emailVerified: readOptionalBoolean(raw.reporterEmailVerified ?? raw.emailVerified ?? raw.verifiedEmail ?? raw.identity?.emailVerified ?? raw.reporter?.emailVerified),
    authStatus: authStatus || null,
    authProvider: authProvider || null,
    portalAuthEnabled: readOptionalBoolean(raw.portalAuthEnabled ?? raw.identity?.portalAuthEnabled ?? raw.reporter?.portalAuthEnabled),
    lastLoginAt,
    createdAt: createdAt || null,
    updatedAt: pickFirstString([raw.updatedAt, raw.createdAt]) || null,
    linkedStoryCount: submissionId ? 1 : 0,
    lastSubmissionAt: createdAt || null,
    notes: null,
    totalStories: submissionId ? 1 : 0,
    pendingStories: isPendingSubmissionState(storyStatus) ? 1 : 0,
    approvedStories: isApprovedSubmissionState(storyStatus) ? 1 : 0,
    rejectedStories: isRejectedSubmissionState(storyStatus) ? 1 : 0,
    withdrawnStories: 0,
    publishedStories: isApprovedSubmissionState(storyStatus) ? 1 : 0,
    lastStoryAt: createdAt || '',
    reporterType: 'community',
    verificationLevel,
    status,
    ethicsStrikes: null,
    organisationName: null,
    organisationType: null,
    positionTitle: null,
    beatsProfessional: null,
    yearsExperience: null,
    languages: Array.isArray(raw.languages) ? raw.languages.map((value: any) => String(value || '').trim()).filter(Boolean) : null,
    websiteOrPortfolio: null,
    socialLinks: null,
    journalistCharterAccepted: null,
    charterAcceptedAt: null,
  } satisfies ReporterContact;
}

function mergeReporterContactRecords(primary: ReporterContact, secondary: ReporterContact): ReporterContact {
  return {
    ...secondary,
    ...primary,
    contributorId: primary.contributorId || secondary.contributorId || null,
    contactId: primary.contactId || secondary.contactId || null,
    reporterKey: primary.reporterKey || secondary.reporterKey || null,
    name: primary.name || secondary.name || null,
    email: primary.email || secondary.email || null,
    phone: primary.phone || secondary.phone || null,
    phoneRaw: primary.phoneRaw || secondary.phoneRaw || null,
    whatsapp: primary.whatsapp || secondary.whatsapp || null,
    city: primary.city || secondary.city || null,
    district: primary.district || secondary.district || null,
    state: primary.state || secondary.state || null,
    country: primary.country || secondary.country || null,
    area: primary.area || secondary.area || null,
    areaType: primary.areaType || secondary.areaType || null,
    coverageScope: primary.coverageScope || secondary.coverageScope || null,
    coverageLanguage: primary.coverageLanguage?.length ? primary.coverageLanguage : (secondary.coverageLanguage?.length ? secondary.coverageLanguage : null),
    assignedSpecialization: primary.assignedSpecialization || secondary.assignedSpecialization || null,
    identitySource: primary.identitySource || secondary.identitySource || null,
    emailVerified: primary.emailVerified ?? secondary.emailVerified ?? null,
    authStatus: primary.authStatus || secondary.authStatus || null,
    authProvider: primary.authProvider || secondary.authProvider || null,
    portalAuthEnabled: primary.portalAuthEnabled ?? secondary.portalAuthEnabled ?? null,
    lastLoginAt: primary.lastLoginAt || secondary.lastLoginAt || null,
    createdAt: primary.createdAt || secondary.createdAt || null,
    updatedAt: latestIso(primary.updatedAt, secondary.updatedAt),
    linkedStoryCount: Math.max(Number(primary.linkedStoryCount || 0), Number(secondary.linkedStoryCount || 0)) || null,
    lastSubmissionAt: latestIso(primary.lastSubmissionAt, secondary.lastSubmissionAt),
    notes: primary.notes || secondary.notes || null,
    totalStories: Math.max(Number(primary.totalStories || 0), Number(secondary.totalStories || 0)),
    approvedStories: Math.max(Number(primary.approvedStories || 0), Number(secondary.approvedStories || 0)),
    pendingStories: Math.max(Number(primary.pendingStories || 0), Number(secondary.pendingStories || 0)),
    rejectedStories: Math.max(Number(primary.rejectedStories || 0), Number(secondary.rejectedStories || 0)),
    withdrawnStories: Math.max(Number(primary.withdrawnStories || 0), Number(secondary.withdrawnStories || 0)),
    publishedStories: Math.max(Number(primary.publishedStories || 0), Number(secondary.publishedStories || 0)),
    lastStoryAt: latestIso(primary.lastStoryAt, secondary.lastStoryAt) || '',
    reporterType: primary.reporterType || secondary.reporterType,
    verificationLevel: primary.verificationLevel || secondary.verificationLevel,
    status: primary.status || secondary.status,
  };
}

function findMatchingReporterContact(rows: ReporterContact[], candidate: ReporterContact) {
  const candidateEmail = String(candidate.email || '').trim().toLowerCase();
  const candidatePhone = normalizeComparablePhone(candidate.phone || candidate.whatsapp || '');
  const candidateKey = String(candidate.reporterKey || '').trim().toLowerCase();
  const candidateContributorId = String(candidate.contributorId || '').trim().toLowerCase();

  return rows.find((row) => {
    const rowEmail = String(row.email || '').trim().toLowerCase();
    const rowPhone = normalizeComparablePhone(row.phone || row.whatsapp || '');
    const rowKey = String(row.reporterKey || '').trim().toLowerCase();
    const rowContributorId = String(row.contributorId || '').trim().toLowerCase();
    return (candidateContributorId && rowContributorId === candidateContributorId)
      || (candidateKey && rowKey === candidateKey)
      || (candidateEmail && rowEmail === candidateEmail)
      || (candidatePhone && rowPhone === candidatePhone);
  });
}

function normalizeComparablePhone(value: string) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function pickFirstString(values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function latestIso(left?: string | null, right?: string | null) {
  const leftTs = daysSinceIso(left) === Number.POSITIVE_INFINITY ? 0 : new Date(String(left || '')).getTime();
  const rightTs = daysSinceIso(right) === Number.POSITIVE_INFINITY ? 0 : new Date(String(right || '')).getTime();
  if (rightTs > leftTs) return String(right || '').trim() || null;
  return String(left || '').trim() || String(right || '').trim() || null;
}

function isApprovedSubmissionState(value: string) {
  return ['approved', 'published', 'live', 'accepted'].some((token) => value.includes(token));
}

function isPendingSubmissionState(value: string) {
  return ['pending', 'under_review', 'review', 'submitted', 'draft'].some((token) => value.includes(token));
}

function isRejectedSubmissionState(value: string) {
  return ['rejected', 'declined', 'trash', 'withdrawn'].some((token) => value.includes(token));
}

function chooseAdminRawPhone(values: unknown[]) {
  const candidates = values.map((value) => String(value || '').trim()).filter(Boolean);
  const rawCandidate = candidates.find((value) => !looksMaskedPhone(value));
  return rawCandidate || '';
}

function looksMaskedPhone(value: string) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[xX*•]/.test(text)) return true;
  const digits = text.replace(/\D+/g, '');
  if (digits.length >= 4 && digits.length <= 6) return true;
  return false;
}

function parseReporterContactStats(rawStats: any, rows: ReporterContact[]): ReporterContactListStats {
  const fallback = buildReporterContactStats(rows);
  if (!rawStats || typeof rawStats !== 'object') return fallback;

  return {
    totalReporters: numberOrFallback(rawStats.totalReporters ?? rawStats.total ?? rawStats.contactsCount, fallback.totalReporters),
    verified: numberOrFallback(rawStats.verified ?? rawStats.verifiedCount, fallback.verified),
    missingPhone: numberOrFallback(rawStats.missingPhone ?? rawStats.missingPhoneCount, fallback.missingPhone),
    missingLocation: numberOrFallback(rawStats.missingLocation ?? rawStats.missingLocationCount, fallback.missingLocation),
    activeThisMonth: numberOrFallback(rawStats.activeThisMonth ?? rawStats.activeCount, fallback.activeThisMonth),
    newThisMonth: numberOrFallback(rawStats.newThisMonth ?? rawStats.newCount, fallback.newThisMonth),
  };
}

function buildReporterContactStats(rows: ReporterContact[]): ReporterContactListStats {
  return {
    totalReporters: rows.length,
    verified: rows.filter((row) => String(row.verificationLevel || '').trim().toLowerCase() === 'verified').length,
    missingPhone: rows.filter((row) => !String(row.phone || '').trim()).length,
    missingLocation: rows.filter((row) => !String(row.city || '').trim() && !String(row.district || '').trim() && !String(row.state || '').trim() && !String(row.country || '').trim()).length,
    activeThisMonth: rows.filter((row) => daysSinceIso(row.lastSubmissionAt || row.lastStoryAt) <= 31).length,
    newThisMonth: rows.filter((row) => String((row as any).activity || '').trim().toLowerCase() === 'new').length,
  };
}

function numberOrFallback(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function daysSinceIso(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(raw).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function buildReporterContactParams(params?: ReporterContactQueryParams) {
  const request = new URLSearchParams();
  const page = Math.max(1, Number(params?.page ?? 1) || 1);
  const limit = Math.max(1, Math.min(Number(params?.limit ?? 200) || 200, 1000));

  request.set('page', String(page));
  request.set('limit', String(limit));

  const pairs: Array<[string, unknown]> = [
    ['search', params?.search],
    ['q', params?.q ?? params?.search],
    ['city', params?.city],
    ['state', params?.state],
    ['country', params?.country],
    ['district', params?.district],
    ['area', params?.area],
    ['beats', params?.beats],
    ['verification', params?.verification],
    ['activity', params?.activity],
    ['type', params?.type],
    ['status', params?.status],
    ['sortBy', params?.sortBy],
    ['sortDir', params?.sortDir],
  ];

  pairs.forEach(([key, value]) => {
    const text = String(value ?? '').trim();
    if (text) request.set(key, text);
  });

  if (params?.hasNotes) request.set('hasNotes', 'true');

  return request;
}

function normalizeReporterType(value: unknown): ReporterContact['reporterType'] | undefined {
  const raw = String(value ?? '').trim().toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, '');
  if (!compact) return undefined;
  if (['journalist', 'reporter', 'staffreporter', 'stringer', 'media'].includes(compact)) return 'journalist';
  if (['community', 'communityreporter', 'citizenreporter', 'contributor', 'communityjournalist'].includes(compact)) return 'community';
  return undefined;
}

function normalizeVerificationLevel(value: unknown): ReporterContact['verificationLevel'] | undefined {
  if (typeof value === 'boolean') return value ? 'verified' : 'unverified';
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return undefined;
  if (['verified', 'approved', 'true'].includes(raw)) return 'verified';
  if (['pending', 'awaiting_review', 'awaiting_verification', 'requested'].includes(raw)) return 'pending';
  if (['limited', 'partial'].includes(raw)) return 'limited';
  if (['revoked', 'rejected', 'blocked'].includes(raw)) return 'revoked';
  if (['unverified', 'false'].includes(raw)) return 'unverified';
  if (['community_default', 'communitydefault', 'default'].includes(raw)) return 'community_default';
  return undefined;
}

function normalizeReporterStatus(value: unknown): ReporterContact['status'] | undefined {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return undefined;
  if (['archived', 'archive', 'removed'].includes(raw)) return 'archived';
  if (['blocked', 'blacklisted', 'suspended', 'watchlist', 'banned'].includes(raw)) return 'blocked';
  if (['active', 'verified', 'enabled', 'approved'].includes(raw)) return 'active';
  return raw;
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
  requestUrl?: string;
  statusCode?: number;
  responseBody?: unknown;
  upserted?: number;
  skippedNoEmail?: number;
}

// Rebuild/backfill the canonical contacts collection only.
export async function rebuildReporterDirectory(): Promise<RebuildReporterDirectoryResult> {
  const path = '/community-reporter/contacts/backfill';
  const requestUrl = adminUrl(path);
  logReporterContactsApi({ action: 'rebuild', method: 'POST', url: requestUrl });
  try {
    const res = await adminApi.post<any>(path);
    const data = res?.data ?? {};
    if (data?.ok === false || data?.success === false) {
      throw new Error(extractBackendMessage(data) || 'Rebuild failed');
    }
    logReporterContactsApi({ action: 'rebuild', method: 'POST', url: requestUrl, status: typeof res?.status === 'number' ? res.status : null });
    return {
      ok: true,
      endpointUsed: path,
      requestUrl,
      statusCode: typeof res?.status === 'number' ? res.status : undefined,
      responseBody: data,
      message: extractBackendMessage(data) || undefined,
      upserted: Number(data?.upserted ?? data?.updated ?? data?.rebuilt ?? 0) || undefined,
      skippedNoEmail: Number(data?.skippedNoEmail ?? data?.skipped ?? 0) || undefined,
    };
  } catch (lastErr: any) {
    logReporterContactsApi({ action: 'rebuild', method: 'POST', url: requestUrl, status: lastErr?.response?.status ?? null });
    const msg = lastErr?.message || 'Rebuild endpoint not available';
    const mapped = mapAdminActionError(lastErr, msg) as UiNotifyError & {
    requestUrl?: string;
    statusCode?: number;
    responseBody?: unknown;
    };
    mapped.requestUrl = requestUrl;
    mapped.statusCode = lastErr?.response?.status;
    mapped.responseBody = lastErr?.response?.data;
    throw mapped;
  }
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

export async function hideReporterContact(args: {
  id: string;
  reporterKey?: string | null;
  email?: string | null;
}) {
  return bulkHideReporterContacts([args.id]);
}

export async function bulkHideReporterContacts(ids: string[]) {
  const clean = (ids || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (clean.length === 0) return { ok: true, hidden: 0 };
  const url = adminUrl(REPORTER_CONTACTS_BULK_HIDE_PATH);
  const payload = { ids: clean };
  logReporterContactsApi({ action: 'bulk-hide', method: 'POST', url, id: clean.join(','), count: clean.length });
  try {
    if (import.meta.env.DEV) {
      try {
        console.info('[reporter-bulk-remove]', {
          requestUrl: url,
          payload,
        });
      } catch {
        // ignore logging failures
      }
    }
    const res = await adminApi.post<any>(REPORTER_CONTACTS_BULK_HIDE_PATH, payload, { headers: { 'Content-Type': 'application/json' } });
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Bulk hide failed');
    if (import.meta.env.DEV) {
      try {
        console.info('[reporter-bulk-remove]', {
          requestUrl: url,
          responseStatus: res?.status ?? null,
          payload,
        });
      } catch {
        // ignore logging failures
      }
    }
    logReporterContactsApi({ action: 'bulk-hide', method: 'POST', url, id: clean.join(','), status: typeof res?.status === 'number' ? res.status : null, count: clean.length });
    return { ok: true, hidden: clean.length };
  } catch (err: any) {
    if (import.meta.env.DEV) {
      try {
        console.info('[reporter-bulk-remove]', {
          requestUrl: url,
          responseStatus: err?.response?.status ?? null,
          payload,
        });
      } catch {
        // ignore logging failures
      }
    }
    logReporterContactsApi({ action: 'bulk-hide', method: 'POST', url, id: clean.join(','), status: err?.response?.status ?? null, count: clean.length });
    throw mapAdminActionError(err, 'Failed to remove selected contacts');
  }
}

export async function bulkRestoreReporterContacts(ids: string[]) {
  const clean = (ids || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (clean.length === 0) return { ok: true, restored: 0 };
  const url = adminUrl(REPORTER_CONTACTS_BULK_RESTORE_PATH);
  logReporterContactsApi({ action: 'bulk-restore', method: 'POST', url, id: clean.join(','), count: clean.length });
  try {
    const res = await adminApi.post<any>(REPORTER_CONTACTS_BULK_RESTORE_PATH, { ids: clean }, { headers: { 'Content-Type': 'application/json' } });
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Bulk restore failed');
    logReporterContactsApi({ action: 'bulk-restore', method: 'POST', url, id: clean.join(','), status: typeof res?.status === 'number' ? res.status : null, count: clean.length });
    return { ok: true, restored: clean.length };
  } catch (err: any) {
    logReporterContactsApi({ action: 'bulk-restore', method: 'POST', url, id: clean.join(','), status: err?.response?.status ?? null, count: clean.length });
    throw mapAdminActionError(err, 'Failed to restore selected contacts');
  }
}

export async function bulkDeleteReporterContacts(args: {
  ids: string[];
  contactsById?: Map<string, Pick<ReporterContact, 'id' | 'reporterKey' | 'email'>>;
}) {
  const ids = (args.ids || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (ids.length === 0) return { ok: true, deleted: 0 };
  const url = adminUrl(REPORTER_CONTACTS_BULK_DELETE_PATH);
  logReporterContactsApi({ action: 'bulk-delete', method: 'POST', url, id: ids.join(','), count: ids.length });

  try {
    const res = await adminApi.post<any>(
      REPORTER_CONTACTS_BULK_DELETE_PATH,
      { ids },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Bulk delete failed');
    logReporterContactsApi({ action: 'bulk-delete', method: 'POST', url, id: ids.join(','), status: typeof res?.status === 'number' ? res.status : null, count: ids.length });
    return { ok: true, deleted: ids.length };
  } catch (err: any) {
    logReporterContactsApi({ action: 'bulk-delete', method: 'POST', url, id: ids.join(','), status: err?.response?.status ?? null, count: ids.length });
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
    const path = '/community-reporter/contacts/backfill';
    const url = adminUrl(path);
    logReporterContactsApi({ action: 'backfill', method: 'POST', url });
    const res = await adminApi.post<any>(path);
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
  updatedAt?: string | null;
  publishedAt?: string | null;
  approvalState?: string | null;
}

function normalizeStory(raw: any): ReporterStory {
  const id = String(raw?._id ?? raw?.id ?? raw?.storyId ?? '').trim();
  const title = String(raw?.headline ?? raw?.title ?? raw?.heading ?? raw?.name ?? '').trim();
  const status = raw?.status ?? raw?.state ?? raw?.publishStatus ?? raw?.moderationState ?? null;
  const language = raw?.language ?? raw?.lang ?? raw?.locale ?? null;
  const createdAt = raw?.createdAt ?? raw?.created ?? raw?.submittedAt ?? raw?.created_date ?? null;
  const updatedAt = raw?.updatedAt ?? raw?.updated ?? raw?.modifiedAt ?? raw?.lastModifiedAt ?? null;
  const publishedAt = raw?.publishedAt ?? raw?.published ?? raw?.published_date ?? raw?.liveAt ?? null;
  const approvalState = raw?.approvalState ?? raw?.approval ?? raw?.reviewStatus ?? raw?.moderationStatus ?? null;
  return {
    id,
    title: title || '(untitled)',
    status: status != null ? String(status) : null,
    language: language != null ? String(language) : null,
    createdAt: createdAt != null ? String(createdAt) : null,
    updatedAt: updatedAt != null ? String(updatedAt) : null,
    publishedAt: publishedAt != null ? String(publishedAt) : null,
    approvalState: approvalState != null ? String(approvalState) : null,
  };
}

export async function listReporterStoriesForContact(contactId: string): Promise<{ items: ReporterStory[] }>{
  const id = String(contactId || '').trim();
  if (!id) throw new Error('Missing contact id');
  const path = `/community-reporter/contacts/${encodeURIComponent(id)}/stories`;
  const url = adminUrl(path);
  logReporterContactsApi({ action: 'stories', method: 'GET', url, id });
  try {
    const res = await adminApi.get<any>(path);
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
    const items = rawItems.map(normalizeStory).filter(s => !!s.id);
    logReporterContactsApi({ action: 'stories', method: 'GET', url, id, status: typeof res?.status === 'number' ? res.status : null, count: items.length });
    return { items };
  } catch (err: any) {
    logReporterContactsApi({ action: 'stories', method: 'GET', url, id, status: err?.response?.status ?? null });
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
