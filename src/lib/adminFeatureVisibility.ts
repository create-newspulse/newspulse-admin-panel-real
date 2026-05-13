export const OWNER_CONTROLLED_FEATURES = [
  { key: 'add', apiKey: 'addNews', label: 'Add News' },
  { key: 'manage', apiKey: 'manageNews', label: 'Manage News' },
  { key: 'drafts', apiKey: 'draftDesk', label: 'Draft Desk' },
  { key: 'community-reporter-queue', apiKey: 'communityReporterQueue', label: 'Community Reporter Queue' },
  { key: 'reporter-portal', apiKey: 'reporterPortalAdmin', label: 'Reporter Portal Admin' },
  { key: 'broadcast-center', apiKey: 'broadcastCenter', label: 'Broadcast Center' },
  { key: 'ads', apiKey: 'adsManager', label: 'Ads Manager' },
  { key: 'media', apiKey: 'media', label: 'Media' },
  { key: 'viral-videos', apiKey: 'viralVideos', label: 'Viral Videos' },
  { key: 'aira', apiKey: 'aira', label: 'AIRA' },
  { key: 'livetv', apiKey: 'liveTv', label: 'Live TV' },
  { key: 'editorial', apiKey: 'editorial', label: 'Editorial' },
  { key: 'seo', apiKey: 'seo', label: 'SEO' },
  { key: 'analytics', apiKey: 'analytics', label: 'Analytics' },
  { key: 'moderation', apiKey: 'moderation', label: 'Moderation' },
  { key: 'compliance-reports', apiKey: 'complianceReports', label: 'Compliance Reports' },
  { key: 'ai-engine', apiKey: 'aiEngine', label: 'AI Engine' },
  { key: 'settings', apiKey: 'settings', label: 'Settings' },
] as const;

export type OwnerControlledFeatureKey = (typeof OWNER_CONTROLLED_FEATURES)[number]['key'];
export type AdminFeatureVisibilityApiKey = (typeof OWNER_CONTROLLED_FEATURES)[number]['apiKey'];
export type AdminFeatureVisibilityState = Record<OwnerControlledFeatureKey, boolean>;
type NavItemLike = { key: string };

export const OWNER_VISIBILITY_EVENT = 'np:admin-feature-visibility';

export const LOCKED_ALWAYS_VISIBLE_KEYS = new Set<string>(['dashboard', 'dark', 'logout']);
export const LOCKED_FOUNDER_ONLY_KEYS = new Set<string>(['soz']);

export const DEFAULT_ADMIN_FEATURE_VISIBILITY: AdminFeatureVisibilityState = OWNER_CONTROLLED_FEATURES.reduce(
  (acc, item) => {
    acc[item.key] = true;
    return acc;
  },
  {} as AdminFeatureVisibilityState,
);

export function isOwnerRole(role: string | null | undefined): boolean {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'founder' || normalized === 'owner';
}

function readBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'on') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
  }
  return undefined;
}

function asVisibilityRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const nested = raw.visibility;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return raw;
}

export function normalizeAdminFeatureVisibility(input: unknown): AdminFeatureVisibilityState {
  const record = asVisibilityRecord(input);
  return OWNER_CONTROLLED_FEATURES.reduce((acc, item) => {
    const parsed = readBool(record[item.apiKey]);
    acc[item.key] = typeof parsed === 'boolean' ? parsed : DEFAULT_ADMIN_FEATURE_VISIBILITY[item.key];
    return acc;
  }, {} as AdminFeatureVisibilityState);
}

export function createVisibilityPayload(state: AdminFeatureVisibilityState): { visibility: Record<AdminFeatureVisibilityApiKey, boolean> } {
  return OWNER_CONTROLLED_FEATURES.reduce((acc, item) => {
    const value = state[item.key];
    acc.visibility[item.apiKey] = value === true;
    return acc;
  }, { visibility: {} as Record<AdminFeatureVisibilityApiKey, boolean> });
}

export function filterNavItemsByOwnerVisibility<T extends NavItemLike>(items: T[], role: string, visibility: AdminFeatureVisibilityState): T[] {
  if (isOwnerRole(role)) return items;

  return items.filter((item) => {
    if (LOCKED_ALWAYS_VISIBLE_KEYS.has(item.key)) return true;
    if (LOCKED_FOUNDER_ONLY_KEYS.has(item.key)) return false;
    if (Object.prototype.hasOwnProperty.call(visibility, item.key)) {
      return visibility[item.key as OwnerControlledFeatureKey] !== false;
    }
    return true;
  });
}