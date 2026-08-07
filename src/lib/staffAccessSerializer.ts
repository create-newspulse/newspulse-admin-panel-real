import type { AdminModuleKey, SpecialRightKey } from '@/lib/adminAccessControl';
import { ADMIN_MODULES, SPECIAL_RIGHTS } from '@/lib/adminAccessControl';
import { BACKEND_MODULE_POLICY_KEY_BY_LOCAL, type BackendAdminModulePolicyKey } from '@/lib/adminModulePolicy';

export type StaffAccessState = 'enabled' | 'disabled' | 'temporary';
export type StaffAccessTemporaryGrant = {
  targetType: 'module' | 'right';
  key: string;
  expiresAt?: string;
  reason?: string;
};

export type SerializedStaffAccessPayload = {
  moduleAccess: string[];
  modules: string[];
  moduleAccessOverride: string[];
  moduleAccessStates: Record<string, StaffAccessState>;
  specialRights: string[];
  rights: string[];
  specialRightsOverride: string[];
  temporaryGrants: StaffAccessTemporaryGrant[];
  temporaryAccess: Array<{ moduleKey?: string; rightKey?: string; expiresAt?: string; reason?: string; enabled: boolean }>;
  auditReason: string;
  reason: string;
  accessExpiryDate?: string;
  expectedVersion?: number;
  accessVersion?: number;
};

export class StaffAccessPayloadValidationError extends Error {
  field: string;
  reason: string;
  value?: unknown;

  constructor(field: string, reason: string, value?: unknown) {
    super(`Invalid Staff Access payload (${field}: ${reason})`);
    this.name = 'StaffAccessPayloadValidationError';
    this.field = field;
    this.reason = reason;
    this.value = value;
  }
}

type SerializeStaffAccessInput = {
  moduleAccess?: readonly string[];
  moduleStates?: Record<string, StaffAccessState | boolean | string | null | undefined>;
  specialRights?: readonly string[];
  temporaryGrants?: readonly StaffAccessTemporaryGrant[];
  auditReason?: string;
  reason?: string;
  accessExpiryDate?: string;
  expectedVersion?: number;
  accessVersion?: number;
};

const LOCAL_MODULE_KEYS = new Set(ADMIN_MODULES.map((item) => item.key));
const LOCAL_SPECIAL_RIGHT_KEYS = new Set(SPECIAL_RIGHTS.map((item) => item.key));
const NON_EDITABLE_STAFF_MODULES = new Set(['dashboard', 'safeZone', 'team_management']);

const BACKEND_CANONICAL_MODULE_BY_LOCAL: Record<string, string> = {
  dashboard: 'dashboard',
  ...BACKEND_MODULE_POLICY_KEY_BY_LOCAL,
  staff_tasks: 'staffTasks',
  audit_logs: 'auditLogs',
};

const BACKEND_LEGACY_MODULE_BY_CANONICAL: Record<string, string> = {
  dashboard: 'dashboard',
  addNews: 'add_news',
  manageNews: 'manage_news',
  draftDesk: 'draft_desk',
  communityReporterQueue: 'community_reporter_queue',
  reporterPortalAdmin: 'reporter_portal_admin',
  broadcastCenter: 'broadcast_center',
  adsManager: 'ads_manager',
  financeDesk: 'finance_desk',
  media: 'media',
  viralVideos: 'viral_videos',
  aira: 'aira',
  liveTv: 'live_tv',
  editorial: 'editorial',
  seo: 'seo',
  analytics: 'analytics',
  moderation: 'moderation',
  complianceReports: 'compliance_reports',
  dpdpCompliance: 'dpdp_compliance',
  aiEngine: 'ai_engine',
  settings: 'settings',
  safeZone: 'safe_zone',
  staffTasks: 'staff_tasks',
  auditLogs: 'audit_logs',
};
const NON_EDITABLE_STAFF_ACCESS_MODULES = new Set(['dashboard', 'safeZone']);

const LOCAL_MODULE_BY_BACKEND_CANONICAL: Record<string, AdminModuleKey> = Object.entries(BACKEND_CANONICAL_MODULE_BY_LOCAL).reduce((acc, [localKey, backendKey]) => {
  acc[backendKey] = localKey as AdminModuleKey;
  return acc;
}, {} as Record<string, AdminModuleKey>);

const LOCAL_MODULE_BY_BACKEND_LEGACY: Record<string, AdminModuleKey> = Object.entries(BACKEND_LEGACY_MODULE_BY_CANONICAL).reduce((acc, [backendKey, legacyKey]) => {
  const localKey = LOCAL_MODULE_BY_BACKEND_CANONICAL[backendKey] || (LOCAL_MODULE_KEYS.has(legacyKey as AdminModuleKey) ? legacyKey as AdminModuleKey : undefined);
  if (localKey) acc[legacyKey] = localKey;
  return acc;
}, {} as Record<string, AdminModuleKey>);

const SPECIAL_RIGHT_BACKEND_BY_LOCAL: Record<string, string> = {
  can_create_news: 'news_create',
  can_edit_news: 'news_edit',
  can_submit_news: 'news_submit',
  can_publish_news: 'news_publish',
  can_schedule_news: 'news_schedule',
  can_delete_news: 'news_delete',
  can_approve_news: 'news_approve',
  can_reject_or_send_back_news: 'news_reject_send_back',
  can_pin_breaking_news: 'news_pin_breaking',
  can_restore_news: 'news_restore',
  can_prepare_live_tv: 'live_tv_prepare',
  can_edit_live_tv_title: 'live_tv_edit_title',
  can_add_stream_link: 'live_tv_add_stream_link',
  can_update_ticker: 'live_tv_update_ticker',
  can_schedule_live_tv: 'live_tv_schedule',
  can_start_live_tv: 'live_tv_start',
  can_stop_live_tv: 'live_tv_stop',
  can_emergency_stop_live_tv: 'live_tv_emergency_stop',
  can_view_ads: 'ads_view',
  can_manage_ad_slots: 'ads_manage_slots',
  can_manage_sponsor_leads: 'ads_manage_sponsor_leads',
  can_manage_campaigns: 'ads_manage_campaigns',
  can_view_ad_analytics: 'ads_view_analytics',
  can_submit_sponsor_request_for_approval: 'sponsor_submit_for_approval',
  can_view_finance: 'finance_view',
  can_create_invoice: 'finance_create_invoice',
  can_update_invoice_status: 'finance_update_invoice_status',
  can_add_revenue_entry: 'finance_add_revenue_entry',
  can_add_expense_entry: 'finance_add_expense_entry',
  can_upload_receipt: 'finance_upload_receipt',
  can_prepare_monthly_finance_report: 'finance_prepare_monthly_report',
  can_export_finance_summary: 'finance_export_summary',
  can_view_sponsor_payment_status: 'finance_view_sponsor_payment_status',
  can_approve_payment: 'finance_approve_payment',
  can_delete_finance_record: 'finance_delete_record',
  can_change_bank_details: 'finance_change_bank_details',
  can_change_payment_gateway: 'finance_change_payment_gateway',
  can_approve_withdrawal: 'finance_approve_withdrawal',
  can_approve_final_finance_report: 'finance_final_report_approval',
  can_view_compliance: 'compliance_view',
  can_manage_dpdp_privacy_requests: 'compliance_view',
  can_create_task: 'task_create',
  can_assign_task: 'task_assign',
  can_edit_task: 'task_edit',
  can_update_task_status: 'task_update_status',
  can_complete_task: 'task_complete',
  can_close_task: 'task_close',
  can_delete_task: 'task_delete',
  can_view_team_tasks: 'task_view_team',
  can_manage_department_tasks: 'task_manage_department',
  can_comment_on_task: 'task_comment',
  can_escalate_task: 'task_escalate',
  can_view_staff_details: 'staff_view_details',
  can_edit_staff_basic_details: 'staff_edit_basic',
  can_change_staff_email: 'staff_change_email',
  can_generate_temporary_password: 'staff_generate_temp_password',
  can_force_password_change: 'staff_force_password_change',
  can_logout_all_devices: 'staff_logout_devices',
  can_extend_or_reactivate_staff: 'staff_extend_access',
  can_suspend_staff_account: 'staff_suspend',
  can_lock_staff_account: 'staff_lock',
  can_archive_staff: 'staff_archive',
  can_delete_staff_permanently: 'staff_delete_permanently',
  can_control_founder_account: 'founder_account_control',
  can_grant_account_control_rights: 'grant_account_control_rights',
  can_create_staff: 'staff_create',
  can_suspend_staff: 'staff_suspend',
  can_reset_staff_password: 'staff_reset_password',
  can_create_roles: 'role_create',
  can_edit_roles: 'role_edit',
  can_delete_roles: 'role_delete',
  can_change_settings: 'settings_change',
  can_access_safe_zone: 'safe_zone_access',
  can_control_ai_engine: 'ai_engine_control',
  can_use_emergency_lock: 'emergency_lock',
};

const SPECIAL_RIGHT_LOCAL_BY_BACKEND = Object.entries(SPECIAL_RIGHT_BACKEND_BY_LOCAL).reduce((acc, [localKey, backendKey]) => {
  if (!acc[backendKey]) acc[backendKey] = localKey as SpecialRightKey;
  return acc;
}, {} as Record<string, SpecialRightKey>);

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function normalizeState(value: unknown): StaffAccessState | undefined {
  if (value === true || value === 1) return 'enabled';
  if (value === false || value === 0) return 'disabled';
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (['enabled', 'allow', 'allowed', 'yes', 'on', 'true'].includes(normalized)) return 'enabled';
  if (['disabled', 'deny', 'denied', 'no', 'off', 'false', 'not_allowed'].includes(normalized)) return 'disabled';
  if (normalized === 'temporary') return 'temporary';
  return undefined;
}

function moduleAlias(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const MODULE_ALIAS_TO_LOCAL: Record<string, AdminModuleKey> = {
  [moduleAlias('DPDP Privacy Requests')]: 'dpdp_privacy_requests',
  [moduleAlias('DPDP Compliance')]: 'dpdp_privacy_requests',
  [moduleAlias('AI Engine')]: 'ai_engine',
  [moduleAlias('Settings')]: 'settings',
};

export function localStaffModuleKey(value: unknown): AdminModuleKey | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  if (LOCAL_MODULE_KEYS.has(raw as AdminModuleKey)) return raw as AdminModuleKey;
  if (LOCAL_MODULE_BY_BACKEND_CANONICAL[raw]) return LOCAL_MODULE_BY_BACKEND_CANONICAL[raw];
  if (LOCAL_MODULE_BY_BACKEND_LEGACY[raw]) return LOCAL_MODULE_BY_BACKEND_LEGACY[raw];
  return MODULE_ALIAS_TO_LOCAL[moduleAlias(raw)];
}

export function backendCanonicalStaffModuleKey(value: unknown): string | undefined {
  const localKey = localStaffModuleKey(value);
  if (localKey) return BACKEND_CANONICAL_MODULE_BY_LOCAL[localKey];
  const raw = String(value ?? '').trim();
  return raw && Object.prototype.hasOwnProperty.call(BACKEND_LEGACY_MODULE_BY_CANONICAL, raw) ? raw : undefined;
}

function resolveEditableStaffModuleForSave(value: unknown): { canonicalKey?: string; skip?: boolean } {
  const localKey = localStaffModuleKey(value);
  if (localKey && !BACKEND_CANONICAL_MODULE_BY_LOCAL[localKey]) return { skip: true };
  const canonicalKey = backendCanonicalStaffModuleKey(value);
  if (!canonicalKey) return {};
  if (NON_EDITABLE_STAFF_ACCESS_MODULES.has(canonicalKey)) return { skip: true };
  return { canonicalKey };
}

export function backendLegacyStaffModuleKey(value: unknown): string | undefined {
  const canonical = backendCanonicalStaffModuleKey(value);
  return canonical ? BACKEND_LEGACY_MODULE_BY_CANONICAL[canonical] || canonical : undefined;
}

export function localSpecialRightKey(value: unknown): SpecialRightKey | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  if (LOCAL_SPECIAL_RIGHT_KEYS.has(raw as SpecialRightKey)) return raw as SpecialRightKey;
  return SPECIAL_RIGHT_LOCAL_BY_BACKEND[raw];
}

export function backendSpecialRightKey(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  return SPECIAL_RIGHT_BACKEND_BY_LOCAL[raw] || raw;
}

export function serializeStaffAccessPayload(input: SerializeStaffAccessInput): SerializedStaffAccessPayload {
  const moduleAccessStates: Record<string, StaffAccessState> = {};
  const reason = String(input.auditReason ?? input.reason ?? '').trim();

  if (input.moduleStates) {
    Object.entries(input.moduleStates).forEach(([key, value]) => {
      const { canonicalKey, skip } = resolveEditableStaffModuleForSave(key);
      const state = normalizeState(value);
      if (skip) return;
      if (!canonicalKey) throw new StaffAccessPayloadValidationError(`moduleAccess.${key}`, 'UNKNOWN_MODULE_KEY', key);
      if (!state) throw new StaffAccessPayloadValidationError(`moduleAccess.${key}`, 'INVALID_STATE', value);
      moduleAccessStates[canonicalKey] = state;
    });
  }

  (input.moduleAccess || []).forEach((key, index) => {
    const { canonicalKey, skip } = resolveEditableStaffModuleForSave(key);
    if (skip) return;
    if (!canonicalKey) throw new StaffAccessPayloadValidationError(`moduleAccess[${index}]`, 'UNKNOWN_MODULE_KEY', key);
    moduleAccessStates[canonicalKey] = moduleAccessStates[canonicalKey] || 'enabled';
  });

  (input.temporaryGrants || []).forEach((grant, index) => {
    if (grant.targetType !== 'module') return;
    const canonicalKey = backendCanonicalStaffModuleKey(grant.key);
    if (!canonicalKey) throw new StaffAccessPayloadValidationError(`temporaryAccess[${index}].moduleKey`, 'UNKNOWN_MODULE_KEY', grant.key);
    if (NON_EDITABLE_STAFF_MODULES.has(canonicalKey)) throw new StaffAccessPayloadValidationError(`temporaryAccess[${index}].moduleKey`, 'FORBIDDEN_MODULE', grant.key);
    moduleAccessStates[canonicalKey] = 'temporary';
  });

  const enabledCanonicalModules = Object.entries(moduleAccessStates)
    .filter(([, state]) => state === 'enabled' || state === 'temporary')
    .map(([key]) => key);
  const moduleAccessOverride = unique(enabledCanonicalModules.map((key) => BACKEND_LEGACY_MODULE_BY_CANONICAL[key] || key));
  const specialRightsOverride = unique((input.specialRights || []).map((right, index) => {
    const backendKey = backendSpecialRightKey(right);
    if (!backendKey) throw new StaffAccessPayloadValidationError(`specialRights[${index}]`, 'UNKNOWN_RIGHT_KEY', right);
    return backendKey;
  }));
  const temporaryGrants = (input.temporaryGrants || []).map((grant, index) => {
    const key = grant.targetType === 'module' ? backendCanonicalStaffModuleKey(grant.key) : backendSpecialRightKey(grant.key);
    if (!key) throw new StaffAccessPayloadValidationError(`temporaryAccess[${index}].key`, grant.targetType === 'module' ? 'UNKNOWN_MODULE_KEY' : 'UNKNOWN_RIGHT_KEY', grant.key);
    if (grant.targetType === 'module' && NON_EDITABLE_STAFF_ACCESS_MODULES.has(key)) throw new StaffAccessPayloadValidationError(`temporaryAccess[${index}].moduleKey`, 'FORBIDDEN_MODULE', grant.key);
    return {
      targetType: grant.targetType,
      key,
      expiresAt: grant.expiresAt,
      reason: grant.reason || reason,
    };
  }).filter((grant) => grant.key);
  const temporaryAccess = temporaryGrants.map((grant) => ({
    ...(grant.targetType === 'module' ? { moduleKey: grant.key } : { rightKey: grant.key }),
    expiresAt: grant.expiresAt,
    reason: grant.reason,
    enabled: true,
  }));

  return {
    moduleAccess: moduleAccessOverride,
    modules: moduleAccessOverride,
    moduleAccessOverride,
    moduleAccessStates,
    specialRights: specialRightsOverride,
    rights: specialRightsOverride,
    specialRightsOverride,
    temporaryGrants,
    temporaryAccess,
    auditReason: reason,
    reason,
    ...(input.accessExpiryDate ? { accessExpiryDate: input.accessExpiryDate } : {}),
    ...(typeof input.expectedVersion === 'number' ? { expectedVersion: input.expectedVersion } : {}),
    ...(typeof input.accessVersion === 'number' ? { accessVersion: input.accessVersion } : {}),
  };
}
