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
      c.contact?.whatsapp,
      c.profile?.whatsapp,
      c.identity?.whatsapp,
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

    const city = (c.city ?? c.cityTownVillage ?? c.cityName ?? c.location?.city ?? c.locationDetail?.city ?? c.location?.town ?? c.location?.cityTownVillage ?? c.talukaName ?? null);
    const state = (c.state ?? c.stateName ?? c.stateCode ?? c.location?.state ?? c.locationDetail?.state ?? c.location?.region ?? null);
    const country = (c.country ?? c.countryName ?? c.location?.country ?? c.locationDetail?.country ?? c.location?.nation ?? null);
    const district = (c.district ?? c.districtName ?? c.location?.district ?? c.location?.area ?? c.locationDetail?.district ?? c.talukaName ?? null);
    const area = (c.area ?? c.coverageArea ?? c.location?.area ?? c.location?.locality ?? c.locality ?? c.subLocality ?? null);
    const areaType = (c.areaType ?? c.location?.areaType ?? c.locationDetail?.areaType ?? null);
    const coverageScope = (c.coverageScope ?? c.coverage?.scope ?? c.scope ?? null);
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
    const endpointContactId = endpointPath === '/community-reporter/contacts'
      ? (rootUnderscoreId || rootId)
      : '';

    // For legacy contact-record responses where the row itself is the contact document,
    // populate contactId from the row id to preserve “View stories”/delete flows.
    const legacyRowId = rootUnderscoreId || rootId;
    const derivedContactId = !contactId && hasLegacyContactFields && !contributorIdRaw ? legacyRowId : '';
    const resolvedContactId = contactId || endpointContactId || derivedContactId;

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
      emailVerified: typeof (c.emailVerified ?? c.verifiedEmail ?? c.auth?.emailVerified) === 'boolean'
        ? Boolean(c.emailVerified ?? c.verifiedEmail ?? c.auth?.emailVerified)
        : null,
      authStatus: (c.authStatus ?? c.portalAuthStatus ?? c.auth?.status ?? null) != null
        ? String(c.authStatus ?? c.portalAuthStatus ?? c.auth?.status)
        : null,
      authProvider: (c.authProvider ?? c.portalAuthProvider ?? c.auth?.provider ?? null) != null
        ? String(c.authProvider ?? c.portalAuthProvider ?? c.auth?.provider)
        : null,
      portalAuthEnabled: typeof (c.portalAuthEnabled ?? c.auth?.enabled) === 'boolean'
        ? Boolean(c.portalAuthEnabled ?? c.auth?.enabled)
        : null,
      lastLoginAt: (c.lastLoginAt ?? c.portalLastLoginAt ?? c.auth?.lastLoginAt ?? null) != null
        ? String(c.lastLoginAt ?? c.portalLastLoginAt ?? c.auth?.lastLoginAt)
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

export async function listReporterContacts(params?: ReporterContactQueryParams): Promise<ReporterContactListResponse> {
  try {
    // IMPORTANT: Contributor Network must reflect unified contributor identities derived from
    // community submissions. Prefer the unified contributor dataset route when present.
    // Backend routes for reporter directory are mounted under:
    // - proxy mode:  /admin-api/admin/community/*
    // - direct mode: /api/admin/community/*
    // (`adminApi` normalizes the mode-specific prefix automatically.)
    const candidates = [
      '/community-reporter/contacts',
      '/community/reporter-contacts',
      '/community/reporter-directory',
      '/community/reporters',
    ];

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

export async function listReporterContactsAll(params?: ReporterContactQueryParams) {
  // Fetch all pages so the directory reflects backend totals.
  // This avoids showing an artificially-small dataset when backend has many contributors.
  const limit = Math.max(1, Math.min(Number(params?.limit ?? 500) || 500, 1000));
  const first = await listReporterContacts({ ...(params || {}), page: 1, limit });
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
      : await listReporterContacts({ ...(params || {}), page, limit });
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
  return {
    ok: first.ok,
    rows,
    items: rows,
    total: (Number.isFinite(totalExpected) ? totalExpected : rows.length),
    stats: parseReporterContactStats(first.stats, rows),
    endpointUsed,
    requestTrace: {
      requestUrl: first.requestTrace?.requestUrl || '',
      queryParams: first.requestTrace?.queryParams || {},
      limit,
      pageRequests,
      responseRowCount: rows.length,
    },
  } satisfies ReporterContactListResponse;
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
    const requestUrl = adminUrl(c.path);
    try {
      const res = await adminApi.post<any>(c.path);
      const data = res?.data ?? {};
      if (data?.ok === false || data?.success === false) {
        throw new Error(extractBackendMessage(data) || 'Rebuild failed');
      }
      return {
        ok: true,
        endpointUsed: c.path,
        requestUrl,
        statusCode: typeof res?.status === 'number' ? res.status : undefined,
        responseBody: data,
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
  const mapped = mapAdminActionError(lastErr, msg) as UiNotifyError & {
    requestUrl?: string;
    statusCode?: number;
    responseBody?: unknown;
  };
  mapped.requestUrl = lastErr?.config?.url ? adminUrl(String(lastErr.config.url)) : undefined;
  mapped.statusCode = lastErr?.response?.status;
  mapped.responseBody = lastErr?.response?.data;
  throw mapped;
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
  const id = String(args.id || '').trim();
  if (!id) throw new Error('Missing reporter contact id');

  const path = `/community-reporter/contacts/${encodeURIComponent(id)}/hide`;
  const requestUrl = adminUrl(path);
  const method = 'POST';

  if (import.meta.env.DEV) {
    try {
      console.info('[reporter-contact-remove] request', {
        requestUrl,
        method,
        reporterKey: args.reporterKey || null,
        email: args.email || null,
      });
    } catch {
      // ignore logging failures
    }
  }

  try {
    const res = await adminApi.post<any>(path, {
      reporterKey: args.reporterKey || undefined,
      email: args.email || undefined,
    });
    const data = res?.data ?? {};
    if (data?.ok === false) throw new Error(extractBackendMessage(data) || 'Hide failed');

    if (import.meta.env.DEV) {
      try {
        console.info('[reporter-contact-remove] response', {
          requestUrl,
          method,
          status: res?.status ?? null,
          message: extractBackendMessage(data) || null,
        });
      } catch {
        // ignore logging failures
      }
    }

    return { ok: true };
  } catch (err: any) {
    if (import.meta.env.DEV) {
      try {
        console.info('[reporter-contact-remove] response', {
          requestUrl,
          method,
          status: err?.response?.status ?? null,
          message: extractBackendMessage(err?.response?.data) || err?.message || null,
        });
      } catch {
        // ignore logging failures
      }
    }

    const status: number | undefined = err?.response?.status;
    if (status === 404) {
      const out = new Error(`Remove route not found on backend (${method} ${requestUrl} returned 404)`) as UiNotifyError;
      out.status = status;
      throw out;
    }

    throw mapAdminActionError(err, 'Failed to remove reporter from Directory');
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
