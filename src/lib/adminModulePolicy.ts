import type { AdminModuleKey } from '@/lib/adminAccessControl';

export type AdminModulePolicyState = 'available' | 'staff_locked' | 'hidden' | 'founder_only';
export type BackendAdminModulePolicyKey =
  | 'addNews'
  | 'manageNews'
  | 'draftDesk'
  | 'communityReporterQueue'
  | 'reporterPortalAdmin'
  | 'broadcastCenter'
  | 'adsManager'
  | 'financeDesk'
  | 'media'
  | 'viralVideos'
  | 'aira'
  | 'liveTv'
  | 'editorial'
  | 'seo'
  | 'analytics'
  | 'moderation'
  | 'complianceReports'
  | 'dpdpCompliance'
  | 'aiEngine'
  | 'settings'
  | 'safeZone';

export type SerializedModulePolicyPayload = {
  expectedVersion: number;
  auditReason: string;
  modulePolicies: Partial<Record<BackendAdminModulePolicyKey, AdminModulePolicyState>>;
};
export type AdminAccessReasonCode =
  | 'ALLOWED'
  | 'STAFF_ACCESS_DISABLED'
  | 'GLOBAL_STAFF_LOCK'
  | 'FOUNDER_ONLY'
  | 'HIDDEN'
  | 'TEMPORARY_ACCESS_EXPIRED'
  | 'ACCOUNT_EXPIRED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_LOCKED';

export type AdminModulePolicy = {
  moduleKey: AdminModuleKey;
  state: AdminModulePolicyState;
  staffWithIndividualAccess?: number;
};

export type AdminModulePolicyMap = Record<AdminModuleKey, AdminModulePolicy>;

export type AdminEffectiveModuleAccess = {
  moduleKey: AdminModuleKey;
  visible: boolean;
  allowed: boolean;
  locked: boolean;
  policyState: AdminModulePolicyState;
  reasonCode: AdminAccessReasonCode;
  reason: string;
  individualAccess: 'enabled' | 'disabled' | 'temporary' | 'not_configurable';
  temporary?: boolean;
};

export const ADMIN_MODULE_POLICY_EVENT = 'np:admin-module-policy';

export const ADMIN_POLICY_MODULE_KEYS = [
  'add_news',
  'manage_news',
  'draft_desk',
  'community_reporter_queue',
  'reporter_portal_admin',
  'editorial',
  'seo',
  'moderation',
  'broadcast_center',
  'media',
  'viral_videos',
  'aira',
  'live_tv',
  'ads_manager',
  'finance_desk',
  'analytics',
  'compliance_reports',
  'dpdp_privacy_requests',
  'ai_engine',
  'settings',
] as const satisfies readonly AdminModuleKey[];

export const BACKEND_MODULE_POLICY_KEY_BY_LOCAL = {
  add_news: 'addNews',
  manage_news: 'manageNews',
  draft_desk: 'draftDesk',
  community_reporter_queue: 'communityReporterQueue',
  reporter_portal_admin: 'reporterPortalAdmin',
  broadcast_center: 'broadcastCenter',
  ads_manager: 'adsManager',
  finance_desk: 'financeDesk',
  media: 'media',
  viral_videos: 'viralVideos',
  aira: 'aira',
  live_tv: 'liveTv',
  editorial: 'editorial',
  seo: 'seo',
  analytics: 'analytics',
  moderation: 'moderation',
  compliance_reports: 'complianceReports',
  dpdp_privacy_requests: 'dpdpCompliance',
  ai_engine: 'aiEngine',
  settings: 'settings',
  safe_zone: 'safeZone',
} as const satisfies Partial<Record<AdminModuleKey, BackendAdminModulePolicyKey>>;

const LOCAL_MODULE_KEY_BY_BACKEND = Object.entries(BACKEND_MODULE_POLICY_KEY_BY_LOCAL).reduce((acc, [localKey, backendKey]) => {
  acc[backendKey] = localKey as AdminModuleKey;
  return acc;
}, {} as Record<BackendAdminModulePolicyKey, AdminModuleKey>);

export const FIXED_ADMIN_MODULE_POLICIES: Partial<Record<AdminModuleKey, AdminModulePolicyState>> = {
  dashboard: 'available',
  safe_zone: 'founder_only',
};

export const CONFIGURABLE_ADMIN_MODULE_DEFAULT_POLICY: AdminModulePolicyState = 'founder_only';

export const ADMIN_ACCESS_DENIAL_MESSAGES: Record<Exclude<AdminAccessReasonCode, 'ALLOWED' | 'HIDDEN'>, string> = {
  STAFF_ACCESS_DISABLED: 'This module is not enabled for your staff account.',
  GLOBAL_STAFF_LOCK: 'This module is currently locked for all staff.',
  FOUNDER_ONLY: 'This module is restricted to the Founder.',
  TEMPORARY_ACCESS_EXPIRED: 'Your temporary access to this module has expired.',
  ACCOUNT_EXPIRED: 'Your staff account access period has expired.',
  ACCOUNT_SUSPENDED: 'Your staff account is suspended.',
  ACCOUNT_LOCKED: 'Your staff account is locked.',
};

const LEGACY_VISIBILITY_TO_MODULE: Record<string, AdminModuleKey> = {
  add: 'add_news',
  addNews: 'add_news',
  manage: 'manage_news',
  manageNews: 'manage_news',
  drafts: 'draft_desk',
  draftDesk: 'draft_desk',
  'community-reporter-queue': 'community_reporter_queue',
  communityReporterQueue: 'community_reporter_queue',
  'reporter-portal': 'reporter_portal_admin',
  reporterPortalAdmin: 'reporter_portal_admin',
  'broadcast-center': 'broadcast_center',
  broadcastCenter: 'broadcast_center',
  ads: 'ads_manager',
  adsManager: 'ads_manager',
  finance: 'finance_desk',
  financeDesk: 'finance_desk',
  media: 'media',
  'viral-videos': 'viral_videos',
  viralVideos: 'viral_videos',
  aira: 'aira',
  livetv: 'live_tv',
  liveTv: 'live_tv',
  editorial: 'editorial',
  seo: 'seo',
  analytics: 'analytics',
  moderation: 'moderation',
  'compliance-reports': 'compliance_reports',
  complianceReports: 'compliance_reports',
  'ai-engine': 'ai_engine',
  aiEngine: 'ai_engine',
  settings: 'settings',
};

function defaultStateFor(moduleKey: AdminModuleKey): AdminModulePolicyState {
  return FIXED_ADMIN_MODULE_POLICIES[moduleKey] || CONFIGURABLE_ADMIN_MODULE_DEFAULT_POLICY;
}

function localPolicyModuleKey(value: unknown): AdminModuleKey | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  if (DEFAULT_ADMIN_MODULE_POLICY[raw as AdminModuleKey]) return raw as AdminModuleKey;
  return LOCAL_MODULE_KEY_BY_BACKEND[raw as BackendAdminModulePolicyKey];
}

export function createDefaultAdminModulePolicy(): AdminModulePolicyMap {
  const keys = Array.from(new Set<AdminModuleKey>([
    'dashboard',
    ...ADMIN_POLICY_MODULE_KEYS,
    'safe_zone',
    'staff_tasks',
    'audit_logs',
    'team_management',
  ]));
  return keys.reduce((acc, moduleKey) => {
    acc[moduleKey] = { moduleKey, state: defaultStateFor(moduleKey) };
    return acc;
  }, {} as AdminModulePolicyMap);
}

export const DEFAULT_ADMIN_MODULE_POLICY = createDefaultAdminModulePolicy();

export function createFounderOnlyModulePolicy(base: AdminModulePolicyMap = createDefaultAdminModulePolicy()): AdminModulePolicyMap {
  const next: AdminModulePolicyMap = { ...base };
  ADMIN_POLICY_MODULE_KEYS.forEach((moduleKey) => {
    next[moduleKey] = { ...(next[moduleKey] || { moduleKey }), moduleKey, state: 'founder_only' };
  });
  Object.entries(FIXED_ADMIN_MODULE_POLICIES).forEach(([moduleKey, state]) => {
    if (state && next[moduleKey as AdminModuleKey]) next[moduleKey as AdminModuleKey] = { ...(next[moduleKey as AdminModuleKey] || { moduleKey: moduleKey as AdminModuleKey }), moduleKey: moduleKey as AdminModuleKey, state };
  });
  return next;
}

export function normalizePolicyState(value: unknown): AdminModulePolicyState | undefined {
  if (typeof value === 'boolean') return value ? 'available' : 'hidden';
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return undefined;
  if (['available', 'available_to_staff', 'staff_available', 'enabled', 'visible'].includes(normalized)) return 'available';
  if (['locked', 'staff_locked', 'locked_for_staff', 'global_staff_lock', 'disabled'].includes(normalized)) return 'staff_locked';
  if (['hidden', 'hidden_from_staff', 'invisible'].includes(normalized)) return 'hidden';
  if (['founder_only', 'owner_only', 'founder'].includes(normalized)) return 'founder_only';
  return undefined;
}

function extractPolicyRecord(input: unknown): unknown {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const policy = raw.policy && typeof raw.policy === 'object' ? raw.policy as Record<string, unknown> : undefined;
  return raw.modulePolicies ?? raw.modulePolicy ?? policy?.modulePolicies ?? policy?.modulePolicy ?? raw.policies ?? raw.modules ?? raw.accessPolicy ?? raw.policy;
}

function readStaffCount(raw: any): number | undefined {
  const value = raw?.staffWithIndividualAccess ?? raw?.individualAccessCount ?? raw?.staffCount ?? raw?.enabledStaffCount;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : undefined;
}

export function normalizeAdminModulePolicy(input: unknown, legacyVisibility?: Record<string, boolean>): AdminModulePolicyMap {
  const next = createDefaultAdminModulePolicy();
  const policy = extractPolicyRecord(input) ?? input;

  if (Array.isArray(policy)) {
    policy.forEach((entry: any) => {
      const moduleKey = localPolicyModuleKey(entry?.moduleKey ?? entry?.key ?? entry?.module);
      if (!moduleKey || !next[moduleKey]) return;
      const state = normalizePolicyState(entry?.state ?? entry?.policy ?? entry?.globalState ?? entry?.visibility);
      if (state) next[moduleKey] = { moduleKey, state, staffWithIndividualAccess: readStaffCount(entry) };
    });
  } else if (policy && typeof policy === 'object') {
    Object.entries(policy as Record<string, unknown>).forEach(([key, value]) => {
      const moduleKey = localPolicyModuleKey(key);
      if (!moduleKey || !next[moduleKey]) return;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const state = normalizePolicyState((value as any).state ?? (value as any).policy ?? (value as any).globalState ?? (value as any).visibility);
        if (state) next[moduleKey] = { moduleKey, state, staffWithIndividualAccess: readStaffCount(value) };
        return;
      }
      const state = normalizePolicyState(value);
      if (state) next[moduleKey] = { moduleKey, state };
    });
  }

  if (legacyVisibility && typeof legacyVisibility === 'object') {
    Object.entries(legacyVisibility).forEach(([legacyKey, visible]) => {
      const moduleKey = LEGACY_VISIBILITY_TO_MODULE[legacyKey];
      if (!moduleKey || !next[moduleKey]) return;
      const existing = next[moduleKey];
      if (existing.state === defaultStateFor(moduleKey)) {
        next[moduleKey] = { ...existing, state: visible === false ? 'hidden' : 'available' };
      }
    });
  }

  Object.entries(FIXED_ADMIN_MODULE_POLICIES).forEach(([moduleKey, state]) => {
    if (state && next[moduleKey as AdminModuleKey]) next[moduleKey as AdminModuleKey] = { moduleKey: moduleKey as AdminModuleKey, state };
  });

  return next;
}

export function createModulePolicyPayload(policy: AdminModulePolicyMap, auditReason: string, expectedVersion: number, options: { basePolicy?: AdminModulePolicyMap; includeUnchanged?: boolean } = {}) {
  return serializeModulePolicyPayload(policy, auditReason, expectedVersion, options);
}

export function serializeModulePolicyPayload(
  policy: AdminModulePolicyMap,
  auditReason: string,
  expectedVersion: number,
  options: { basePolicy?: AdminModulePolicyMap; includeUnchanged?: boolean } = {},
): SerializedModulePolicyPayload {
  const includeUnchanged = options.includeUnchanged ?? !options.basePolicy;
  const modulePolicies = ADMIN_POLICY_MODULE_KEYS.reduce((acc, moduleKey) => {
    const backendKey = BACKEND_MODULE_POLICY_KEY_BY_LOCAL[moduleKey];
    if (!backendKey) return acc;
    const state = normalizePolicyState(policy[moduleKey]?.state) || defaultStateFor(moduleKey);
    const baseState = options.basePolicy ? normalizePolicyState(options.basePolicy[moduleKey]?.state) || defaultStateFor(moduleKey) : undefined;
    if (includeUnchanged || state !== baseState) acc[backendKey] = state;
    return acc;
  }, {} as Partial<Record<BackendAdminModulePolicyKey, AdminModulePolicyState>>);

  return {
    expectedVersion,
    auditReason: String(auditReason || '').trim(),
    modulePolicies,
  };
}

export function denialMessageForReason(reasonCode: AdminAccessReasonCode): string {
  if (reasonCode === 'ALLOWED') return 'Allowed';
  if (reasonCode === 'HIDDEN') return 'This module is hidden from staff.';
  return ADMIN_ACCESS_DENIAL_MESSAGES[reasonCode] || 'Access denied.';
}