import { api } from './client';

export interface CommunityReporterSettings {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
  updatedAt?: string;
}

type CommunityReporterResponse = {
  success?: boolean;
  ok?: boolean;
  settings?: Record<string, unknown>;
} & Record<string, unknown>;

function readOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return undefined;
}

function normalizeSettings(raw: CommunityReporterResponse): CommunityReporterSettings {
  const payload = (raw?.settings ?? raw ?? {}) as Record<string, unknown>;
  const communityReporterClosed = readOptionalBoolean(payload.communityReporterClosed);
  const reporterPortalClosed = readOptionalBoolean(payload.reporterPortalClosed);
  const communityReporterEnabled = readOptionalBoolean(payload.communityReporterEnabled ?? payload.allowNewSubmissions);
  const reporterPortalEnabled = readOptionalBoolean(
    payload.reporterPortalEnabled
      ?? payload.allowMyStoriesPortal
      ?? payload.myStoriesEnabled
      ?? payload.myCommunityStoriesEnabled
      ?? payload.communityMyStoriesEnabled
  );

  return {
    communityReporterClosed: communityReporterClosed ?? (typeof communityReporterEnabled === 'boolean' ? !communityReporterEnabled : false),
    reporterPortalClosed: reporterPortalClosed ?? (typeof reporterPortalEnabled === 'boolean' ? !reporterPortalEnabled : false),
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
  };
}

function serializeSettingsPatch(payload: Partial<CommunityReporterSettings>) {
  const next: Record<string, unknown> = {};

  if (typeof payload.communityReporterClosed === 'boolean') {
    const communityReporterEnabled = !payload.communityReporterClosed;
    next.communityReporterClosed = payload.communityReporterClosed;
    next.communityReporterEnabled = communityReporterEnabled;
    next.allowNewSubmissions = communityReporterEnabled;
  }

  if (typeof payload.reporterPortalClosed === 'boolean') {
    const reporterPortalEnabled = !payload.reporterPortalClosed;
    next.reporterPortalClosed = payload.reporterPortalClosed;
    next.reporterPortalEnabled = reporterPortalEnabled;
    next.allowMyStoriesPortal = reporterPortalEnabled;
    next.myStoriesEnabled = reporterPortalEnabled;
    next.myCommunityStoriesEnabled = reporterPortalEnabled;
    next.communityMyStoriesEnabled = reporterPortalEnabled;
  }

  return next;
}

export async function getCommunityReporterSettings(): Promise<CommunityReporterSettings> {
  const res = await api.get('/admin/founder/feature-toggles');
  return normalizeSettings(res.data as CommunityReporterResponse);
}

export async function updateCommunityReporterSettings(
  payload: Partial<CommunityReporterSettings>,
): Promise<CommunityReporterSettings> {
  const res = await api.patch('/admin/founder/feature-toggles', serializeSettingsPatch(payload));
  return normalizeSettings(res.data as CommunityReporterResponse);
}
