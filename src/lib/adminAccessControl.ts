import type { AdminFeatureVisibilityState } from '@/lib/adminFeatureVisibility';

export type AdminModuleKey =
  | 'dashboard'
  | 'add_news'
  | 'manage_news'
  | 'draft_desk'
  | 'community_reporter_queue'
  | 'reporter_portal_admin'
  | 'broadcast_center'
  | 'ads_manager'
  | 'finance_desk'
  | 'media'
  | 'viral_videos'
  | 'aira'
  | 'live_tv'
  | 'editorial'
  | 'seo'
  | 'analytics'
  | 'moderation'
  | 'compliance_reports'
  | 'ai_engine'
  | 'settings'
  | 'safe_zone'
  | 'team_management';

export type SpecialRightKey =
  | 'can_publish_news'
  | 'can_delete_news'
  | 'can_approve_news'
  | 'can_reject_or_send_back_news'
  | 'can_pin_breaking_news'
  | 'can_prepare_live_tv'
  | 'can_start_live_tv'
  | 'can_stop_live_tv'
  | 'can_emergency_stop_live_tv'
  | 'can_view_ads'
  | 'can_manage_ad_slots'
  | 'can_manage_sponsor_leads'
  | 'can_manage_campaigns'
  | 'can_view_ad_analytics'
  | 'can_submit_sponsor_request_for_approval'
  | 'can_view_finance'
  | 'can_create_invoice'
  | 'can_update_invoice_status'
  | 'can_add_revenue_entry'
  | 'can_add_expense_entry'
  | 'can_upload_receipt'
  | 'can_prepare_monthly_finance_report'
  | 'can_export_finance_summary'
  | 'can_view_sponsor_payment_status'
  | 'can_approve_payment'
  | 'can_delete_finance_record'
  | 'can_change_bank_details'
  | 'can_change_payment_gateway'
  | 'can_approve_withdrawal'
  | 'can_approve_final_finance_report'
  | 'can_view_compliance'
  | 'can_create_staff'
  | 'can_suspend_staff'
  | 'can_reset_staff_password'
  | 'can_create_roles'
  | 'can_edit_roles'
  | 'can_delete_roles'
  | 'can_change_settings'
  | 'can_access_safe_zone'
  | 'can_control_ai_engine'
  | 'can_use_emergency_lock';

export type AdminModuleDefinition = {
  key: AdminModuleKey;
  label: string;
  ownerVisibilityKey?: keyof AdminFeatureVisibilityState;
};

export type SpecialRightDefinition = {
  key: SpecialRightKey;
  label: string;
};

export type RoleAccessPreset = {
  id: string;
  label: string;
  description: string;
  systemRole: boolean;
  protected?: boolean;
  modules: AdminModuleKey[];
  specialRights: SpecialRightKey[];
};

export const ADMIN_MODULES: AdminModuleDefinition[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'add_news', label: 'Add News', ownerVisibilityKey: 'add' },
  { key: 'manage_news', label: 'Manage News', ownerVisibilityKey: 'manage' },
  { key: 'draft_desk', label: 'Draft Desk', ownerVisibilityKey: 'drafts' },
  { key: 'community_reporter_queue', label: 'Community Reporter Queue', ownerVisibilityKey: 'community-reporter-queue' },
  { key: 'reporter_portal_admin', label: 'Reporter Portal Admin', ownerVisibilityKey: 'reporter-portal' },
  { key: 'broadcast_center', label: 'Broadcast Center', ownerVisibilityKey: 'broadcast-center' },
  { key: 'ads_manager', label: 'Ads Manager', ownerVisibilityKey: 'ads' },
  { key: 'finance_desk', label: 'Finance Desk', ownerVisibilityKey: 'finance' },
  { key: 'media', label: 'Media', ownerVisibilityKey: 'media' },
  { key: 'viral_videos', label: 'Viral Videos', ownerVisibilityKey: 'viral-videos' },
  { key: 'aira', label: 'AIRA', ownerVisibilityKey: 'aira' },
  { key: 'live_tv', label: 'Live TV', ownerVisibilityKey: 'livetv' },
  { key: 'editorial', label: 'Editorial', ownerVisibilityKey: 'editorial' },
  { key: 'seo', label: 'SEO', ownerVisibilityKey: 'seo' },
  { key: 'analytics', label: 'Analytics', ownerVisibilityKey: 'analytics' },
  { key: 'moderation', label: 'Moderation', ownerVisibilityKey: 'moderation' },
  { key: 'compliance_reports', label: 'Compliance Reports', ownerVisibilityKey: 'compliance-reports' },
  { key: 'ai_engine', label: 'AI Engine', ownerVisibilityKey: 'ai-engine' },
  { key: 'settings', label: 'Settings', ownerVisibilityKey: 'settings' },
  { key: 'safe_zone', label: 'Safe Zone' },
  { key: 'team_management', label: 'Team Management', ownerVisibilityKey: 'settings' },
];

export const SPECIAL_RIGHTS: SpecialRightDefinition[] = [
  { key: 'can_publish_news', label: 'Can publish news' },
  { key: 'can_delete_news', label: 'Can delete news' },
  { key: 'can_approve_news', label: 'Can approve news' },
  { key: 'can_reject_or_send_back_news', label: 'Can reject/send back news' },
  { key: 'can_pin_breaking_news', label: 'Can pin breaking news' },
  { key: 'can_prepare_live_tv', label: 'Can prepare Live TV' },
  { key: 'can_start_live_tv', label: 'Can start Live TV' },
  { key: 'can_stop_live_tv', label: 'Can stop Live TV' },
  { key: 'can_emergency_stop_live_tv', label: 'Can emergency stop Live TV' },
  { key: 'can_view_ads', label: 'Can view ads' },
  { key: 'can_manage_ad_slots', label: 'Can manage ad slots' },
  { key: 'can_manage_sponsor_leads', label: 'Can manage sponsor leads' },
  { key: 'can_manage_campaigns', label: 'Can manage campaigns' },
  { key: 'can_view_ad_analytics', label: 'Can view ad analytics' },
  { key: 'can_submit_sponsor_request_for_approval', label: 'Can submit sponsor request for approval' },
  { key: 'can_view_finance', label: 'Can view finance' },
  { key: 'can_create_invoice', label: 'Can create invoice' },
  { key: 'can_update_invoice_status', label: 'Can update invoice status' },
  { key: 'can_add_revenue_entry', label: 'Can add revenue entry' },
  { key: 'can_add_expense_entry', label: 'Can add expense entry' },
  { key: 'can_upload_receipt', label: 'Can upload receipt' },
  { key: 'can_prepare_monthly_finance_report', label: 'Can prepare monthly finance report' },
  { key: 'can_export_finance_summary', label: 'Can export finance summary' },
  { key: 'can_view_sponsor_payment_status', label: 'Can view sponsor payment status' },
  { key: 'can_approve_payment', label: 'Can approve payment' },
  { key: 'can_delete_finance_record', label: 'Can delete finance record' },
  { key: 'can_change_bank_details', label: 'Can change bank details' },
  { key: 'can_change_payment_gateway', label: 'Can change payment gateway' },
  { key: 'can_approve_withdrawal', label: 'Can approve withdrawal' },
  { key: 'can_approve_final_finance_report', label: 'Can approve final finance report' },
  { key: 'can_view_compliance', label: 'Can view compliance' },
  { key: 'can_create_staff', label: 'Can create staff' },
  { key: 'can_suspend_staff', label: 'Can suspend staff' },
  { key: 'can_reset_staff_password', label: 'Can reset staff password' },
  { key: 'can_create_roles', label: 'Can create roles' },
  { key: 'can_edit_roles', label: 'Can edit roles' },
  { key: 'can_delete_roles', label: 'Can delete roles' },
  { key: 'can_change_settings', label: 'Can change settings' },
  { key: 'can_access_safe_zone', label: 'Can access Safe Zone' },
  { key: 'can_control_ai_engine', label: 'Can control AI Engine' },
  { key: 'can_use_emergency_lock', label: 'Can use Emergency Lock' },
];

const ALL_MODULE_KEYS = ADMIN_MODULES.map((item) => item.key);
const ALL_SPECIAL_RIGHT_KEYS = SPECIAL_RIGHTS.map((item) => item.key);

const REVIEW_MODULES: AdminModuleKey[] = ['dashboard', 'manage_news', 'draft_desk', 'editorial', 'seo'];
const LIVE_MODULES: AdminModuleKey[] = ['dashboard', 'broadcast_center', 'live_tv', 'media'];
const ADS_GROWTH_RIGHTS: SpecialRightKey[] = ['can_view_ads', 'can_manage_ad_slots', 'can_manage_sponsor_leads', 'can_manage_campaigns', 'can_view_ad_analytics', 'can_submit_sponsor_request_for_approval'];
const FINANCE_OPERATIONS_RIGHTS: SpecialRightKey[] = ['can_view_finance', 'can_create_invoice', 'can_update_invoice_status', 'can_add_revenue_entry', 'can_add_expense_entry', 'can_upload_receipt', 'can_prepare_monthly_finance_report', 'can_export_finance_summary', 'can_view_sponsor_payment_status'];
const FOUNDER_ONLY_FINANCE_RIGHTS: SpecialRightKey[] = ['can_approve_payment', 'can_delete_finance_record', 'can_change_bank_details', 'can_change_payment_gateway', 'can_approve_withdrawal', 'can_approve_final_finance_report'];

export const DEFAULT_ROLE_ACCESS: RoleAccessPreset[] = [
  {
    id: 'founder',
    label: 'Founder',
    description: 'Founder has permanent ownership, full access, and unrestricted control.',
    systemRole: true,
    protected: true,
    modules: ALL_MODULE_KEYS,
    specialRights: ALL_SPECIAL_RIGHT_KEYS,
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Senior admin for newsroom operations, publishing support, analytics, and moderation. Safe Zone and Team Management require explicit Founder grant.',
    systemRole: true,
    modules: ALL_MODULE_KEYS.filter((key) => key !== 'safe_zone' && key !== 'team_management'),
    specialRights: ALL_SPECIAL_RIGHT_KEYS.filter((key) => !['can_access_safe_zone', 'can_use_emergency_lock', 'can_delete_roles', ...FOUNDER_ONLY_FINANCE_RIGHTS].includes(key)),
  },
  {
    id: 'finance_accounts_manager',
    label: 'Finance & Accounts Manager',
    description: 'Financial operations role that manages invoices, receipts, expense records, revenue entries, sponsor payment status, and monthly finance reports for the Founder. This role reports directly to the Founder and cannot change bank/payment settings or approve withdrawals.',
    systemRole: true,
    modules: ['dashboard', 'finance_desk', 'analytics'],
    specialRights: FINANCE_OPERATIONS_RIGHTS,
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Newsroom coordination role for assignments, queues, analytics review, and operational follow-up.',
    systemRole: true,
    modules: ['dashboard', 'manage_news', 'draft_desk', 'community_reporter_queue', 'reporter_portal_admin', 'editorial', 'analytics'],
    specialRights: ['can_approve_news', 'can_reject_or_send_back_news'],
  },
  {
    id: 'editor',
    label: 'Editor',
    description: 'Editorial review role for writing, editing, approving, rejecting, and sending stories back.',
    systemRole: true,
    modules: REVIEW_MODULES,
    specialRights: ['can_approve_news', 'can_reject_or_send_back_news', 'can_pin_breaking_news'],
  },
  {
    id: 'copy_editor',
    label: 'Copy Editor',
    description: 'Desk role for improving drafts, headlines, story structure, and review readiness.',
    systemRole: true,
    modules: ['dashboard', 'add_news', 'manage_news', 'draft_desk', 'editorial'],
    specialRights: ['can_reject_or_send_back_news'],
  },
  {
    id: 'fact_checker',
    label: 'Fact Checker',
    description: 'Specialist role for source verification, risky content flags, and compliance notes.',
    systemRole: true,
    modules: ['dashboard', 'manage_news', 'draft_desk', 'editorial', 'compliance_reports'],
    specialRights: ['can_reject_or_send_back_news', 'can_view_compliance'],
  },
  {
    id: 'reporter',
    label: 'Reporter',
    description: 'Field reporting role for drafting stories, uploading media, and sending reports to desk review.',
    systemRole: true,
    modules: ['dashboard', 'add_news', 'draft_desk', 'media'],
    specialRights: ['can_pin_breaking_news'],
  },
  {
    id: 'live_tv_controller',
    label: 'Live TV Controller',
    description: 'Broadcast role for stream preparation, schedules, tickers, and recordings.',
    systemRole: true,
    modules: LIVE_MODULES,
    specialRights: ['can_prepare_live_tv', 'can_start_live_tv', 'can_stop_live_tv'],
  },
  {
    id: 'video_editor',
    label: 'Video Editor',
    description: 'Media role for clips, thumbnails, recordings, and packages prepared for editorial or broadcast approval.',
    systemRole: true,
    modules: ['dashboard', 'media', 'viral_videos', 'live_tv'],
    specialRights: ['can_prepare_live_tv'],
  },
  {
    id: 'ads_revenue_growth_manager',
    label: 'Ads & Revenue Growth Manager',
    description: 'Growth-focused role for ad slots, sponsor leads, campaigns, ad performance, and revenue growth planning. This role does not manage financial records, invoices, expenses, bank details, withdrawals, or payment approvals.',
    systemRole: true,
    modules: ['dashboard', 'ads_manager', 'analytics'],
    specialRights: ADS_GROWTH_RIGHTS,
  },
  {
    id: 'social_media_manager',
    label: 'Social Media Manager',
    description: 'Audience distribution role for social copy, public updates, short promos, and approved amplification.',
    systemRole: true,
    modules: ['dashboard', 'manage_news', 'media', 'viral_videos', 'analytics'],
    specialRights: ['can_pin_breaking_news', 'can_view_ad_analytics'],
  },
  {
    id: 'tech_support',
    label: 'Tech Support',
    description: 'Technical support role for diagnostics, login support, audit-assisted troubleshooting, and account help.',
    systemRole: true,
    modules: ['dashboard', 'analytics', 'moderation', 'settings'],
    specialRights: ['can_reset_staff_password'],
  },
  {
    id: 'intern',
    label: 'Intern',
    description: 'Limited trainee role for supervised drafts, research notes, and newsroom learning tasks.',
    systemRole: true,
    modules: ['dashboard', 'add_news', 'draft_desk'],
    specialRights: [],
  },
];

const ROLE_ALIASES: Record<string, string> = {
  owner: 'founder',
  copyeditor: 'copy_editor',
  copy_editor: 'copy_editor',
  'copy editor': 'copy_editor',
  factchecker: 'fact_checker',
  fact_checker: 'fact_checker',
  'fact checker': 'fact_checker',
  videoeditor: 'video_editor',
  video_editor: 'video_editor',
  'video editor': 'video_editor',
  finance_accounts_manager: 'finance_accounts_manager',
  'finance & accounts manager': 'finance_accounts_manager',
  'finance and accounts manager': 'finance_accounts_manager',
  livetv_controller: 'live_tv_controller',
  live_tv_controller: 'live_tv_controller',
  'live tv controller': 'live_tv_controller',
  social_media_manager: 'social_media_manager',
  'social media manager': 'social_media_manager',
  ads_revenue_manager: 'ads_revenue_growth_manager',
  ads_revenue_growth_manager: 'ads_revenue_growth_manager',
  'ads / revenue manager': 'ads_revenue_growth_manager',
  'ads & revenue growth manager': 'ads_revenue_growth_manager',
  'ads and revenue growth manager': 'ads_revenue_growth_manager',
  techsupport: 'tech_support',
  tech_support: 'tech_support',
  'tech support': 'tech_support',
};

const VALID_MODULE_KEYS = new Set<string>(ALL_MODULE_KEYS);
const VALID_SPECIAL_RIGHT_KEYS = new Set<string>(ALL_SPECIAL_RIGHT_KEYS);

export function normalizeRoleId(role: unknown): string {
  const raw = String(role || '').trim().toLowerCase();
  const normalized = raw.replace(/[\s/-]+/g, '_');
  return ROLE_ALIASES[raw] || ROLE_ALIASES[normalized] || normalized;
}

export function normalizeModuleKeys(input: unknown): AdminModuleKey[] {
  if (!input) return [];
  const values = Array.isArray(input) ? input : String(input).split(',');
  return Array.from(new Set(values.map((item) => String(item).trim()).filter((item) => VALID_MODULE_KEYS.has(item)))) as AdminModuleKey[];
}

export function normalizeSpecialRightKeys(input: unknown): SpecialRightKey[] {
  if (!input) return [];
  const values = Array.isArray(input) ? input : String(input).split(',');
  return Array.from(new Set(values.map((item) => String(item).trim()).filter((item) => VALID_SPECIAL_RIGHT_KEYS.has(item)))) as SpecialRightKey[];
}

export function getDefaultRoleAccess(role: unknown): RoleAccessPreset | undefined {
  const normalized = normalizeRoleId(role);
  return DEFAULT_ROLE_ACCESS.find((item) => item.id === normalized);
}

function firstArray(...values: unknown[]): unknown[] | undefined {
  return values.find((value): value is unknown[] => Array.isArray(value));
}

function getExplicitModules(user: any): AdminModuleKey[] {
  return normalizeModuleKeys(firstArray(
    user?.moduleAccess,
    user?.moduleAccessKeys,
    user?.modules,
    user?.access?.modules,
    user?.accessControl?.modules,
    user?.roleAccess?.modules,
  ));
}

function getOverrideModules(user: any): { allow: AdminModuleKey[]; deny: AdminModuleKey[] } {
  const overrides = user?.accessOverrides || user?.individualOverrides || user?.overrides || {};
  return {
    allow: normalizeModuleKeys(firstArray(overrides?.moduleAccess, overrides?.modules, overrides?.allowModules, overrides?.modulesAllow)),
    deny: normalizeModuleKeys(firstArray(overrides?.denyModules, overrides?.modulesDeny, overrides?.blockedModules)),
  };
}

export function getEffectiveModuleAccess(user: any): AdminModuleKey[] {
  const roleId = normalizeRoleId(user?.role);
  if (roleId === 'founder') return ALL_MODULE_KEYS;
  const explicit = getExplicitModules(user);
  const roleDefault = getDefaultRoleAccess(roleId)?.modules || ['dashboard'];
  const base = explicit.length ? explicit : roleDefault;
  const overrides = getOverrideModules(user);
  const denied = new Set(overrides.deny);
  return Array.from(new Set([...base, ...overrides.allow])).filter((key) => !denied.has(key));
}

export function getEffectiveSpecialRights(user: any): SpecialRightKey[] {
  const roleId = normalizeRoleId(user?.role);
  if (roleId === 'founder') return ALL_SPECIAL_RIGHT_KEYS;
  const explicit = normalizeSpecialRightKeys(firstArray(
    user?.specialRights,
    user?.rights,
    user?.access?.specialRights,
    user?.accessControl?.specialRights,
    user?.roleAccess?.specialRights,
  ));
  const roleDefault = getDefaultRoleAccess(roleId)?.specialRights || [];
  const overrides = user?.accessOverrides || user?.individualOverrides || user?.overrides || {};
  const allow = normalizeSpecialRightKeys(firstArray(overrides?.specialRights, overrides?.allowSpecialRights, overrides?.rightsAllow));
  const deny = new Set(normalizeSpecialRightKeys(firstArray(overrides?.denySpecialRights, overrides?.rightsDeny, overrides?.blockedSpecialRights)));
  const base = explicit.length ? explicit : roleDefault;
  return Array.from(new Set([...base, ...allow])).filter((key) => !deny.has(key));
}

export function canAccessAdminModule(user: any, moduleKey: AdminModuleKey, visibility?: AdminFeatureVisibilityState): boolean {
  const roleId = normalizeRoleId(user?.role);
  if (roleId === 'founder') return true;
  const hasModuleAccess = getEffectiveModuleAccess(user).includes(moduleKey);
  if (!hasModuleAccess) return false;
  const definition = ADMIN_MODULES.find((item) => item.key === moduleKey);
  if (definition?.ownerVisibilityKey && visibility?.[definition.ownerVisibilityKey] === false) return false;
  return true;
}

export function canAccessAnyAdminModule(user: any, moduleKeys: AdminModuleKey[], visibility?: AdminFeatureVisibilityState): boolean {
  return moduleKeys.some((moduleKey) => canAccessAdminModule(user, moduleKey, visibility));
}