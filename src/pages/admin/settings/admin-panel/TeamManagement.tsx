import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  archiveUser,
  changeTeamUserEmail,
  createTeamRole,
  createTeamTask,
  createTeamUser,
  deleteTestUserOnly,
  extendAccessUser,
  forceChangePasswordUser,
  generateTemporaryPasswordUser,
  getNextTeamStaffIdPreview,
  getTeamRoles,
  getTeamTasks,
  getTeamUsers,
  isTeamApiUnauthorized,
  isTeamRoleApiUnavailable,
  lockUser,
  logTeamApiError,
  logoutAllTeamUserDevices,
  markTestAccountUser,
  reactivateUser,
  resetPasswordUser,
  restoreUser,
  saveStaffAccessOverride,
  suspendUser,
  TEAM_ROLE_API_UNAVAILABLE_MESSAGE,
  toTeamApiErrorMessage,
  updateTeamUser,
  updateTeamRole,
  type TeamUser,
  type TeamRole,
  type TeamTask,
} from '@/api/teamManagementApi';
import AuditLogsView from '@/pages/admin/settings/admin-panel/AuditLogsView';
import { AdminApiError } from '@/lib/http/adminFetch';
import {
  ADMIN_MODULES,
  DEFAULT_ROLE_ACCESS,
  SPECIAL_RIGHTS,
  getDefaultRoleAccess,
  getEffectiveModuleAccess,
  getEffectiveSpecialRights,
  normalizeRoleId,
  type AdminModuleKey,
  type SpecialRightKey,
} from '@/lib/adminAccessControl';

const FOUNDER_EMAIL = 'kiran@newspulse.co.in';
const FOUNDER_RECOVERY_EMAIL = 'newspulse.team@gmail.com';
const FOUNDER_NAME = 'Kiran Founder';
const FOUNDER_STAFF_ID = 'NP-FND-0001';
const LEGACY_FOUNDER_EMAILS = new Set(['owner@newspulse.co.in', 'admin@newspulse.ai', 'founder@newspulse.ai', FOUNDER_RECOVERY_EMAIL]);
const SHARED_NEWS_PULSE_SYSTEM_EMAILS = new Set(['newspulse.team@gmail.com', 'newspulse.admin@gmail.com', 'newspulse.ads@gmail.com']);

type BadgeTone = 'full' | 'protected' | 'editorial' | 'desk' | 'field' | 'live' | 'technical' | 'revenue' | 'finance' | 'growth' | 'limited';
type RoleBadge = { label: string; tone: BadgeTone };
type StatusTone = 'emerald' | 'amber' | 'rose' | 'sky' | 'slate' | 'blue' | 'violet';
type SessionStatusLabel = 'Active Session' | 'No Active Session' | 'Logged Out' | 'Session Expired';
type RoleConfig = {
  id: string;
  label: string;
  description: string;
  permissions: string[];
  badges: RoleBadge[];
  protected?: boolean;
};
type EmailChangeForm = {
  newEmail: string;
  reason: string;
  forcePasswordChange: boolean;
  logoutAllDevices: boolean;
  confirmedSamePerson: boolean;
};
type EditAccountForm = {
  fullName: string;
  role: string;
  department: string;
  assignedSections: string[];
  coverageArea: string[];
  designation: string;
  accessExpiryDate: string;
  accountStatus: string;
};
type PasswordActionMode = 'generate' | 'reset';
type StaffListFilter = 'active' | 'expired' | 'suspended' | 'archived' | 'testDeleted' | 'all';
type StaffControlTab = 'create' | 'registry' | 'access' | 'tasks' | 'account' | 'security' | 'roles' | 'archived' | 'audit';
type StaffDetailsTab = 'profile' | 'tasks' | 'access' | 'rights' | 'account' | 'security' | 'activity' | 'danger';
type CreateWizardStep = 'accountType' | 'details' | 'work' | 'review';
type AccessStudioTab = 'modules' | 'newsroom' | 'liveTv' | 'staffAdmin' | 'security' | 'system' | 'temporary' | 'review';
type AccessControlState = 'enabled' | 'disabled' | 'temporary' | 'founder_only' | 'locked';
type TemporaryAccessGrant = { targetType: 'module' | 'right'; key: AdminModuleKey | SpecialRightKey; expiresAt: string; reason: string; grantedBy: string };
type StaffActionModal =
  | { type: 'password'; mode: PasswordActionMode; user: TeamUser }
  | { type: 'access'; user: TeamUser }
  | { type: 'archive'; user: TeamUser }
  | { type: 'delete-test'; user: TeamUser }
  | { type: 'mark-test'; user: TeamUser };

const STAFF_CONTROL_TABS: { key: StaffControlTab; label: string }[] = [
  { key: 'create', label: 'Create Staff Account' },
  { key: 'registry', label: 'Staff Registry' },
  { key: 'access', label: 'Staff Access & Special Rights' },
  { key: 'tasks', label: 'Staff Tasks' },
  { key: 'account', label: 'Account Control' },
  { key: 'security', label: 'Security & Sessions' },
  { key: 'roles', label: 'Roles & Workflow' },
  { key: 'archived', label: 'Archived / Test Accounts' },
  { key: 'audit', label: 'Audit Logs' },
];

const STAFF_DETAILS_TABS: { key: StaffDetailsTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'tasks', label: 'Work & Tasks' },
  { key: 'access', label: 'Access' },
  { key: 'rights', label: 'Special Rights' },
  { key: 'account', label: 'Account Control' },
  { key: 'security', label: 'Password & Sessions' },
  { key: 'activity', label: 'Activity' },
  { key: 'danger', label: 'Danger Zone' },
];

const CREATE_STAFF_STEPS: { key: CreateWizardStep; label: string }[] = [
  { key: 'accountType', label: 'Account Type' },
  { key: 'details', label: 'Staff Details' },
  { key: 'work', label: 'Role & Work' },
  { key: 'review', label: 'Password & Create' },
];

const EMPLOYMENT_TYPE_OPTIONS = ['Full Time', 'Part Time', 'Contract', 'Freelance', 'Internship', 'Temporary'];
const ACCOUNT_GROUPS = ['Founder Account', 'Management Staff', 'Field Network Staff', 'Staff Account / Newsroom Staff'] as const;
const ACCOUNT_GROUP_POSITIONS: Record<string, string[]> = {
  'Founder Account': ['Founder protected read-only'],
  'Management Staff': ['Manager', 'HR & Admin', 'Finance & Accounts', 'Ads & Revenue Growth', 'Chief Editor', 'Tech Support', 'Grievance Officer', 'SEO Executive', 'Marketing Manager'],
  'Field Network Staff': ['Bureau Chief', 'State Coordinator', 'District Reporter', 'Community Reporter Coordinator'],
  'Staff Account / Newsroom Staff': ['Editorial Head', 'Copy Editor', 'Reporter', 'Live TV Controller', 'Video Editor', 'Social Media', 'Ads Marketing', 'Intern'],
};
const POSITION_ROLE_MAP: Record<string, string> = {
  Manager: 'manager',
  'HR & Admin': 'manager',
  'Finance & Accounts': 'finance_accounts_manager',
  'Ads & Revenue Growth': 'ads_revenue_growth_manager',
  'Chief Editor': 'editor',
  'Tech Support': 'tech_support',
  'Grievance Officer': 'manager',
  'SEO Executive': 'editor',
  'Marketing Manager': 'social_media_manager',
  'Bureau Chief': 'manager',
  'State Coordinator': 'manager',
  'District Reporter': 'reporter',
  'Community Reporter Coordinator': 'reporter',
  'Editorial Head': 'editor',
  'Copy Editor': 'copy_editor',
  Reporter: 'reporter',
  'Live TV Controller': 'live_tv_controller',
  'Video Editor': 'video_editor',
  'Social Media': 'social_media_manager',
  'Ads Marketing': 'ads_revenue_growth_manager',
  Intern: 'intern',
};
const DEFAULT_TASKS_BY_POSITION: Record<string, string[]> = {
  Manager: ['daily operations follow-up', 'staff task tracking', 'department coordination'],
  'HR & Admin': ['staff onboarding', 'attendance check', 'leave/off-day update'],
  'Finance & Accounts': ['invoice preparation', 'expense entry', 'receipt upload'],
  'Ads & Revenue Growth': ['sponsor lead follow-up', 'campaign planning'],
  'Chief Editor': ['daily story planning', 'sensitive story review'],
  'Tech Support': ['bug report check', 'login issue support'],
  'Grievance Officer': ['complaint follow-up', 'grievance status update'],
  'SEO Executive': ['keyword plan', 'SEO audit'],
  'Marketing Manager': ['promotion campaign', 'partnership follow-up'],
  Reporter: ['report assigned story', 'submit field update'],
  'Live TV Controller': ['prepare live TV', 'update ticker'],
};
const TASK_CATEGORIES = ['Founder Task', 'Management Task', 'HR/Admin Task', 'Finance Task', 'Ads / Revenue Task', 'Marketing Task', 'Editorial Task', 'Reporting Task', 'Field Network Task', 'Technical Task', 'Grievance / Compliance Task', 'SEO Task', 'Live TV Task', 'Video Task', 'Social Media Task', 'Intern Task'];
const TASK_LEVELS = ['Founder Level', 'Management Level', 'Department Level', 'Staff Level', 'Field Level'];
const TASK_STATUSES = ['Assigned', 'In Progress', 'Submitted', 'Under Review', 'Completed', 'Closed', 'Overdue', 'Cancelled'];
const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const TASK_BOARD_VIEWS = ['My Tasks', 'Team Tasks', 'Management Tasks', 'Field Tasks', 'Newsroom Tasks', 'Overdue Tasks'];

const FOUNDER_ONLY_MODULES = new Set<AdminModuleKey>(['safe_zone']);
const FOUNDER_ONLY_RIGHTS = new Set<SpecialRightKey>(['can_emergency_stop_live_tv', 'can_access_safe_zone', 'can_use_emergency_lock', 'can_change_bank_details', 'can_change_payment_gateway', 'can_approve_withdrawal', 'can_approve_final_finance_report', 'can_delete_staff_permanently', 'can_control_founder_account', 'can_grant_account_control_rights']);

const ACCESS_STUDIO_TABS: { key: AccessStudioTab; label: string }[] = [
  { key: 'modules', label: 'Step 2: What can this staff open?' },
  { key: 'newsroom', label: 'Newsroom Actions' },
  { key: 'liveTv', label: 'Live TV Actions' },
  { key: 'staffAdmin', label: 'Staff Account Control' },
  { key: 'security', label: 'Founder Only Locked Rights' },
  { key: 'system', label: 'Settings / AI / Compliance' },
  { key: 'temporary', label: 'Temporary Access' },
  { key: 'review', label: 'Step 4: Review & Save' },
];

const ACCESS_STATE_LABEL: Record<AccessControlState, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
  temporary: 'Temporary',
  founder_only: 'Founder Only',
  locked: 'Locked',
};

const RIGHT_TAB_GROUPS: Record<Exclude<AccessStudioTab, 'modules' | 'temporary' | 'review'>, SpecialRightKey[]> = {
  newsroom: ['can_create_news', 'can_edit_news', 'can_submit_news', 'can_approve_news', 'can_reject_or_send_back_news', 'can_publish_news', 'can_schedule_news', 'can_delete_news', 'can_pin_breaking_news', 'can_restore_news'],
  liveTv: ['can_prepare_live_tv', 'can_edit_live_tv_title', 'can_add_stream_link', 'can_update_ticker', 'can_schedule_live_tv', 'can_start_live_tv', 'can_stop_live_tv', 'can_emergency_stop_live_tv'],
  staffAdmin: ['can_view_staff_details', 'can_edit_staff_basic_details', 'can_change_staff_email', 'can_generate_temporary_password', 'can_reset_staff_password', 'can_force_password_change', 'can_logout_all_devices', 'can_extend_or_reactivate_staff', 'can_suspend_staff_account', 'can_lock_staff_account', 'can_archive_staff', 'can_delete_staff_permanently', 'can_control_founder_account', 'can_grant_account_control_rights'],
  security: ['can_access_safe_zone', 'can_use_emergency_lock', 'can_emergency_stop_live_tv'],
  system: ['can_change_settings', 'can_control_ai_engine', 'can_view_compliance'],
};

const PERMISSION_GROUPS = [
  { title: 'content permissions', permissions: ['content.create', 'content.edit_own', 'content.edit_assigned', 'content.review', 'content.approve', 'content.reject', 'content.send_back', 'content.publish', 'content.unpublish', 'content.schedule', 'content.delete_own', 'content.delete_all', 'content.pin_breaking', 'content.manage_categories'] },
  { title: 'fact-check permissions', permissions: ['factcheck.review', 'factcheck.verify_sources', 'factcheck.add_notes', 'factcheck.flag_risky', 'factcheck.clear_flag'] },
  { title: 'team permissions', permissions: ['team.view', 'team.create', 'team.edit', 'team.suspend', 'team.delete', 'team.change_role', 'team.reset_password', 'team.view_activity'] },
  { title: 'founder permissions', permissions: ['founder.safe_zone', 'founder.emergency_lock', 'founder.full_audit', 'founder.system_control', 'founder.ai_control', 'founder.ownership_lock'] },
  { title: 'live tv permissions', permissions: ['livetv.view', 'livetv.prepare', 'livetv.add_stream_link', 'livetv.schedule', 'livetv.start', 'livetv.stop', 'livetv.emergency_stop', 'livetv.publish_to_home', 'livetv.manage_ticker', 'livetv.manage_recordings'] },
  { title: 'ads/growth permissions', permissions: ['ads.view', 'ads.manage_slots', 'ads.manage_sponsor_leads', 'ads.manage_campaigns', 'ads.view_analytics', 'ads.submit_sponsor_request'] },
  { title: 'finance permissions', permissions: ['finance.view', 'finance.create_invoice', 'finance.update_invoice_status', 'finance.add_revenue_entry', 'finance.add_expense_entry', 'finance.upload_receipt', 'finance.prepare_monthly_report', 'finance.export_summary', 'finance.view_sponsor_payment_status'] },
  { title: 'settings permissions', permissions: ['settings.view_admin_panel', 'settings.edit_admin_panel', 'settings.security', 'settings.translation', 'settings.glossary', 'settings.audit_logs', 'settings.preview'] },
  { title: 'auth permissions', permissions: ['auth.create_user', 'auth.reset_password', 'auth.generate_temp_password', 'auth.force_password_change', 'auth.suspend_user', 'auth.lock_user', 'auth.logout_user_sessions', 'auth.view_login_activity'] },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions);
const permissionsFrom = (...titles: string[]) => PERMISSION_GROUPS.filter((group) => titles.includes(group.title)).flatMap((group) => group.permissions);
const badge = (label: string, tone: BadgeTone): RoleBadge => ({ label, tone });

const ROLE_CONFIGS: RoleConfig[] = [
  {
    id: 'founder',
    label: 'Founder',
    description: 'Founder has all rights reserved, full module access, final control over roles, permissions, Safe Owner Zone, Admin Panel Settings, publishing, team access, Live TV, ads, legal, AI/KiranOS, audit logs, and emergency controls.',
    permissions: ALL_PERMISSIONS,
    badges: [badge('Full Access', 'full'), badge('Protected', 'protected')],
    protected: true,
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Senior admin role for approved publishing, team operations, admin panel settings, Live TV approval, ads oversight, audit visibility, and sensitive controls granted by Founder.',
    permissions: [...permissionsFrom('content permissions', 'fact-check permissions', 'team permissions', 'live tv permissions', 'ads/growth permissions', 'finance permissions', 'settings permissions', 'auth permissions'), 'founder.full_audit', 'founder.ai_control'],
    badges: [badge('Full Access', 'full'), badge('Editorial', 'editorial'), badge('Live TV', 'live')],
  },
  {
    id: 'finance_accounts_manager',
    label: 'Finance & Accounts Manager',
    description: 'Financial operations role that manages invoices, receipts, expense records, revenue entries, sponsor payment status, and monthly finance reports for the Founder. This role reports directly to the Founder and cannot change bank/payment settings or approve withdrawals.',
    permissions: permissionsFrom('finance permissions'),
    badges: [badge('Finance', 'finance'), badge('Founder Reports', 'protected')],
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Newsroom coordination role for assignments, story queues, team activity visibility, scheduling plans, and operational follow-up without Founder ownership controls.',
    permissions: ['content.create', 'content.edit_own', 'content.edit_assigned', 'content.review', 'content.send_back', 'content.schedule', 'team.view', 'team.view_activity', 'settings.preview'],
    badges: [badge('Editorial', 'editorial'), badge('Desk', 'desk')],
  },
  {
    id: 'editor',
    label: 'Editor',
    description: 'Editorial review role with fact-checking rights. Editor can write, edit, review, verify sources, approve, reject, and send stories back for correction. Editor may publish only if Founder grants publishing permission.',
    permissions: ['content.create', 'content.edit_own', 'content.edit_assigned', 'content.review', 'content.approve', 'content.reject', 'content.send_back', 'content.schedule', 'content.pin_breaking', 'factcheck.review', 'factcheck.verify_sources', 'factcheck.add_notes', 'factcheck.flag_risky', 'factcheck.clear_flag', 'settings.preview'],
    badges: [badge('Editorial', 'editorial'), badge('Desk', 'desk')],
  },
  {
    id: 'copyeditor',
    label: 'Copy Editor',
    description: 'Desk-based newsroom role. Can write desk stories, improve reporter drafts, correct grammar, edit headlines, and prepare articles for editorial approval. Copy Editor can create and edit stories but cannot publish unless Founder gives special permission.',
    permissions: ['content.create', 'content.edit_own', 'content.edit_assigned', 'content.send_back', 'settings.preview'],
    badges: [badge('Desk', 'desk'), badge('Editorial', 'editorial')],
  },
  {
    id: 'factchecker',
    label: 'Fact Checker',
    description: 'Optional specialist role for future use. This role can verify facts, check sources, flag risky content, and add verification notes. In the current News Pulse workflow, Editor already has Fact Checker rights by default.',
    permissions: ['content.review', 'factcheck.review', 'factcheck.verify_sources', 'factcheck.add_notes', 'factcheck.flag_risky', 'factcheck.clear_flag'],
    badges: [badge('Editorial', 'editorial'), badge('Limited', 'limited')],
  },
  {
    id: 'reporter',
    label: 'Reporter',
    description: 'Field-based reporting role. Can submit raw field reports, upload media, write full story drafts, add sources, and send breaking alerts to the desk. Reporter can create stories but cannot publish directly unless Founder gives special permission.',
    permissions: ['content.create', 'content.edit_own', 'content.delete_own', 'content.pin_breaking', 'settings.preview'],
    badges: [badge('Field', 'field'), badge('Editorial', 'editorial')],
  },
  {
    id: 'livetv_controller',
    label: 'Live TV Controller',
    description: 'Broadcast preparation role for live stream links, titles, descriptions, tickers, schedules, live status, recordings, and clips. Going LIVE remains Founder/Admin approval controlled.',
    permissions: ['livetv.view', 'livetv.prepare', 'livetv.add_stream_link', 'livetv.schedule', 'livetv.manage_ticker', 'livetv.manage_recordings', 'settings.preview'],
    badges: [badge('Live TV', 'live'), badge('Limited', 'limited')],
  },
  {
    id: 'video_editor',
    label: 'Video Editor',
    description: 'Media role for newsroom clips, videos, thumbnails, packages, and recordings prepared for editorial or broadcast approval.',
    permissions: ['content.create', 'content.edit_own', 'content.edit_assigned', 'livetv.view', 'livetv.manage_recordings', 'settings.preview'],
    badges: [badge('Editorial', 'editorial'), badge('Live TV', 'live')],
  },
  {
    id: 'ads_revenue_growth_manager',
    label: 'Ads & Revenue Growth Manager',
    description: 'Growth-focused role for ad slots, sponsor leads, campaigns, ad performance, and revenue growth planning. This role does not manage financial records, invoices, expenses, bank details, withdrawals, or payment approvals.',
    permissions: permissionsFrom('ads/growth permissions'),
    badges: [badge('Growth', 'growth'), badge('Ads', 'revenue')],
  },
  {
    id: 'social_media_manager',
    label: 'Social Media Manager',
    description: 'Audience distribution role for social copy, public updates, breaking alerts, short promos, and approved content amplification.',
    permissions: ['content.create', 'content.edit_own', 'content.schedule', 'content.pin_breaking', 'settings.preview'],
    badges: [badge('Editorial', 'editorial'), badge('Limited', 'limited')],
  },
  {
    id: 'tech_support',
    label: 'Tech Support',
    description: 'Technical role for login support, account reset assistance, security diagnostics, audit-assisted troubleshooting, and admin support.',
    permissions: ['team.view', 'team.reset_password', 'settings.view_admin_panel', 'settings.security', 'settings.audit_logs', 'auth.reset_password', 'auth.force_password_change', 'auth.logout_user_sessions', 'auth.view_login_activity'],
    badges: [badge('Technical', 'technical')],
  },
  {
    id: 'intern',
    label: 'Intern',
    description: 'Limited trainee role for supervised drafts, research notes, and newsroom learning tasks without publishing or settings access.',
    permissions: ['content.create', 'content.edit_own'],
    badges: [badge('Limited', 'limited')],
  },
];

const ACCOUNT_STATUS_OPTIONS = ['active', 'expired', 'suspended', 'locked', 'inactive', 'left', 'archived'];
const STAFF_LIST_FILTERS: { key: StaffListFilter; label: string }[] = [
  { key: 'active', label: 'Active Staff' },
  { key: 'expired', label: 'Expired' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'archived', label: 'Archived' },
  { key: 'testDeleted', label: 'Test/Deleted' },
  { key: 'all', label: 'Show All' },
];

const STORY_RIGHTS = [
  { title: 'Editor', points: ['write stories', 'edit assigned stories', 'review reporter drafts', 'review copy editor desk stories', 'check facts', 'verify sources', 'add fact-check notes', 'flag risky content', 'approve article', 'reject article', 'send article back for correction', 'publish only if Founder gives publishing permission'] },
  { title: 'Copy Editor', points: ['write desk stories', 'rewrite reporter raw copy', 'correct grammar/spelling', 'improve headlines', 'improve article structure', 'prepare article for Editor approval', 'submit story for review', 'cannot publish unless Founder gives special permission'] },
  { title: 'Reporter', points: ['submit raw field story', 'write full draft story', 'upload photos/videos from field', 'add source links', 'add interview notes', 'submit breaking alert', 'send story to Copy Editor or Editor', 'cannot publish directly unless Founder gives special permission'] },
];

const WORKFLOWS = [
  'Reporter -> Copy Editor -> Editor with Fact Check Rights -> Admin/Founder Publish',
  'Copy Editor -> Editor with Fact Check Rights -> Admin/Founder Publish',
  'Reporter/Editor -> Admin/Founder Approval -> Publish / Breaking Ticker',
];

const badgeClass = (tone: BadgeTone) => {
  const map: Record<BadgeTone, string> = {
    full: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    protected: 'border-rose-200 bg-rose-100 text-rose-800',
    editorial: 'border-indigo-200 bg-indigo-100 text-indigo-800',
    desk: 'border-blue-200 bg-blue-100 text-blue-800',
    field: 'border-orange-200 bg-orange-100 text-orange-800',
    live: 'border-sky-200 bg-sky-100 text-sky-800',
    technical: 'border-violet-200 bg-violet-100 text-violet-800',
    revenue: 'border-amber-200 bg-amber-100 text-amber-800',
    finance: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    growth: 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800',
    limited: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return map[tone];
};

const roleById = (role?: string) => {
  const normalized = normalizeRoleId(role);
  return ROLE_CONFIGS.find((item) => normalizeRoleId(item.id) === normalized);
};

const checkboxGridClass = 'grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3';
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';
const fieldLabelClass = 'space-y-1.5 text-sm font-semibold text-slate-800';

const DEPARTMENT_OPTIONS = [
  'Administration',
  'Finance & Accounts',
  'Operations / Newsroom Management',
  'Editorial / Newsroom',
  'Copy Desk / Editorial Desk',
  'Fact Check / Compliance',
  'Field Reporting / Newsroom',
  'Broadcast / Live TV',
  'Video Production',
  'Growth / Monetization',
  'Social Media',
  'Technology / IT',
  'Training / Internship',
];

const ASSIGNED_SECTION_OPTIONS = [
  'All Sections',
  'National',
  'International',
  'Business',
  'Technology',
  'Science',
  'Sports',
  'Entertainment',
  'Lifestyle',
  'Gujarat',
  'Editorial',
  'Viral Videos',
  'Live TV',
  'Ads',
  'Finance',
  'Compliance',
  'SEO',
  'Analytics',
  'Technical',
  'Training',
];

const COVERAGE_AREA_OPTIONS = [
  'All Gujarat',
  'Ahmedabad',
  'Surat',
  'Rajkot',
  'Vadodara',
  'Gandhinagar',
  'Kutch',
  'Saurashtra',
  'South Gujarat',
  'North Gujarat',
  'Central Gujarat',
];

const ROLE_DEPARTMENT_MAP: Record<string, string> = {
  founder: 'Founder / Ownership',
  admin: 'Administration',
  finance_accounts_manager: 'Finance & Accounts',
  manager: 'Operations / Newsroom Management',
  editor: 'Editorial / Newsroom',
  copy_editor: 'Copy Desk / Editorial Desk',
  fact_checker: 'Fact Check / Compliance',
  reporter: 'Field Reporting / Newsroom',
  live_tv_controller: 'Broadcast / Live TV',
  video_editor: 'Video Production',
  ads_revenue_growth_manager: 'Growth / Monetization',
  social_media_manager: 'Social Media',
  tech_support: 'Technology / IT',
  intern: 'Training / Internship',
};

const FOUNDER_DEPARTMENT = ROLE_DEPARTMENT_MAP.founder;

function isFounderRole(role?: string): boolean {
  return normalizeRoleId(role) === 'founder';
}

function defaultDepartmentForRole(role?: string): string {
  return ROLE_DEPARTMENT_MAP[normalizeRoleId(role)] || 'Editorial / Newsroom';
}

function safeDepartmentForRole(role: string, department: string): string {
  if (!isFounderRole(role) && department === FOUNDER_DEPARTMENT) return defaultDepartmentForRole(role);
  return department || defaultDepartmentForRole(role);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function statusTone(value?: unknown): StatusTone {
  const status = String(value || '').trim().toLowerCase();
  if (['active', 'online', 'present', 'approved', 'active session'].includes(status)) return 'emerald';
  if (['idle', 'late', 'half day', 'half_day', 'pending'].includes(status)) return 'amber';
  if (['on break', 'on_break'].includes(status)) return 'sky';
  if (['on leave', 'on_leave', 'off day', 'off_day'].includes(status)) return 'blue';
  if (['you'].includes(status)) return 'violet';
  if (['suspended', 'locked', 'expired', 'absent', 'rejected', 'session expired', 'archived', 'left'].includes(status)) return 'rose';
  return 'slate';
}

function StatusPill({ label, tone }: { label: string; tone?: StatusTone }) {
  const map: Record<StatusTone, string> = {
    emerald: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    amber: 'border-amber-200 bg-amber-100 text-amber-800',
    rose: 'border-rose-200 bg-rose-100 text-rose-800',
    sky: 'border-sky-200 bg-sky-100 text-sky-800',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    blue: 'border-blue-200 bg-blue-100 text-blue-800',
    violet: 'border-violet-200 bg-violet-100 text-violet-800',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[tone || statusTone(label)]}`}>{label}</span>;
}

function accountStatusFor(teamUser: TeamUser, active: boolean): 'Active' | 'Suspended' | 'Locked' | 'Expired' {
  const status = String(teamUser?.accountStatus || teamUser?.status || '').trim().toLowerCase();
  const expiry = String(accessExpiryValue(teamUser)).trim();
  if (expiry) {
    const expiryDate = new Date(expiry);
    if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now()) return 'Expired';
  }
  if (status === 'locked') return 'Locked';
  if (status === 'expired') return 'Expired';
  if (!active || ['suspended', 'inactive', 'disabled'].includes(status)) return 'Suspended';
  return 'Active';
}

function toggleValue<T extends string>(values: T[], value: T, checked: boolean): T[] {
  if (checked) return values.includes(value) ? values : [...values, value];
  return values.filter((item) => item !== value);
}

function defaultModulesForRole(role?: string): AdminModuleKey[] {
  return (getDefaultRoleAccess(role)?.modules || []) as AdminModuleKey[];
}

function defaultRightsForRole(role?: string): SpecialRightKey[] {
  return (getDefaultRoleAccess(role)?.specialRights || []) as SpecialRightKey[];
}

function roleLabel(role?: string): string {
  const normalized = normalizeRoleId(role);
  return DEFAULT_ROLE_ACCESS.find((item) => item.id === normalized)?.label || roleById(role)?.label || String(role || 'Staff');
}

function accessExpiryValue(teamUser: TeamUser): string {
  return String(teamUser?.accessExpiryDate || teamUser?.accessExpiresAt || (teamUser as any).expiresAt || '').trim();
}

function dateInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function rawAccountStatus(teamUser: TeamUser): string {
  return String(teamUser?.accountStatus || teamUser?.status || '').trim().toLowerCase();
}

function displayAccountStatus(teamUser: TeamUser, active: boolean): string {
  const raw = rawAccountStatus(teamUser);
  if (isDeletedOrTestRemovedStaff(teamUser)) return 'Deleted/Test Removed';
  if (raw === 'archived') return 'Archived';
  if (raw === 'inactive') return 'Inactive';
  if (raw === 'left') return 'Left';
  if (raw === 'suspicious') return 'Suspicious';
  return accountStatusFor(teamUser, active);
}

function listText(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '-';
  if (typeof value === 'string' && value.trim()) return value;
  return '-';
}

function displayDepartment(teamUser: TeamUser, founder: boolean): string {
  if (founder) return FOUNDER_DEPARTMENT;
  return listText(teamUser.department);
}

function displayFullName(teamUser: TeamUser, founder: boolean): string {
  return String(teamUser.fullName || teamUser.name || (founder ? FOUNDER_NAME : 'Unnamed staff'));
}

function coverageAreaValues(teamUser: TeamUser): string[] {
  const value = (teamUser as any).coverageArea || teamUser.coverageArea || teamUser.coverageAreas;
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function displayStaffId(staffId?: unknown, founder = false): string {
  if (founder) return FOUNDER_STAFF_ID;
  const value = String(staffId || '').trim();
  if (!value || /^np-backend/i.test(value)) return 'Pending ID';
  return value;
}

function normalizedIdentity(value?: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isPrimaryFounderEmail(email?: unknown): boolean {
  return normalizedIdentity(email) === FOUNDER_EMAIL;
}

function isProtectedFounderCreateEmail(email?: unknown): boolean {
  const normalizedEmail = normalizedIdentity(email);
  return normalizedEmail === FOUNDER_EMAIL || LEGACY_FOUNDER_EMAILS.has(normalizedEmail);
}

function isFounderLikeUser(teamUser: TeamUser): boolean {
  const normalizedRole = normalizedIdentity(teamUser?.role);
  const normalizedEmail = normalizedIdentity(teamUser?.email);
  const normalizedName = normalizedIdentity(teamUser?.name);
  return normalizedRole === 'founder' || normalizedRole === 'owner' || normalizedEmail === FOUNDER_EMAIL || LEGACY_FOUNDER_EMAILS.has(normalizedEmail) || normalizedName === 'founder admin';
}

function isPrimaryFounderUser(teamUser: TeamUser): boolean {
  return isPrimaryFounderEmail(teamUser?.email);
}

function shouldRenderStaffUser(teamUser: TeamUser): boolean {
  if (!isFounderLikeUser(teamUser)) return true;
  return isPrimaryFounderUser(teamUser);
}

function isProtectedSystemAccount(teamUser: TeamUser): boolean {
  return (teamUser as any).protectedSystemAccount === true || (teamUser as any).isProtectedSystemAccount === true || (teamUser as any).systemAccountProtected === true;
}

function isBlockedSharedSystemEmail(email: string, teamUser: TeamUser): boolean {
  return SHARED_NEWS_PULSE_SYSTEM_EMAILS.has(normalizedIdentity(email)) && !isProtectedSystemAccount(teamUser);
}

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function staffMustChangePassword(teamUser: TeamUser): boolean {
  return (teamUser as any).mustChangePassword === true || (teamUser as any).passwordChangeRequired === true || (teamUser as any).forcePasswordChange === true;
}

function containsTestMarker(value: unknown): boolean {
  return /\btest\b/i.test(String(value || ''));
}

function isArchivedStaff(teamUser: TeamUser): boolean {
  const status = rawAccountStatus(teamUser);
  return status === 'archived' || (teamUser as any).archived === true || (teamUser as any).isArchived === true || !!(teamUser as any).archivedAt;
}

function isDeletedOrTestRemovedStaff(teamUser: TeamUser): boolean {
  const status = rawAccountStatus(teamUser);
  return ['deleted', 'removed', 'test_removed', 'deleted_test', 'test-deleted'].includes(status) || (teamUser as any).deleted === true || (teamUser as any).isDeleted === true || (teamUser as any).testRemoved === true || !!(teamUser as any).deletedAt || !!(teamUser as any).removedAt;
}

function hasCleanupReason(teamUser: TeamUser): boolean {
  const cleanupReason = normalizedIdentity((teamUser as any).cleanupReason || (teamUser as any).cleanup?.reason || (teamUser as any).cleanupTag);
  return !!cleanupReason || cleanupReason.includes('test_or_duplicate_cleanup');
}

function isDuplicateDisabledStaff(teamUser: TeamUser): boolean {
  return normalizedIdentity((teamUser as any).logoutReason || (teamUser as any).lastLogoutReason || (teamUser as any).session?.logoutReason) === 'founder_duplicate_login_disabled';
}

function isCleanupHiddenStaff(teamUser: TeamUser): boolean {
  return isArchivedStaff(teamUser) || isDeletedOrTestRemovedStaff(teamUser) || hasCleanupReason(teamUser) || isDuplicateDisabledStaff(teamUser) || isTestStaffAccount(teamUser);
}

function isTestStaffAccount(teamUser: TeamUser): boolean {
  const explicitFlags = [(teamUser as any).isTestAccount, (teamUser as any).testAccount, (teamUser as any).demoAccount, (teamUser as any).fakeAccount, (teamUser as any).isDemo, (teamUser as any).isFake, (teamUser as any).isUnwanted, (teamUser as any).unwantedAccount, (teamUser as any).canDeleteAsTest];
  if (explicitFlags.some((value) => value === true)) return true;
  if (containsTestMarker(teamUser.fullName || teamUser.name) || containsTestMarker(teamUser.designation)) return true;
  const markers = [
    (teamUser as any).accountType,
    (teamUser as any).accountPurpose,
    (teamUser as any).environment,
    (teamUser as any).staffType,
    (teamUser as any).accountCategory,
    (teamUser as any).testStatus,
    ...(Array.isArray((teamUser as any).tags) ? (teamUser as any).tags : []),
    ...(Array.isArray((teamUser as any).labels) ? (teamUser as any).labels : []),
  ].map((value) => normalizedIdentity(value));
  return markers.some((value) => ['test', 'demo', 'fake', 'unwanted'].includes(value));
}

function canShowDeleteTestAction(teamUser: TeamUser): boolean {
  return !isFounderLikeUser(teamUser) && !isDeletedOrTestRemovedStaff(teamUser) && isTestStaffAccount(teamUser);
}

function canShowPermanentDeleteAction(teamUser: TeamUser): boolean {
  return !isFounderLikeUser(teamUser) && (isArchivedStaff(teamUser) || canShowDeleteTestAction(teamUser) || hasCleanupReason(teamUser) || isDuplicateDisabledStaff(teamUser));
}

function shouldShowAccessAction(statusLabel: string): boolean {
  return ['expired', 'suspended', 'archived', 'locked'].includes(statusLabel.toLowerCase());
}

function shouldShowSuspendAction(statusLabel: string): boolean {
  return statusLabel.toLowerCase() === 'active';
}

function shouldShowLockAction(teamUser: TeamUser, statusLabel: string): boolean {
  const raw = rawAccountStatus(teamUser);
  return statusLabel.toLowerCase() === 'active' || raw === 'suspicious' || statusLabel.toLowerCase() === 'suspicious';
}

function extractUserPermissions(currentUser: any): Set<string> {
  const values = new Set<string>();
  const add = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === 'string' && value.trim()) values.add(value.trim());
  };
  [currentUser?.permissions, currentUser?.specialPermissions, currentUser?.moduleAccess, currentUser?.specialRights, currentUser?.accessOverrides?.modules, currentUser?.accessOverrides?.specialRights, roleById(currentUser?.role)?.permissions].forEach(add);
  return values;
}

function getEmailChangeErrorMessage(err: unknown): string {
  const status = Number((err as any)?.status ?? (err as any)?.response?.status ?? 0);
  const code = String((err as any)?.code || (err as any)?.body?.code || (err as any)?.response?.data?.code || '').toLowerCase();
  const backendMessage = toTeamApiErrorMessage(err, 'Email update failed.');
  if (status === 401) return 'Session expired. Please login again.';
  if (status === 403) return 'Founder permission required.';
  if (status === 409 || code.includes('duplicate') || code.includes('conflict') || /already (used|exists|in use)/i.test(backendMessage)) return 'This email is already used by another account.';
  if (status === 400 || err instanceof AdminApiError) return backendMessage;
  return backendMessage;
}

function emailChangeSessionsMessage(response: any): string | null {
  const value = response?.sessionsRevoked ?? response?.revokedSessions ?? response?.sessionsLoggedOut ?? response?.data?.sessionsRevoked ?? response?.data?.revokedSessions ?? response?.data?.sessionsLoggedOut;
  if (typeof value === 'number') return value > 0 ? `${value} active session${value === 1 ? '' : 's'} revoked.` : 'No active sessions needed revocation.';
  if (value === true) return 'All active sessions were revoked.';
  return null;
}

function matchesCurrentUser(teamUser: TeamUser, currentUser: any): boolean {
  const rowId = normalizedIdentity(teamUser.id || teamUser._id || (teamUser as any).userId);
  const currentId = normalizedIdentity(currentUser?.id || currentUser?._id || currentUser?.userId);
  if (rowId && currentId && rowId === currentId) return true;
  const rowEmail = normalizedIdentity(teamUser.email);
  const currentEmail = normalizedIdentity(currentUser?.email);
  return !!rowEmail && !!currentEmail && rowEmail === currentEmail;
}

function getSessionStatusDisplay(teamUser: TeamUser, currentUser: any): SessionStatusLabel {
  if (matchesCurrentUser(teamUser, currentUser)) return 'Active Session';
  const rawStatus = normalizedIdentity((teamUser as any).sessionStatus || (teamUser as any).authSessionStatus || (teamUser as any).session?.status);
  if (['active', 'active_session', 'authenticated', 'valid'].includes(rawStatus)) return 'Active Session';
  if (['expired', 'session_expired'].includes(rawStatus)) return 'Session Expired';
  if (['logged_out', 'logout', 'signed_out'].includes(rawStatus)) return 'Logged Out';
  const sessionExpiresAt = (teamUser as any).sessionExpiresAt || (teamUser as any).session?.expiresAt;
  if (sessionExpiresAt) {
    const expires = new Date(String(sessionExpiresAt)).getTime();
    if (!Number.isNaN(expires) && expires < Date.now()) return 'Session Expired';
  }
  const hasActiveSession = (teamUser as any).hasActiveSession === true || (teamUser as any).activeSession === true || (teamUser as any).session?.active === true;
  if (hasActiveSession) return 'Active Session';
  if ((teamUser as any).lastLogout || (teamUser as any).lastLogoutAt || (teamUser as any).logoutAt) return 'Logged Out';
  return 'No Active Session';
}

function extractCreatedStaffId(response: any): string | null {
  const value = response?.staffId || response?.user?.staffId || response?.data?.staffId || response?.data?.user?.staffId;
  const text = String(value || '').trim();
  if (!text || /^np-backend/i.test(text)) return null;
  return text;
}

function CheckboxList<T extends string>({
  items,
  values,
  onChange,
  disabled,
}: {
  items: { key: T; label: string }[];
  values: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className={checkboxGridClass}>
      {items.map((item) => (
        <label key={item.key} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={values.includes(item.key)}
            disabled={disabled}
            onChange={(event) => onChange(toggleValue(values, item.key, event.target.checked))}
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}

function MultiSelectDropdown({
  label,
  helper,
  values,
  options,
  onChange,
}: {
  label: string;
  helper: string;
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <label className={fieldLabelClass}>
      <span>{label}</span>
      <details className="group rounded-lg border border-slate-300 bg-white text-sm text-slate-900">
        <summary className="cursor-pointer list-none px-3 py-2 font-medium text-slate-700 group-open:border-b group-open:border-slate-200">
          {values.length ? values.join(', ') : `Select ${label}`}
        </summary>
        <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto p-2 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={values.includes(option)}
                onChange={(event) => onChange(toggleValue(values, option, event.target.checked))}
              />
              {option}
            </label>
          ))}
        </div>
      </details>
      <span className="text-xs font-normal leading-5 text-slate-500">{helper}</span>
    </label>
  );
}

function BadgePill({ badge: roleBadge }: { badge: RoleBadge }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass(roleBadge.tone)}`}>
      {roleBadge.label}
    </span>
  );
}

function SectionCard({ title, subtitle, id, actions, children }: { title: string; subtitle?: string; id?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-base font-semibold text-slate-950">{title}</div>
          {subtitle ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function TeamManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const isFounder = role === 'founder';
  const currentPermissions = useMemo(() => extractUserPermissions(user), [user]);
  const hasAnyStaffPermission = (permissions: string[]) => isFounder || permissions.some((permission) => currentPermissions.has(permission));
  const canEditStaffAccounts = hasAnyStaffPermission(['team.edit', 'team.change_role', 'auth.create_user', 'can_edit_staff_basic_details']);
  const canManageStaffPasswords = hasAnyStaffPermission(['team.reset_password', 'auth.reset_password', 'auth.generate_temp_password', 'auth.force_password_change', 'can_generate_temporary_password', 'can_reset_staff_password', 'can_force_password_change']);
  const canManageStaffSessions = hasAnyStaffPermission(['auth.logout_user_sessions', 'can_logout_all_devices']);
  const canSuspendStaffAccounts = hasAnyStaffPermission(['team.suspend', 'auth.suspend_user', 'can_extend_or_reactivate_staff', 'can_suspend_staff_account']);
  const canLockStaffAccounts = hasAnyStaffPermission(['auth.lock_user', 'can_lock_staff_account']);
  const canArchiveStaffAccounts = hasAnyStaffPermission(['team.suspend', 'team.edit', 'can_archive_staff']);
  const canDeleteTestAccounts = isFounder;

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    recoveryEmail: '',
    phone: '',
    accountGroup: 'Staff Account / Newsroom Staff',
    position: 'Reporter',
    role: 'editor',
    officialTitle: '',
    responsibility: '',
    designation: '',
    employmentType: 'Full Time',
    reportingManager: '',
    department: defaultDepartmentForRole('editor'),
    assignedSections: [] as string[],
    coverageArea: [] as string[],
    accountStatus: 'active',
    permissions: '',
    expiresAt: '',
    moduleAccess: defaultModulesForRole('editor'),
    specialRights: defaultRightsForRole('editor'),
    temporaryGrants: [] as TemporaryAccessGrant[],
    accessReason: '',
    temporaryExpiry: '',
    generateTemporaryPassword: true,
    mustChangePassword: true,
  });
  const [createStep, setCreateStep] = useState<CreateWizardStep>('accountType');
  const [roleForm, setRoleForm] = useState({
    roleName: 'Custom Desk Role',
    description: '',
    sortOrder: 99,
    systemRole: false,
    moduleAccess: defaultModulesForRole('editor'),
    specialRights: defaultRightsForRole('editor'),
  });
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [items, setItems] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, { moduleAccess: AdminModuleKey[]; specialRights: SpecialRightKey[] }>>({});
  const [savingOverrideId, setSavingOverrideId] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [createdStaffId, setCreatedStaffId] = useState<string | null>(null);
  const [nextStaffIdPreview, setNextStaffIdPreview] = useState<string | null>(null);
  const [loadingStaffIdPreview, setLoadingStaffIdPreview] = useState(false);
  const [roleErr, setRoleErr] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [emailChangeUser, setEmailChangeUser] = useState<TeamUser | null>(null);
  const [emailChangeForm, setEmailChangeForm] = useState<EmailChangeForm>({ newEmail: '', reason: '', forcePasswordChange: true, logoutAllDevices: true, confirmedSamePerson: false });
  const [emailChangeErr, setEmailChangeErr] = useState<string | null>(null);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState<string | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [editForm, setEditForm] = useState<EditAccountForm>({ fullName: '', role: 'editor', department: '', assignedSections: [], coverageArea: [], designation: '', accessExpiryDate: '', accountStatus: 'active' });
  const [editErr, setEditErr] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [staffActionModal, setStaffActionModal] = useState<StaffActionModal | null>(null);
  const [accessForm, setAccessForm] = useState({ accessExpiryDate: '', reactivate: true, reason: '' });
  const [archiveReason, setArchiveReason] = useState('');
  const [deleteTestForm, setDeleteTestForm] = useState({ confirmation: '', reason: '', confirmed: false });
  const [markTestForm, setMarkTestForm] = useState({ reason: '', confirmed: false });
  const [staffActionErr, setStaffActionErr] = useState<string | null>(null);
  const [staffActionBusy, setStaffActionBusy] = useState(false);
  const [staffListFilter, setStaffListFilter] = useState<StaffListFilter>('active');
  const [activeTab, setActiveTab] = useState<StaffControlTab>('create');
  const [detailsUser, setDetailsUser] = useState<TeamUser | null>(null);
  const [detailsTab, setDetailsTab] = useState<StaffDetailsTab>('profile');
  const [selectedAccessUserId, setSelectedAccessUserId] = useState<string | null>(null);
  const [accessChangeReason, setAccessChangeReason] = useState('');
  const [temporaryAccessExpiry, setTemporaryAccessExpiry] = useState('');
  const [accessStudioTab, setAccessStudioTab] = useState<AccessStudioTab>('modules');
  const [staffAccessSearch, setStaffAccessSearch] = useState('');
  const [temporaryGrants, setTemporaryGrants] = useState<TemporaryAccessGrant[]>([]);
  const [temporaryGrantForm, setTemporaryGrantForm] = useState<{ targetType: 'module' | 'right'; key: string; expiresAt: string; reason: string }>({ targetType: 'module', key: 'dashboard', expiresAt: '', reason: '' });
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskErr, setTaskErr] = useState<string | null>(null);
  const [taskFilters, setTaskFilters] = useState({ accountGroup: '', position: '', assignedStaffId: '', taskCategory: '', taskLevel: '', status: '', priority: '', dueDate: '', search: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedStaffId: '', accountGroup: 'Staff Account / Newsroom Staff', taskCategory: 'Editorial Task', taskLevel: 'Staff Level', department: '', coverageArea: '', priority: 'Normal', dueDate: '', status: 'Assigned', notes: '', relatedModule: '', relatedNews: '' });
  const fetchStaffInFlightRef = useRef(false);
  const staffIdPreviewInFlightRef = useRef(false);

  const selectedRole = useMemo(() => roleById(createForm.role) || roleById('editor'), [createForm.role]);
  const staffIdPreviewLabel = nextStaffIdPreview ? `Next Non-Founder Staff ID: ${nextStaffIdPreview}` : 'Next Non-Founder Staff ID';
  const staffIdPreviewText = nextStaffIdPreview || 'Auto-generated on create';
  const founderEmailTypedInCreate = isProtectedFounderCreateEmail(createForm.email);

  const roleOptions = useMemo(() => {
    const customRoles = roles.slice().sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999)).map((item) => {
      const id = String(item.id || item._id || item.roleName || '').trim();
      return {
        id: normalizeRoleId(id || item.roleName),
        label: String(item.roleName || id || 'Custom Role'),
        protected: item.protected === true,
      };
    }).filter((item) => item.id);
    const defaults = DEFAULT_ROLE_ACCESS.map((item) => ({ id: item.id, label: item.label, protected: item.protected === true }));
    const seen = new Set<string>();
    return [...defaults, ...customRoles].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [roles]);

  async function fetchStaff() {
    if (fetchStaffInFlightRef.current || sessionBlocked) return;
    fetchStaffInFlightRef.current = true;
    setLoading(true);
    setErr(null);
    setRoleErr(null);
    try {
      const list = await getTeamUsers();
      const roleList = await getTeamRoles().catch((roleError) => {
        logTeamApiError('load roles failed', roleError);
        if (isTeamRoleApiUnavailable(roleError)) {
          setRoleErr(TEAM_ROLE_API_UNAVAILABLE_MESSAGE);
          return [] as TeamRole[];
        }
        if (isTeamApiUnauthorized(roleError)) {
          setSessionBlocked(true);
          throw roleError;
        }
        setRoleErr(toTeamApiErrorMessage(roleError, 'Failed to load roles.'));
        return [] as TeamRole[];
      });
      setItems(Array.isArray(list) ? list : []);
      setRoles(Array.isArray(roleList) ? roleList : []);
    } catch (e: any) {
      logTeamApiError('load users failed', e);
      setItems([]);
      if (isTeamApiUnauthorized(e)) setSessionBlocked(true);
      setErr(toTeamApiErrorMessage(e, 'Failed to load staff.'));
    } finally {
      setLoading(false);
      fetchStaffInFlightRef.current = false;
    }
  }

  async function refreshStaffIdPreview() {
    if (staffIdPreviewInFlightRef.current || sessionBlocked) return;
    staffIdPreviewInFlightRef.current = true;
    setLoadingStaffIdPreview(true);
    try {
      const preview = await getNextTeamStaffIdPreview();
      setNextStaffIdPreview(preview);
    } catch (previewError) {
      logTeamApiError('load next staff id failed', previewError);
      if (isTeamApiUnauthorized(previewError)) setSessionBlocked(true);
      setNextStaffIdPreview(null);
    } finally {
      setLoadingStaffIdPreview(false);
      staffIdPreviewInFlightRef.current = false;
    }
  }

  async function fetchTasks() {
    setTasksLoading(true);
    setTaskErr(null);
    try {
      const list = await getTeamTasks();
      setTeamTasks(Array.isArray(list) ? list : []);
    } catch (taskError) {
      logTeamApiError('load team tasks failed', taskError);
      setTaskErr(toTeamApiErrorMessage(taskError, 'Task board is unavailable.'));
      setTeamTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }

  async function submitTeamTask(event: FormEvent) {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      toast.error('Task title is required.');
      return;
    }
    try {
      await createTeamTask({ ...taskForm, title: taskForm.title.trim(), description: taskForm.description.trim() || undefined, notes: taskForm.notes.trim() || undefined });
      toast.success('Task saved');
      setTaskForm({ title: '', description: '', assignedStaffId: '', accountGroup: 'Staff Account / Newsroom Staff', taskCategory: 'Editorial Task', taskLevel: 'Staff Level', department: '', coverageArea: '', priority: 'Normal', dueDate: '', status: 'Assigned', notes: '', relatedModule: '', relatedNews: '' });
      await fetchTasks();
    } catch (taskError) {
      logTeamApiError('create team task failed', taskError);
      toast.error(toTeamApiErrorMessage(taskError, 'Save task failed.'));
    }
  }

  const parsePermissions = () => {
    const manual = createForm.permissions.split(',').map((item) => item.trim()).filter(Boolean);
    return manual.length ? manual : selectedRole?.permissions || [];
  };

  const setRoleAndDepartment = (nextRole: string) => {
    setCreateForm((state) => ({
      ...state,
      role: nextRole,
      department: safeDepartmentForRole(nextRole, defaultDepartmentForRole(nextRole)),
      moduleAccess: defaultModulesForRole(nextRole),
      specialRights: defaultRightsForRole(nextRole),
      temporaryGrants: [],
    }));
  };

  const setCreatePosition = (position: string) => {
    const nextRole = POSITION_ROLE_MAP[position] || 'reporter';
    setCreateForm((state) => ({
      ...state,
      position,
      role: nextRole,
      department: safeDepartmentForRole(nextRole, defaultDepartmentForRole(nextRole)),
      moduleAccess: defaultModulesForRole(nextRole),
      specialRights: defaultRightsForRole(nextRole),
      temporaryGrants: [],
    }));
  };

  const setCreateAccountGroup = (accountGroup: string) => {
    if (accountGroup === 'Founder Account') return;
    const position = ACCOUNT_GROUP_POSITIONS[accountGroup]?.[0] || 'Reporter';
    setCreateForm((state) => ({ ...state, accountGroup }));
    setCreatePosition(position);
  };

  const setDepartment = (department: string) => {
    setCreateForm((state) => {
      if (!isFounderRole(state.role) && department === FOUNDER_DEPARTMENT) {
        toast.error('Founder / Ownership is reserved for Founder role only.');
        return { ...state, department: defaultDepartmentForRole(state.role) };
      }
      return { ...state, department };
    });
  };

  const setAssignedSections = (assignedSections: string[]) => {
    setCreateForm((state) => ({
      ...state,
      assignedSections,
      coverageArea: assignedSections.includes('Gujarat') && !state.coverageArea.length ? ['All Gujarat'] : state.coverageArea,
    }));
  };

  const userId = (teamUser: TeamUser) => String(teamUser?._id || teamUser?.id || '');
  const isUserActive = (teamUser: TeamUser): boolean => {
    if (typeof teamUser?.isActive === 'boolean') return teamUser.isActive;
    const status = String(teamUser?.status || '').toLowerCase();
    if (status === 'suspended' || status === 'inactive' || status === 'disabled') return false;
    return true;
  };
  const isFounderUser = (teamUser: TeamUser): boolean => {
    return isPrimaryFounderUser(teamUser);
  };

  const canChangeStaffEmail = (teamUser: TeamUser): boolean => {
    const id = userId(teamUser);
    if (!canEditStaffAccounts || !id || isFounderUser(teamUser)) return false;
    if (matchesCurrentUser(teamUser, user)) return false;
    return true;
  };

  const openEditModal = (teamUser: TeamUser) => {
    if (isFounderUser(teamUser)) {
      toast.error('Founder account is protected. Manage from Founder My Account / Safe Zone.');
      return;
    }
    if (!canEditStaffAccounts) {
      toast.error('Permission required.');
      return;
    }
    setEditUser(teamUser);
    setEditForm({
      fullName: displayFullName(teamUser, false),
      role: normalizeRoleId(teamUser.role || 'editor'),
      department: String(teamUser.department || ''),
      assignedSections: Array.isArray(teamUser.assignedSections) ? teamUser.assignedSections.map(String) : [],
      coverageArea: coverageAreaValues(teamUser),
      designation: String(teamUser.designation || ''),
      accessExpiryDate: dateInputValue(accessExpiryValue(teamUser)),
      accountStatus: rawAccountStatus(teamUser) || 'active',
    });
    setEditErr(null);
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditUser(null);
    setEditErr(null);
  };

  const openEmailChangeModal = (teamUser: TeamUser) => {
    if (isFounderUser(teamUser)) {
      toast.error('Founder email is protected. Change only through Safe Zone Founder Security.');
      return;
    }
    if (matchesCurrentUser(teamUser, user)) {
      toast.error('You cannot change your own email from Staff Control Center.');
      return;
    }
    if (!canChangeStaffEmail(teamUser)) {
      toast.error('Permission required.');
      return;
    }
    setEmailChangeUser(teamUser);
    setEmailChangeForm({ newEmail: '', reason: '', forcePasswordChange: true, logoutAllDevices: true, confirmedSamePerson: false });
    setEmailChangeErr(null);
    setEmailChangeSuccess(null);
  };

  const closeEmailChangeModal = () => {
    if (changingEmail) return;
    setEmailChangeUser(null);
    setEmailChangeErr(null);
    setEmailChangeSuccess(null);
  };

  const openPasswordModal = (teamUser: TeamUser, mode: PasswordActionMode) => {
    if (isFounderUser(teamUser)) {
      toast.error('Founder account is protected. Manage from Founder My Account / Safe Zone.');
      return;
    }
    if (!canManageStaffPasswords) {
      toast.error('Permission required.');
      return;
    }
    setStaffActionModal({ type: 'password', mode, user: teamUser });
    setStaffActionErr(null);
  };

  const openAccessModal = (teamUser: TeamUser) => {
    if (isFounderUser(teamUser)) {
      toast.error('Founder account is protected. Manage from Founder My Account / Safe Zone.');
      return;
    }
    setStaffActionModal({ type: 'access', user: teamUser });
    setAccessForm({ accessExpiryDate: dateInputValue(accessExpiryValue(teamUser)), reactivate: true, reason: '' });
    setStaffActionErr(null);
  };

  const openArchiveModal = (teamUser: TeamUser) => {
    if (isFounderUser(teamUser)) {
      toast.error('Founder account is protected. Manage from Founder My Account / Safe Zone.');
      return;
    }
    setStaffActionModal({ type: 'archive', user: teamUser });
    setArchiveReason('');
    setStaffActionErr(null);
  };

  const openDeleteTestModal = (teamUser: TeamUser) => {
    if (!isFounder || isFounderUser(teamUser) || !canShowPermanentDeleteAction(teamUser)) return;
    setStaffActionModal({ type: 'delete-test', user: teamUser });
    setDeleteTestForm({ confirmation: '', reason: '', confirmed: false });
    setStaffActionErr(null);
  };

  const openMarkTestModal = (teamUser: TeamUser) => {
    if (!isFounder || isFounderUser(teamUser)) return;
    setStaffActionModal({ type: 'mark-test', user: teamUser });
    setMarkTestForm({ reason: '', confirmed: false });
    setStaffActionErr(null);
  };

  const closeStaffActionModal = () => {
    if (staffActionBusy) return;
    setStaffActionModal(null);
    setStaffActionErr(null);
  };

  const founderRow = useMemo<TeamUser>(() => {
    const existing = items.find(isPrimaryFounderUser);
    return { ...(existing || {}), name: FOUNDER_NAME, email: FOUNDER_EMAIL, staffId: FOUNDER_STAFF_ID, role: 'founder', isActive: true, status: 'active' };
  }, [items]);
  const staffRows = useMemo(() => items.filter((item) => !isPrimaryFounderUser(item) && shouldRenderStaffUser(item)), [items]);
  const filteredStaffRows = useMemo(() => staffRows.filter((item) => {
    const active = isUserActive(item);
    const status = displayAccountStatus(item, active).toLowerCase();
    if (staffListFilter === 'active') return status === 'active' && !isCleanupHiddenStaff(item);
    if (staffListFilter === 'expired') return status === 'expired' && !isCleanupHiddenStaff(item);
    if (staffListFilter === 'suspended') return status === 'suspended' && !isCleanupHiddenStaff(item);
    if (staffListFilter === 'archived') return isArchivedStaff(item) || hasCleanupReason(item) || isDuplicateDisabledStaff(item);
    if (staffListFilter === 'testDeleted') return isDeletedOrTestRemovedStaff(item) || isTestStaffAccount(item) || hasCleanupReason(item) || isDuplicateDisabledStaff(item);
    if (staffListFilter === 'all') return true;
    return true;
  }), [staffListFilter, staffRows]);
  const teamRows = useMemo(() => [founderRow, ...filteredStaffRows], [filteredStaffRows, founderRow]);
  const founderLikeCount = useMemo(() => items.filter(isFounderLikeUser).length, [items]);
  const selectableStaffRows = useMemo(() => staffRows.filter((item) => !isArchivedStaff(item) && !isDeletedOrTestRemovedStaff(item)), [staffRows]);
  const selectedAccessUser = useMemo(() => selectableStaffRows.find((item) => userId(item) === selectedAccessUserId) || selectableStaffRows[0] || null, [selectableStaffRows, selectedAccessUserId]);
  const archivedRows = useMemo(() => staffRows.filter((item) => isArchivedStaff(item) || isDeletedOrTestRemovedStaff(item) || isTestStaffAccount(item) || hasCleanupReason(item) || isDuplicateDisabledStaff(item)), [staffRows]);

  useEffect(() => {
    if (!selectedAccessUserId && selectableStaffRows[0]) setSelectedAccessUserId(userId(selectableStaffRows[0]));
  }, [selectableStaffRows, selectedAccessUserId]);

  useEffect(() => {
    setCreateForm((state) => {
      const corrected = safeDepartmentForRole(state.role, state.department);
      if (corrected === state.department) return state;
      return { ...state, department: corrected };
    });
  }, [createForm.role, createForm.department]);

  useEffect(() => {
    setOverrideDrafts((current) => {
      const next = { ...current };
      teamRows.forEach((teamUser) => {
        const id = userId(teamUser);
        if (!id || next[id]) return;
        next[id] = {
          moduleAccess: getEffectiveModuleAccess(teamUser),
          specialRights: getEffectiveSpecialRights(teamUser),
        };
      });
      return next;
    });
  }, [teamRows]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    if (normalizeRoleId(createForm.role) === 'founder') {
      toast.error('Founder role is protected and cannot be assigned from invites.');
      return;
    }
    const roleDepartment = defaultDepartmentForRole(createForm.role);
    if (!isFounderRole(createForm.role) && createForm.department === FOUNDER_DEPARTMENT) {
      setCreateForm((state) => ({ ...state, department: roleDepartment }));
      toast.error('Founder / Ownership is reserved for Founder role only. Department was corrected for the selected role.');
      return;
    }
    const name = createForm.name.trim();
    const email = createForm.email.trim();
    if (!name) {
      toast.error('Enter the team member\'s real name.');
      return;
    }
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email.');
      return;
    }
    if (isProtectedFounderCreateEmail(email)) {
      const message = 'This looks like Founder email. Do not create Founder as staff. Use Founder My Account / backend repair.';
      setCreateErr(message);
      toast.error(message);
      return;
    }
    setCreating(true);
    setCreateErr(null);
    try {
      const res: any = await createTeamUser({
        email,
        recoveryEmail: createForm.recoveryEmail.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        accountGroup: createForm.accountGroup,
        position: createForm.position,
        officialTitle: createForm.officialTitle.trim() || undefined,
        defaultTasks: DEFAULT_TASKS_BY_POSITION[createForm.position] || [],
        fullName: name,
        role: createForm.role,
        designation: createForm.officialTitle.trim() || createForm.designation.trim() || undefined,
        employmentType: createForm.employmentType,
        reportingManager: createForm.reportingManager.trim() || undefined,
        responsibility: createForm.responsibility.trim() || createForm.designation.trim() || undefined,
        specialPermissions: parsePermissions(),
        moduleAccess: createForm.moduleAccess,
        specialRights: createForm.specialRights,
        temporaryGrants: createForm.temporaryGrants.map((grant) => ({ targetType: grant.targetType, key: grant.key, expiresAt: grant.expiresAt, reason: grant.reason || createForm.accessReason || undefined })),
        department: safeDepartmentForRole(createForm.role, createForm.department).trim() || undefined,
        assignedSections: createForm.assignedSections,
        coverageAreas: createForm.assignedSections.includes('Gujarat') && !createForm.coverageArea.length ? ['All Gujarat'] : createForm.coverageArea,
        accountStatus: createForm.accountStatus,
        accessExpiryDate: createForm.expiresAt || undefined,
        generateTemporaryPassword: createForm.generateTemporaryPassword,
        mustChangePassword: createForm.mustChangePassword,
      });
      const assignedStaffId = extractCreatedStaffId(res);
      const tempPassword = res?.temporaryPassword || res?.tempPassword || res?.password || res?.data?.temporaryPassword || res?.data?.tempPassword || res?.data?.password || null;
      setCreatedTempPassword(tempPassword ? String(tempPassword) : null);
      setCreatedEmail(email);
      setCreatedStaffId(assignedStaffId);
      toast.success(assignedStaffId ? `Account created. Staff ID: ${assignedStaffId}` : 'Account created. Staff ID will be assigned by the backend.');
      setCreateForm({ name: '', email: '', recoveryEmail: '', phone: '', accountGroup: 'Staff Account / Newsroom Staff', position: 'Reporter', role: 'reporter', officialTitle: '', responsibility: '', designation: '', employmentType: 'Full Time', reportingManager: '', department: defaultDepartmentForRole('reporter'), assignedSections: [], coverageArea: [], accountStatus: 'active', permissions: '', expiresAt: '', moduleAccess: defaultModulesForRole('reporter'), specialRights: defaultRightsForRole('reporter'), temporaryGrants: [], accessReason: '', temporaryExpiry: '', generateTemporaryPassword: true, mustChangePassword: true });
      setCreateStep('accountType');
      await Promise.all([fetchStaff(), refreshStaffIdPreview()]);
    } catch (err2: any) {
      logTeamApiError('create user failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      const message = toTeamApiErrorMessage(err2, 'Create failed');
      setCreateErr(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    const roleName = roleForm.roleName.trim();
    if (!roleName) {
      toast.error('Enter a role name.');
      return;
    }
    if (normalizeRoleId(roleName) === 'founder') {
      toast.error('Founder role is protected and cannot be edited.');
      return;
    }
    setSavingRole(true);
    try {
      const existing = roles.find((item) => normalizeRoleId(item.roleName || item.id) === normalizeRoleId(roleName));
      const payload = {
        roleName,
        description: roleForm.description.trim() || undefined,
        sortOrder: Number.isFinite(Number(roleForm.sortOrder)) ? Number(roleForm.sortOrder) : 99,
        systemRole: false,
        moduleAccess: roleForm.moduleAccess,
        specialRights: roleForm.specialRights,
      };
      if (existing?._id || existing?.id) {
        await updateTeamRole(String(existing._id || existing.id), payload);
        toast.success('Role updated');
      } else {
        await createTeamRole(payload);
        toast.success('Role saved');
      }
      setRoleForm({ roleName: 'Custom Desk Role', description: '', sortOrder: 99, systemRole: false, moduleAccess: defaultModulesForRole('editor'), specialRights: defaultRightsForRole('editor') });
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('save role failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      toast.error(toTeamApiErrorMessage(err2, 'Save role failed'));
    } finally {
      setSavingRole(false);
    }
  };

  const runRowAction = async (id: string, action: () => Promise<any>, label: string) => {
    if (!id) return;
    setRowBusyId(id);
    try {
      await action();
      toast.success(label);
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('row action failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      toast.error(toTeamApiErrorMessage(err2, 'Action failed'));
    } finally {
      setRowBusyId(null);
    }
  };

  const handleSaveEditAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!editUser) return;
    const id = userId(editUser);
    if (!id || isFounderUser(editUser) || !canEditStaffAccounts) {
      setEditErr('Action not allowed.');
      return;
    }
    if (!editForm.fullName.trim()) {
      setEditErr('Full Name is required.');
      return;
    }
    setSavingEdit(true);
    setEditErr(null);
    try {
      await updateTeamUser(id, {
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        department: editForm.department.trim() || undefined,
        assignedSections: editForm.assignedSections,
        coverageAreas: editForm.coverageArea,
        designation: editForm.designation.trim() || undefined,
        accessExpiryDate: editForm.accessExpiryDate || undefined,
        accountStatus: canSuspendStaffAccounts ? editForm.accountStatus : undefined,
      });
      toast.success('Account updated');
      setEditUser(null);
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('edit account failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      const message = toTeamApiErrorMessage(err2, 'Update failed');
      setEditErr(message);
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  };

  const captureTemporaryPassword = (res: any, fallbackEmail?: string) => {
    const tempPassword = res?.temporaryPassword || res?.tempPassword || res?.password || res?.data?.temporaryPassword || res?.data?.tempPassword || res?.data?.password || null;
    if (tempPassword) {
      setCreatedStaffId(null);
      setCreatedTempPassword(String(tempPassword));
      setCreatedEmail(fallbackEmail || res?.email || res?.data?.email || null);
    }
  };

  const submitPasswordAction = async () => {
    if (!staffActionModal || staffActionModal.type !== 'password') return;
    const id = userId(staffActionModal.user);
    if (!id || isFounderUser(staffActionModal.user) || !canManageStaffPasswords) return;
    setStaffActionBusy(true);
    setStaffActionErr(null);
    setRowBusyId(id);
    try {
      const res = staffActionModal.mode === 'generate' ? await generateTemporaryPasswordUser(id) : await resetPasswordUser(id);
      captureTemporaryPassword(res, staffActionModal.user.email);
      toast.success(staffActionModal.mode === 'generate' ? 'Temporary password generated' : 'Password reset');
      setStaffActionModal(null);
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('password reset failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      const message = toTeamApiErrorMessage(err2, 'Password action failed');
      setStaffActionErr(message);
      toast.error(message);
    } finally {
      setStaffActionBusy(false);
      setRowBusyId(null);
    }
  };

  const runLogoutAllDevices = async (teamUser: TeamUser) => {
    const id = userId(teamUser);
    if (!canManageStaffSessions) {
      toast.error('Permission required.');
      return;
    }
    if (!id || isFounderUser(teamUser)) return;
    setRowBusyId(id);
    try {
      await logoutAllTeamUserDevices(id);
      toast.success('All devices logged out');
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('logout devices failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      toast.error(toTeamApiErrorMessage(err2, 'Logout all devices failed'));
    } finally {
      setRowBusyId(null);
    }
  };

  const runForceChangePassword = async (teamUser: TeamUser) => {
    const id = userId(teamUser);
    if (!canManageStaffPasswords) {
      toast.error('Permission required.');
      return;
    }
    if (!id || isFounderUser(teamUser) || staffMustChangePassword(teamUser)) return;
    await runRowAction(id, () => forceChangePasswordUser(id), 'Force password change enabled');
  };

  const submitAccessAction = async () => {
    if (!staffActionModal || staffActionModal.type !== 'access') return;
    const id = userId(staffActionModal.user);
    if (!id || isFounderUser(staffActionModal.user) || !canSuspendStaffAccounts) return;
    if (!accessForm.accessExpiryDate) {
      setStaffActionErr('New Access Expiry Date is required.');
      return;
    }
    setStaffActionBusy(true);
    setStaffActionErr(null);
    setRowBusyId(id);
    try {
      const payload = { accessExpiryDate: accessForm.accessExpiryDate, reason: accessForm.reason.trim() || undefined };
      if (accessForm.reactivate) await reactivateUser(id, payload);
      else await extendAccessUser(id, payload);
      toast.success(accessForm.reactivate ? 'Account reactivated' : 'Access extended');
      setStaffActionModal(null);
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('extend/reactivate failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      const message = toTeamApiErrorMessage(err2, 'Extend/reactivate failed');
      setStaffActionErr(message);
      toast.error(message);
    } finally {
      setStaffActionBusy(false);
      setRowBusyId(null);
    }
  };

  const submitArchiveAction = async () => {
    if (!staffActionModal || staffActionModal.type !== 'archive') return;
    const id = userId(staffActionModal.user);
    if (!id || isFounderUser(staffActionModal.user) || isArchivedStaff(staffActionModal.user) || !canArchiveStaffAccounts) return;
    setStaffActionBusy(true);
    setStaffActionErr(null);
    setRowBusyId(id);
    try {
      await archiveUser(id, { reason: archiveReason.trim() || undefined });
      toast.success('Account archived');
      setStaffActionModal(null);
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('archive failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      const message = toTeamApiErrorMessage(err2, 'Archive failed');
      setStaffActionErr(message);
      toast.error(message);
    } finally {
      setStaffActionBusy(false);
      setRowBusyId(null);
    }
  };

  const runRestoreAccount = async (teamUser: TeamUser) => {
    const id = userId(teamUser);
    if (!isFounder) {
      toast.error('Founder permission required.');
      return;
    }
    if (!id || isFounderUser(teamUser)) return;
    await runRowAction(id, () => restoreUser(id, { reason: 'Restored from Staff Control Center archived account tab.' }), 'Account restored');
  };

  const submitDeleteTestAction = async () => {
    if (!staffActionModal || staffActionModal.type !== 'delete-test') return;
    const id = userId(staffActionModal.user);
    if (!id || isFounderUser(staffActionModal.user) || !canShowPermanentDeleteAction(staffActionModal.user) || !canDeleteTestAccounts) return;
    if (deleteTestForm.confirmation !== 'DELETE PERMANENTLY' || !deleteTestForm.confirmed || !deleteTestForm.reason.trim()) {
      setStaffActionErr('Double confirmation and reason are required. Type DELETE PERMANENTLY.');
      return;
    }
    setStaffActionBusy(true);
    setStaffActionErr(null);
    setRowBusyId(id);
    try {
      await deleteTestUserOnly(id, { confirmation: 'DELETE PERMANENTLY', reason: deleteTestForm.reason.trim() });
      toast.success('Account permanently deleted');
      setStaffActionModal(null);
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('delete test account failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      const message = `${toTeamApiErrorMessage(err2, 'Delete test account rejected')}. Archive this account instead if it must be disabled.`;
      setStaffActionErr(message);
      toast.error(message);
    } finally {
      setStaffActionBusy(false);
      setRowBusyId(null);
    }
  };

  const submitMarkTestAction = async () => {
    if (!staffActionModal || staffActionModal.type !== 'mark-test') return;
    const id = userId(staffActionModal.user);
    if (!id || !isFounder || isFounderUser(staffActionModal.user)) return;
    if (!markTestForm.reason.trim() || !markTestForm.confirmed) {
      setStaffActionErr('Reason and confirmation are required.');
      return;
    }
    setStaffActionBusy(true);
    setStaffActionErr(null);
    setRowBusyId(id);
    try {
      await markTestAccountUser(id, { reason: markTestForm.reason.trim(), markAsTest: true, markAsUnwanted: true });
      toast.success('Account marked as test/unwanted');
      setStaffActionModal(null);
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('mark test account failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      const message = toTeamApiErrorMessage(err2, 'Mark as test/unwanted failed');
      setStaffActionErr(message);
      toast.error(message);
    } finally {
      setStaffActionBusy(false);
      setRowBusyId(null);
    }
  };

  const handleEmailChange = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailChangeUser) return;
    const id = userId(emailChangeUser);
    if (!canChangeStaffEmail(emailChangeUser)) {
      setEmailChangeErr(isFounderUser(emailChangeUser) ? 'Founder email is protected. Change only through Safe Zone Founder Security.' : 'Founder permission required.');
      return;
    }
    const newEmail = emailChangeForm.newEmail.trim().toLowerCase();
    const currentEmail = String(emailChangeUser.email || '').trim().toLowerCase();
    const reason = emailChangeForm.reason.trim();
    if (!emailLooksValid(newEmail)) {
      setEmailChangeErr('Enter a valid email address.');
      return;
    }
    if (newEmail === currentEmail) {
      setEmailChangeErr('New email must be different from the current email.');
      return;
    }
    if (!reason) {
      setEmailChangeErr('Reason for Change is required.');
      return;
    }
    if (!emailChangeForm.confirmedSamePerson) {
      setEmailChangeErr('Confirm this is the same staff person, not a new replacement user.');
      return;
    }
    if (isBlockedSharedSystemEmail(newEmail, emailChangeUser)) {
      setEmailChangeErr('Shared News Pulse system emails cannot be used for normal staff accounts.');
      return;
    }
    setChangingEmail(true);
    setEmailChangeErr(null);
    setEmailChangeSuccess(null);
    try {
      const res = await changeTeamUserEmail(id, {
        newEmail,
        reason,
        forcePasswordChange: emailChangeForm.forcePasswordChange,
        logoutAllDevices: emailChangeForm.logoutAllDevices,
      });
      const sessionsMessage = emailChangeSessionsMessage(res);
      const successMessage = sessionsMessage ? `Email updated successfully. Staff ID remains unchanged. User must login with the new email and change password. ${sessionsMessage}` : 'Email updated successfully. Staff ID remains unchanged. User must login with the new email and change password.';
      setEmailChangeSuccess(successMessage);
      toast.success('Email updated successfully. Staff ID remains unchanged.');
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('change user email failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      const message = getEmailChangeErrorMessage(err2);
      setEmailChangeErr(message);
      toast.error(message);
    } finally {
      setChangingEmail(false);
    }
  };

  const saveOverride = async (teamUser: TeamUser, pendingTemporaryGrants: TemporaryAccessGrant[] = temporaryGrants) => {
    const id = userId(teamUser);
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    if (!id || isFounderUser(teamUser)) return;
    if (!accessChangeReason.trim()) {
      toast.error('Reason is required for major access changes.');
      return;
    }
    const draft = overrideDrafts[id] || { moduleAccess: getEffectiveModuleAccess(teamUser), specialRights: getEffectiveSpecialRights(teamUser) };
    setSavingOverrideId(id);
    try {
      const result = await saveStaffAccessOverride(id, { ...draft, reason: accessChangeReason.trim(), accessExpiryDate: temporaryAccessExpiry || undefined, temporaryGrants: pendingTemporaryGrants.map((grant) => ({ targetType: grant.targetType, key: grant.key, expiresAt: grant.expiresAt, reason: grant.reason })) });
      if (Array.isArray(result) && result.some((item: any) => item?.temporaryUnavailable)) toast.error('Temporary access API is not available yet.');
      else toast.success('Staff access changes saved');
      setAccessChangeReason('');
      setTemporaryAccessExpiry('');
      setTemporaryGrants([]);
      await fetchStaff();
    } catch (err2: any) {
      logTeamApiError('save access override failed', err2);
      if (isTeamApiUnauthorized(err2)) setSessionBlocked(true);
      toast.error(toTeamApiErrorMessage(err2, 'Save override failed'));
    } finally {
      setSavingOverrideId(null);
    }
  };

  const openStaffDetails = (teamUser: TeamUser, tab: StaffDetailsTab = 'profile') => {
    setDetailsUser(teamUser);
    setDetailsTab(tab);
  };

  const selectStaffForAccess = (teamUser: TeamUser, tab: StaffControlTab = 'access') => {
    const id = userId(teamUser);
    if (id) setSelectedAccessUserId(id);
    setActiveTab(tab);
  };

  const renderCreateStaffAccount = () => {
    const createModuleState = (key: AdminModuleKey): AccessControlState => {
      if (FOUNDER_ONLY_MODULES.has(key)) return 'founder_only';
      if (createForm.temporaryGrants.some((grant) => grant.targetType === 'module' && grant.key === key)) return 'temporary';
      return createForm.moduleAccess.includes(key) ? 'enabled' : 'disabled';
    };
    const createRightState = (key: SpecialRightKey): AccessControlState => {
      if (FOUNDER_ONLY_RIGHTS.has(key)) return 'founder_only';
      if (createForm.temporaryGrants.some((grant) => grant.targetType === 'right' && grant.key === key)) return 'temporary';
      return createForm.specialRights.includes(key) ? 'enabled' : 'disabled';
    };
    const setCreateTemporaryGrant = (targetType: 'module' | 'right', key: AdminModuleKey | SpecialRightKey, enabled: boolean) => {
      setCreateForm((state) => ({
        ...state,
        temporaryGrants: enabled
          ? [...state.temporaryGrants.filter((grant) => grant.targetType !== targetType || grant.key !== key), { targetType, key, expiresAt: state.temporaryExpiry, reason: state.accessReason, grantedBy: 'Founder' }]
          : state.temporaryGrants.filter((grant) => grant.targetType !== targetType || grant.key !== key),
      }));
    };
    const updateCreateModuleState = (key: AdminModuleKey, nextState: AccessControlState) => {
      if (FOUNDER_ONLY_MODULES.has(key)) return;
      setCreateForm((state) => ({ ...state, moduleAccess: toggleValue(state.moduleAccess, key, nextState !== 'disabled') }));
      setCreateTemporaryGrant('module', key, nextState === 'temporary');
    };
    const updateCreateRightState = (key: SpecialRightKey, nextState: AccessControlState) => {
      if (FOUNDER_ONLY_RIGHTS.has(key)) return;
      setCreateForm((state) => ({ ...state, specialRights: toggleValue(state.specialRights, key, nextState !== 'disabled') }));
      setCreateTemporaryGrant('right', key, nextState === 'temporary');
    };
    const stateControl = (state: AccessControlState, onChange: (state: AccessControlState) => void) => state === 'founder_only'
      ? <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">Founder Only 🔒</span>
      : <select value={state} onChange={(event) => onChange(event.target.value as AccessControlState)} className="min-w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"><option value="disabled">Disabled</option><option value="enabled">Enabled</option><option value="temporary">Temporary</option></select>;
    const rightLabel = (key: SpecialRightKey) => SPECIAL_RIGHTS.find((item) => item.key === key)?.label || key;
    const moduleLabel = (key: AdminModuleKey) => ADMIN_MODULES.find((item) => item.key === key)?.label || key;
    const currentStepIndex = CREATE_STAFF_STEPS.findIndex((step) => step.key === createStep);
    const sensitiveRightsGranted = createForm.specialRights.some((key) => FOUNDER_ONLY_RIGHTS.has(key) || ['can_create_staff', 'can_suspend_staff', 'can_reset_staff_password', 'can_create_roles', 'can_edit_roles', 'can_delete_roles', 'can_change_settings', 'can_control_ai_engine'].includes(key));
    const stepButtonClass = (step: CreateWizardStep) => `rounded-lg border px-3 py-2 text-sm font-semibold ${createStep === step ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`;

    return (
      <SectionCard title="Create Staff Account" subtitle="Create new staff with simple account type, work details, default tasks, and password setup. Use Staff Access & Special Rights later for custom access.">
        <form className="space-y-5" onSubmit={handleCreate}>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">Founder account cannot be created here. This form is only for staff accounts. Founder account is protected and already exists.</div>
          <div className="flex flex-wrap gap-2">{CREATE_STAFF_STEPS.map((step, index) => <button key={step.key} type="button" onClick={() => setCreateStep(step.key)} className={stepButtonClass(step.key)}><span className="mr-1 text-xs opacity-70">{index + 1}</span>{step.label}</button>)}</div>

          {createStep === 'accountType' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{ACCOUNT_GROUPS.map((group) => <button key={group} type="button" disabled={group === 'Founder Account'} onClick={() => setCreateAccountGroup(group)} className={`rounded-xl border p-4 text-left transition ${createForm.accountGroup === group ? 'border-slate-900 bg-slate-900 text-white' : group === 'Founder Account' ? 'cursor-not-allowed border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'}`}><div className="font-semibold">{group}</div><div className="mt-2 text-xs leading-5 opacity-80">{group === 'Founder Account' ? 'Founder account is already protected. This form creates staff accounts only.' : ACCOUNT_GROUP_POSITIONS[group]?.slice(0, 3).join(', ')}</div></button>)}</div> : null}

          {createStep === 'details' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={fieldLabelClass}>Full Name<input value={createForm.name} onChange={(event) => setCreateForm((state) => ({ ...state, name: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Email / Login ID<input value={createForm.email} onChange={(event) => setCreateForm((state) => ({ ...state, email: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>{staffIdPreviewLabel}<input value={loadingStaffIdPreview ? 'Loading next staff ID...' : staffIdPreviewText} readOnly aria-readonly="true" className={inputClass} /></label><label className={fieldLabelClass}>Recovery Email optional<input value={createForm.recoveryEmail} onChange={(event) => setCreateForm((state) => ({ ...state, recoveryEmail: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Phone optional<input value={createForm.phone} onChange={(event) => setCreateForm((state) => ({ ...state, phone: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Employment Type<select value={createForm.employmentType} onChange={(event) => setCreateForm((state) => ({ ...state, employmentType: event.target.value }))} className={inputClass}>{EMPLOYMENT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className={fieldLabelClass}>Account Status<select value={createForm.accountStatus} onChange={(event) => setCreateForm((state) => ({ ...state, accountStatus: event.target.value }))} className={inputClass}><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option><option value="locked">Locked</option></select></label><label className={fieldLabelClass}>Access Expiry Date<input type="date" value={createForm.expiresAt} onChange={(event) => setCreateForm((state) => ({ ...state, expiresAt: event.target.value }))} className={inputClass} /></label></div> : null}

          {createStep === 'work' ? <div className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"><label className={fieldLabelClass}>Position<select value={createForm.position} onChange={(event) => setCreatePosition(event.target.value)} className={inputClass}>{(ACCOUNT_GROUP_POSITIONS[createForm.accountGroup] || []).filter((item) => item !== 'Founder protected read-only').map((position) => <option key={position} value={position}>{position}</option>)}</select></label><label className={fieldLabelClass}>Department<select value={createForm.department} onChange={(event) => setDepartment(event.target.value)} className={inputClass}><option value="">Select Department</option>{DEPARTMENT_OPTIONS.filter((department) => department !== FOUNDER_DEPARTMENT).map((department) => <option key={department} value={department}>{department}</option>)}</select></label><label className={fieldLabelClass}>Official Title<input value={createForm.officialTitle} onChange={(event) => setCreateForm((state) => ({ ...state, officialTitle: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Responsibility / Appointment<input value={createForm.responsibility} onChange={(event) => setCreateForm((state) => ({ ...state, responsibility: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Reporting Manager<input value={createForm.reportingManager} onChange={(event) => setCreateForm((state) => ({ ...state, reportingManager: event.target.value }))} className={inputClass} /></label><MultiSelectDropdown label="Assigned Sections" helper="Staff Tasks can use these sections." values={createForm.assignedSections} options={ASSIGNED_SECTION_OPTIONS} onChange={setAssignedSections} /><MultiSelectDropdown label="Coverage Area" helper="Field and newsroom coverage area." values={createForm.coverageArea} options={COVERAGE_AREA_OPTIONS} onChange={(coverageArea) => setCreateForm((state) => ({ ...state, coverageArea }))} /></div><div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><div className="font-semibold">Default Tasks</div><div className="mt-2 flex flex-wrap gap-2">{(DEFAULT_TASKS_BY_POSITION[createForm.position] || ['standard staff follow-up', 'daily work update']).map((task) => <span key={task} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900">{task}</span>)}</div></div></div> : null}

          {false ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-sm"><thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-4 py-3">Module</th><th className="px-4 py-3">Current State</th><th className="px-4 py-3">Access Control</th><th className="px-4 py-3">Notes</th></tr></thead><tbody>{ADMIN_MODULES.map((moduleItem) => { const state = createModuleState(moduleItem.key); return <tr key={moduleItem.key} className="border-t border-slate-200"><td className="px-4 py-3 font-semibold text-slate-900">{moduleItem.label}</td><td className="px-4 py-3"><StatusPill label={ACCESS_STATE_LABEL[state]} tone={state === 'enabled' ? 'emerald' : state === 'temporary' ? 'amber' : state === 'founder_only' ? 'rose' : 'slate'} /></td><td className="px-4 py-3">{stateControl(state, (nextState) => updateCreateModuleState(moduleItem.key, nextState))}</td><td className="px-4 py-3 text-slate-600">{moduleItem.key === 'finance_desk' ? 'Finance Desk kept as currently configured.' : state === 'founder_only' ? 'Founder-protected module.' : 'Loaded from role defaults; Founder can override before creation.'}</td></tr>; })}</tbody></table></div> : null}

          {false ? <div className="space-y-4">{(['newsroom', 'liveTv', 'staffAdmin', 'security', 'system'] as const).map((groupKey) => <div key={groupKey} className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-950">{ACCESS_STUDIO_TABS.find((tab) => tab.key === groupKey)?.label}</div><table className="min-w-full text-sm"><thead><tr className="text-left text-slate-600"><th className="px-4 py-3">Right name</th><th className="px-4 py-3">State control</th><th className="px-4 py-3">Notes</th></tr></thead><tbody>{RIGHT_TAB_GROUPS[groupKey].map((rightKey) => { const state = createRightState(rightKey); return <tr key={rightKey} className="border-t border-slate-200"><td className="px-4 py-3 font-semibold text-slate-900">{rightLabel(rightKey)}</td><td className="px-4 py-3">{stateControl(state, (nextState) => updateCreateRightState(rightKey, nextState))}</td><td className="px-4 py-3 text-slate-600">{state === 'founder_only' ? 'Founder-only right. Locked for staff creation.' : 'Loaded from role defaults; Founder can override before creation.'}</td></tr>; })}</tbody></table></div>)}</div> : null}

          {createStep === 'review' ? <div className="space-y-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={createForm.generateTemporaryPassword} onChange={(event) => setCreateForm((state) => ({ ...state, generateTemporaryPassword: event.target.checked }))} />Generate Temporary Password</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={createForm.mustChangePassword} onChange={(event) => setCreateForm((state) => ({ ...state, mustChangePassword: event.target.checked }))} />Must Change Password on First Login</label><label className={fieldLabelClass}>Temporary Expiry<input type="datetime-local" value={createForm.temporaryExpiry} onChange={(event) => setCreateForm((state) => ({ ...state, temporaryExpiry: event.target.value, temporaryGrants: state.temporaryGrants.map((grant) => ({ ...grant, expiresAt: event.target.value })) }))} className={inputClass} /></label></div><div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="font-semibold text-slate-950">Identity</div><div className="mt-2 text-sm leading-6 text-slate-700">{createForm.name || 'No name'} · {createForm.email || 'No email'}<br />{roleLabel(createForm.role)} · {createForm.designation || 'No designation'}<br />{createForm.employmentType}</div></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="font-semibold text-emerald-900">Modules enabled</div><div className="mt-2 text-sm leading-6 text-emerald-900">{createForm.moduleAccess.map(moduleLabel).join(', ') || 'None'}</div></div><div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="font-semibold text-blue-900">Special rights enabled</div><div className="mt-2 text-sm leading-6 text-blue-900">{createForm.specialRights.map(rightLabel).join(', ') || 'None'}</div></div></div><label className={fieldLabelClass}>Reason for sensitive rights<textarea value={createForm.accessReason} onChange={(event) => setCreateForm((state) => ({ ...state, accessReason: event.target.value, temporaryGrants: state.temporaryGrants.map((grant) => ({ ...grant, reason: event.target.value })) }))} className={`${inputClass} min-h-24`} placeholder="Required if sensitive staff/security/system rights are granted." /></label></div> : null}

          {founderEmailTypedInCreate ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">This looks like Founder email. Do not create Founder as staff. Use Founder My Account / backend repair.</div> : null}
          {createErr ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{createErr}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4"><div className="text-xs text-slate-600">Step {currentStepIndex + 1} of {CREATE_STAFF_STEPS.length}. Staff ID remains backend-generated/read-only.</div><div className="flex flex-wrap gap-2"><button type="button" disabled={currentStepIndex === 0} onClick={() => setCreateStep(CREATE_STAFF_STEPS[Math.max(0, currentStepIndex - 1)].key)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Back</button>{createStep !== 'review' ? <button type="button" onClick={() => setCreateStep(CREATE_STAFF_STEPS[Math.min(CREATE_STAFF_STEPS.length - 1, currentStepIndex + 1)].key)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Next</button> : <button type="submit" disabled={!isFounder || creating || (sensitiveRightsGranted && !createForm.accessReason.trim())} className={`rounded-lg px-4 py-2 text-sm font-semibold ${isFounder ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-300 text-slate-700'}`}>{creating ? 'Creating...' : 'Create Staff Account'}</button>}</div></div>
        </form>
      </SectionCard>
    );
  };

  const renderStaffRegistry = (rows: TeamUser[] = teamRows) => (
    <SectionCard title="Staff Registry" subtitle="Compact staff table with account state, session state, access expiry, and focused actions.">
      {loading ? <div className="text-slate-600">Loading...</div> : err ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">{err}</div> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-slate-600"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email/Login ID</th><th className="py-2 pr-3">Staff ID</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Account Status</th><th className="py-2 pr-3">Session Status</th><th className="py-2 pr-3">Access Expiry</th><th className="py-2 pr-3">Last Login</th><th className="py-2 pr-3">Actions</th></tr></thead>
          <tbody>
            {rows.map((teamUser) => {
              const id = userId(teamUser);
              const founder = isFounderUser(teamUser);
              const active = founder || isUserActive(teamUser);
              const accountStatus = founder ? 'Active' : displayAccountStatus(teamUser, active);
              const rowKey = id || `${teamUser.email}-${teamUser.name}`;
              const busy = rowBusyId === id;
              const permanentDeleteAllowed = !founder && isFounder && canShowDeleteTestAction(teamUser);
              return (
                <tr key={rowKey} className="border-t border-slate-200 align-top">
                  <td className="py-3 pr-3 font-medium text-slate-900"><div className="flex flex-wrap items-center gap-2"><span>{displayFullName(teamUser, founder)}</span>{founder ? <StatusPill label="Protected" tone="rose" /> : null}{isTestStaffAccount(teamUser) ? <StatusPill label="Test Account" tone="amber" /> : null}</div></td>
                  <td className="py-3 pr-3 text-slate-700">{teamUser.email || (founder ? FOUNDER_EMAIL : '-')}</td>
                  <td className="py-3 pr-3 text-slate-700">{displayStaffId(teamUser.staffId, founder)}</td>
                  <td className="py-3 pr-3 font-semibold text-slate-900">{founder ? 'Founder' : roleLabel(teamUser.role)}</td>
                  <td className="py-3 pr-3"><StatusPill label={accountStatus} /></td>
                  <td className="py-3 pr-3"><StatusPill label={getSessionStatusDisplay(teamUser, user)} /></td>
                  <td className="py-3 pr-3 text-slate-700">{formatDateTime(accessExpiryValue(teamUser))}</td>
                  <td className="py-3 pr-3 text-slate-700">{formatDateTime(teamUser.lastLogin || teamUser.lastLoginAt || teamUser.loginAt)}</td>
                  <td className="py-3 pr-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openStaffDetails(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">View Details</button>{!founder ? <button type="button" onClick={() => selectStaffForAccess(teamUser)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100">Manage Access</button> : null}{!founder ? <button type="button" onClick={() => selectStaffForAccess(teamUser, 'security')} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">Security</button> : null}{!founder && !isArchivedStaff(teamUser) ? <button type="button" disabled={!canArchiveStaffAccounts || !id || busy} onClick={() => openArchiveModal(teamUser)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Archive</button> : null}{permanentDeleteAllowed ? <button type="button" disabled={!canDeleteTestAccounts || !id || busy} onClick={() => openDeleteTestModal(teamUser)} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">Delete Permanently</button> : null}{founder ? <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800">Founder protected</span> : null}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );

  const renderFounderAccessStudio = () => {
    const teamUser = selectedAccessUser;
    const id = teamUser ? userId(teamUser) : '';
    const draft = teamUser && id ? overrideDrafts[id] || { moduleAccess: getEffectiveModuleAccess(teamUser), specialRights: getEffectiveSpecialRights(teamUser) } : { moduleAccess: [] as AdminModuleKey[], specialRights: [] as SpecialRightKey[] };
    const baselineModules = teamUser ? getEffectiveModuleAccess(teamUser) : [];
    const baselineRights = teamUser ? getEffectiveSpecialRights(teamUser) : [];
    const staffSearch = staffAccessSearch.trim().toLowerCase();
    const searchedStaff = selectableStaffRows.filter((item) => {
      if (!staffSearch) return true;
      return [displayFullName(item, false), item.email, item.staffId, roleLabel(item.role)].some((value) => String(value || '').toLowerCase().includes(staffSearch));
    });
    const enabledModules = draft.moduleAccess.length;
    const enabledRights = draft.specialRights.length;
    const selectedStatus = teamUser ? displayAccountStatus(teamUser, isUserActive(teamUser)) : '-';
    const addedModules = draft.moduleAccess.filter((key) => !baselineModules.includes(key));
    const removedModules = baselineModules.filter((key) => !draft.moduleAccess.includes(key));
    const addedRights = draft.specialRights.filter((key) => !baselineRights.includes(key));
    const removedRights = baselineRights.filter((key) => !draft.specialRights.includes(key));
    const setModules = (moduleAccess: AdminModuleKey[]) => id && setOverrideDrafts((state) => ({ ...state, [id]: { ...draft, moduleAccess } }));
    const setRights = (specialRights: SpecialRightKey[]) => id && setOverrideDrafts((state) => ({ ...state, [id]: { ...draft, specialRights } }));
    const selectedByKey = (targetType: 'module' | 'right', key: AdminModuleKey | SpecialRightKey) => temporaryGrants.find((grant) => grant.targetType === targetType && grant.key === key);
    const labelForModule = (key: AdminModuleKey) => ADMIN_MODULES.find((item) => item.key === key)?.label || key;
    const labelForRight = (key: SpecialRightKey) => SPECIAL_RIGHTS.find((item) => item.key === key)?.label || key;
    const stateTone = (state: AccessControlState): StatusTone => state === 'enabled' ? 'emerald' : state === 'temporary' ? 'amber' : state === 'founder_only' ? 'rose' : state === 'locked' ? 'slate' : 'slate';
    const selectAccessStaff = (itemId: string) => {
      setSelectedAccessUserId(itemId);
      setAccessChangeReason('');
      setTemporaryAccessExpiry('');
      setTemporaryGrants([]);
      setAccessStudioTab('modules');
    };
    const addOrUpdateTemporaryGrant = (targetType: 'module' | 'right', key: AdminModuleKey | SpecialRightKey, partial: Partial<TemporaryAccessGrant> = {}) => {
      setTemporaryGrants((current) => {
        const existing = current.find((grant) => grant.targetType === targetType && grant.key === key);
        const nextGrant: TemporaryAccessGrant = {
          targetType,
          key,
          expiresAt: partial.expiresAt ?? existing?.expiresAt ?? temporaryAccessExpiry,
          reason: partial.reason ?? existing?.reason ?? accessChangeReason,
          grantedBy: partial.grantedBy ?? existing?.grantedBy ?? 'Founder',
        };
        return existing ? current.map((grant) => grant === existing ? nextGrant : grant) : [...current, nextGrant];
      });
    };
    const removeTemporaryGrant = (targetType: 'module' | 'right', key: AdminModuleKey | SpecialRightKey) => setTemporaryGrants((current) => current.filter((grant) => grant.targetType !== targetType || grant.key !== key));
    const moduleState = (key: AdminModuleKey): AccessControlState => {
      if (!isFounder) return 'locked';
      if (FOUNDER_ONLY_MODULES.has(key)) return 'founder_only';
      if (selectedByKey('module', key)) return 'temporary';
      return draft.moduleAccess.includes(key) ? 'enabled' : 'disabled';
    };
    const rightState = (key: SpecialRightKey): AccessControlState => {
      if (!isFounder) return 'locked';
      if (FOUNDER_ONLY_RIGHTS.has(key)) return 'founder_only';
      if (selectedByKey('right', key)) return 'temporary';
      return draft.specialRights.includes(key) ? 'enabled' : 'disabled';
    };
    const updateModuleState = (key: AdminModuleKey, nextState: AccessControlState) => {
      if (FOUNDER_ONLY_MODULES.has(key) || nextState === 'founder_only' || nextState === 'locked') return;
      if (nextState === 'enabled') {
        setModules(toggleValue(draft.moduleAccess, key, true));
        removeTemporaryGrant('module', key);
      } else if (nextState === 'disabled') {
        setModules(toggleValue(draft.moduleAccess, key, false));
        removeTemporaryGrant('module', key);
      } else if (nextState === 'temporary') {
        setModules(toggleValue(draft.moduleAccess, key, true));
        addOrUpdateTemporaryGrant('module', key);
      }
    };
    const updateRightState = (key: SpecialRightKey, nextState: AccessControlState) => {
      if (FOUNDER_ONLY_RIGHTS.has(key) || nextState === 'founder_only' || nextState === 'locked') return;
      if (nextState === 'enabled') {
        setRights(toggleValue(draft.specialRights, key, true));
        removeTemporaryGrant('right', key);
      } else if (nextState === 'disabled') {
        setRights(toggleValue(draft.specialRights, key, false));
        removeTemporaryGrant('right', key);
      } else if (nextState === 'temporary') {
        setRights(toggleValue(draft.specialRights, key, true));
        addOrUpdateTemporaryGrant('right', key);
      }
    };
    const resetAccessDraft = () => {
      if (!id || !teamUser) return;
      setOverrideDrafts((state) => ({ ...state, [id]: { moduleAccess: baselineModules, specialRights: baselineRights } }));
      setAccessChangeReason('');
      setTemporaryAccessExpiry('');
      setTemporaryGrants([]);
      toast.success('Access changes reset');
    };
    const saveAccessChanges = async () => {
      if (!teamUser) {
        toast.error('Select staff first.');
        return;
      }
      if (isFounderUser(teamUser)) {
        toast.error('Founder account is protected. Manage from Founder My Account / Safe Zone.');
        return;
      }
      if (temporaryGrants.some((grant) => !grant.expiresAt || !grant.reason.trim())) {
        toast.error('Temporary access requires expiry and reason.');
        setAccessStudioTab('temporary');
        return;
      }
      await saveOverride(teamUser, temporaryGrants);
    };
    const renderStateControl = (state: AccessControlState, onChange: (state: AccessControlState) => void, disabled = false) => {
      if (state === 'founder_only') return <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">Founder Only 🔒</span>;
      if (state === 'locked') return <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Locked</span>;
      return (
        <select value={state} disabled={disabled || !isFounder} onChange={(event) => onChange(event.target.value as AccessControlState)} className="min-w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
          <option value="disabled">Disabled</option>
          <option value="enabled">Enabled</option>
          <option value="temporary">Temporary</option>
        </select>
      );
    };
    const renderRightsRows = (rights: SpecialRightKey[]) => (
      <div className="space-y-3">
        <div className="text-base font-semibold text-slate-950">What can this staff do?</div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-4 py-3">Right name</th><th className="px-4 py-3">State control</th><th className="px-4 py-3">Notes</th></tr></thead>
            <tbody>{rights.map((rightKey) => { const state = rightState(rightKey); return <tr key={rightKey} className="border-t border-slate-200"><td className="px-4 py-3 font-semibold text-slate-900">{labelForRight(rightKey)}</td><td className="px-4 py-3">{renderStateControl(state, (nextState) => updateRightState(rightKey, nextState))}</td><td className="px-4 py-3 text-slate-600">{state === 'founder_only' ? 'Protected right. Backend remains final authority.' : state === 'temporary' ? `Temporary until ${selectedByKey('right', rightKey)?.expiresAt || 'expiry not set'}` : 'Role default can be overridden here.'}</td></tr>; })}</tbody>
          </table>
        </div>
      </div>
    );
    return (
      <SectionCard title="Staff Access & Special Rights" subtitle="Step 1: Choose Staff. Step 2: What can this staff open? Step 3: What can this staff do? Step 4: Review & Save.">
        {!teamUser ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No staff accounts loaded yet.</div> : <div className="space-y-4">
          {!isFounder ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Access Denied. Founder permission is required.</div> : null}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950">Staff Access opens modules. Special Rights allow actions inside modules. Role/Position only suggests defaults; Founder makes the final decision here.</div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-950">Staff Selector</div>
              <input value={staffAccessSearch} onChange={(event) => setStaffAccessSearch(event.target.value)} placeholder="Search staff" className={`${inputClass} mt-3`} />
              <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {searchedStaff.map((item) => { const itemId = userId(item); return <button key={itemId || item.email} type="button" onClick={() => selectAccessStaff(itemId)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${itemId === id ? 'border-slate-900 bg-white text-slate-950 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}><span className="block truncate font-semibold">{displayFullName(item, false)}</span><span className="block truncate text-xs text-slate-500">{roleLabel(item.role)} · {displayStaffId(item.staffId)}</span></button>; })}
                {!searchedStaff.length ? <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">No staff matched.</div> : null}
              </div>
            </aside>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-8">
                  <div className="md:col-span-2"><div className="text-xs font-semibold uppercase text-slate-500">Selected staff</div><div className="mt-1 font-semibold text-slate-950">{displayFullName(teamUser, false)}</div></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Role</div><div className="mt-1 font-semibold text-slate-950">{roleLabel(teamUser.role)}</div></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Staff ID</div><div className="mt-1 font-semibold text-slate-950">{displayStaffId(teamUser.staffId)}</div></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Account</div><div className="mt-1"><StatusPill label={selectedStatus} /></div></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Session</div><div className="mt-1"><StatusPill label={getSessionStatusDisplay(teamUser, user)} /></div></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Access Expiry</div><div className="mt-1 font-semibold text-slate-950">{formatDateTime(accessExpiryValue(teamUser))}</div></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Enabled</div><div className="mt-1 font-semibold text-slate-950">{enabledModules} modules · {enabledRights} rights</div></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">Enabled</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Disabled</span><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">Temporary</span><span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800">Founder Only</span><span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1">Locked</span><span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-800">{temporaryGrants.length} temporary</span></div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2"><div className="flex flex-wrap gap-2">{ACCESS_STUDIO_TABS.map((tab) => <button key={tab.key} type="button" onClick={() => setAccessStudioTab(tab.key)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${accessStudioTab === tab.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}>{tab.label}</button>)}</div></div>
              {accessStudioTab === 'modules' ? <div className="space-y-3"><div className="text-base font-semibold text-slate-950">What can this staff open?</div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-sm"><thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-4 py-3">Module</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Control</th><th className="px-4 py-3">Notes</th></tr></thead><tbody>{ADMIN_MODULES.map((moduleItem) => { const state = moduleState(moduleItem.key); return <tr key={moduleItem.key} className="border-t border-slate-200"><td className="px-4 py-3 font-semibold text-slate-900">{moduleItem.label}</td><td className="px-4 py-3"><StatusPill label={state === 'enabled' ? 'Allowed' : state === 'disabled' ? 'Not Allowed' : ACCESS_STATE_LABEL[state]} tone={stateTone(state)} /></td><td className="px-4 py-3">{renderStateControl(state, (nextState) => updateModuleState(moduleItem.key, nextState))}</td><td className="px-4 py-3 text-slate-600">{state === 'founder_only' ? 'Founder-protected module. No normal staff edit control.' : state === 'temporary' ? `Temporary until ${selectedByKey('module', moduleItem.key)?.expiresAt || 'expiry not set'}` : moduleItem.key === 'finance_desk' ? 'Finance Desk kept in its current access state.' : 'Visible in admin structure; backend remains final security.'}</td></tr>; })}</tbody></table></div></div> : null}
              {accessStudioTab === 'newsroom' ? renderRightsRows(RIGHT_TAB_GROUPS.newsroom) : null}
              {accessStudioTab === 'liveTv' ? renderRightsRows(RIGHT_TAB_GROUPS.liveTv) : null}
              {accessStudioTab === 'staffAdmin' ? renderRightsRows(RIGHT_TAB_GROUPS.staffAdmin) : null}
              {accessStudioTab === 'security' ? renderRightsRows(RIGHT_TAB_GROUPS.security) : null}
              {accessStudioTab === 'system' ? renderRightsRows(RIGHT_TAB_GROUPS.system) : null}
              {accessStudioTab === 'temporary' ? <div className="space-y-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-[150px_minmax(180px,1fr)_180px_minmax(220px,1fr)_auto]"><label className={fieldLabelClass}>Access type<select value={temporaryGrantForm.targetType} onChange={(event) => setTemporaryGrantForm((state) => ({ ...state, targetType: event.target.value as 'module' | 'right', key: event.target.value === 'module' ? 'dashboard' : 'can_publish_news' }))} className={inputClass}><option value="module">Module</option><option value="right">Right</option></select></label><label className={fieldLabelClass}>Module / Right<select value={temporaryGrantForm.key} onChange={(event) => setTemporaryGrantForm((state) => ({ ...state, key: event.target.value }))} className={inputClass}>{temporaryGrantForm.targetType === 'module' ? ADMIN_MODULES.filter((item) => !FOUNDER_ONLY_MODULES.has(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>) : SPECIAL_RIGHTS.filter((item) => !FOUNDER_ONLY_RIGHTS.has(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className={fieldLabelClass}>Expires at<input type="datetime-local" value={temporaryGrantForm.expiresAt} onChange={(event) => setTemporaryGrantForm((state) => ({ ...state, expiresAt: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Reason<input value={temporaryGrantForm.reason} onChange={(event) => setTemporaryGrantForm((state) => ({ ...state, reason: event.target.value }))} className={inputClass} /></label><div className="flex items-end"><button type="button" disabled={!temporaryGrantForm.expiresAt || !temporaryGrantForm.reason.trim()} onClick={() => { const key = temporaryGrantForm.key as AdminModuleKey | SpecialRightKey; addOrUpdateTemporaryGrant(temporaryGrantForm.targetType, key, { expiresAt: temporaryGrantForm.expiresAt, reason: temporaryGrantForm.reason.trim() }); if (temporaryGrantForm.targetType === 'module') setModules(toggleValue(draft.moduleAccess, key as AdminModuleKey, true)); else setRights(toggleValue(draft.specialRights, key as SpecialRightKey, true)); setTemporaryGrantForm((state) => ({ ...state, expiresAt: '', reason: '' })); }} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">Add Grant</button></div></div></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-sm"><thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-4 py-3">Access type</th><th className="px-4 py-3">Module / Right</th><th className="px-4 py-3">Expires at</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Granted by</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{temporaryGrants.map((grant) => <tr key={`${grant.targetType}-${grant.key}`} className="border-t border-slate-200"><td className="px-4 py-3 font-semibold capitalize text-slate-900">{grant.targetType}</td><td className="px-4 py-3 text-slate-700">{grant.targetType === 'module' ? labelForModule(grant.key as AdminModuleKey) : labelForRight(grant.key as SpecialRightKey)}</td><td className="px-4 py-3 text-slate-700">{formatDateTime(grant.expiresAt)}</td><td className="px-4 py-3 text-slate-700">{grant.reason || '-'}</td><td className="px-4 py-3 text-slate-700">{grant.grantedBy}</td><td className="px-4 py-3"><button type="button" onClick={() => removeTemporaryGrant(grant.targetType, grant.key)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">Remove</button></td></tr>)}{!temporaryGrants.length ? <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No temporary module or right grants staged.</td></tr> : null}</tbody></table></div></div> : null}
              {accessStudioTab === 'review' ? <div className="space-y-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-sm font-semibold text-slate-950">Selected staff:</div><div className="mt-1 text-sm text-slate-700">{displayFullName(teamUser, false)} · {roleLabel(teamUser.role)} · {displayStaffId(teamUser.staffId)}</div></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="font-semibold text-emerald-900">Added</div><div className="mt-2 space-y-1 text-sm text-emerald-900">{[...addedModules.map(labelForModule), ...addedRights.map(labelForRight)].map((item) => <div key={item}>{item}</div>)}{!addedModules.length && !addedRights.length ? <div>Nothing added</div> : null}</div></div><div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><div className="font-semibold text-rose-900">Removed</div><div className="mt-2 space-y-1 text-sm text-rose-900">{[...removedModules.map(labelForModule), ...removedRights.map(labelForRight)].map((item) => <div key={item}>{item}</div>)}{!removedModules.length && !removedRights.length ? <div>Nothing removed</div> : null}</div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="font-semibold text-amber-900">Temporary</div><div className="mt-2 space-y-1 text-sm text-amber-900">{temporaryGrants.map((grant) => <div key={`${grant.targetType}-${grant.key}`}>{grant.targetType === 'module' ? labelForModule(grant.key as AdminModuleKey) : labelForRight(grant.key as SpecialRightKey)} until {formatDateTime(grant.expiresAt)}</div>)}{!temporaryGrants.length ? <div>No temporary grants</div> : null}</div></div></div><label className={fieldLabelClass}>Reason<textarea value={accessChangeReason} onChange={(event) => setAccessChangeReason(event.target.value)} className={`${inputClass} min-h-24`} placeholder="Required for major access changes." /></label></div> : null}
              <div className="sticky bottom-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="text-xs text-slate-600">Select existing staff, update module access, special rights, temporary permissions, and save with an audit reason. Backend remains final security authority.</div><div className="flex flex-wrap gap-2"><button type="button" onClick={resetAccessDraft} disabled={!id || savingOverrideId === id} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Reset Changes</button><button type="button" onClick={saveAccessChanges} disabled={!isFounder || !id || savingOverrideId === id || !accessChangeReason.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{savingOverrideId === id ? 'Saving...' : 'Save Access Changes'}</button></div></div></div>
            </div>
          </div>
        </div>}
      </SectionCard>
    );
  };

  const renderSecurityAndSessions = () => {
    const teamUser = selectedAccessUser;
    const id = teamUser ? userId(teamUser) : '';
    const accountStatus = teamUser ? displayAccountStatus(teamUser, isUserActive(teamUser)) : '-';
    const busy = !!id && rowBusyId === id;
    return (
      <SectionCard title="Security & Sessions" subtitle="Password controls, account status controls, session review, and access extension for selected staff.">
        {!teamUser ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No staff account selected.</div> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-semibold text-slate-950">Select staff</div><div className="mt-3 space-y-2">{selectableStaffRows.map((item) => { const itemId = userId(item); return <button key={itemId || item.email} type="button" onClick={() => setSelectedAccessUserId(itemId)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${itemId === id ? 'border-slate-900 bg-white text-slate-950 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}><span className="block font-semibold">{displayFullName(item, false)}</span><span className="block text-xs text-slate-500">{accountStatusFor(item, isUserActive(item))} · {getSessionStatusDisplay(item, user)}</span></button>; })}</div></div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4"><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs font-semibold uppercase text-slate-500">Account Status</div><div className="mt-2"><StatusPill label={accountStatus} /></div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs font-semibold uppercase text-slate-500">Session Status</div><div className="mt-2"><StatusPill label={getSessionStatusDisplay(teamUser, user)} /></div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs font-semibold uppercase text-slate-500">Last Login</div><div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(teamUser.lastLogin || teamUser.lastLoginAt || teamUser.loginAt)}</div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs font-semibold uppercase text-slate-500">Last Logout</div><div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(teamUser.lastLogout || teamUser.lastLogoutAt || teamUser.logoutAt)}</div></div></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-sm font-semibold text-slate-950">Password & Session Actions</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!canManageStaffPasswords || busy} onClick={() => openPasswordModal(teamUser, 'generate')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Generate Temporary Password</button><button type="button" disabled={!canManageStaffPasswords || busy} onClick={() => openPasswordModal(teamUser, 'reset')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Reset Password</button><button type="button" disabled={!canManageStaffPasswords || busy || staffMustChangePassword(teamUser)} onClick={() => runForceChangePassword(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Force Change Password</button><button type="button" disabled={!canManageStaffSessions || busy} onClick={() => runLogoutAllDevices(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Logout All Devices</button></div></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-sm font-semibold text-slate-950">Account Controls</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!canSuspendStaffAccounts || busy} onClick={() => runRowAction(id, () => suspendUser(id), 'Account suspended')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Suspend Account</button><button type="button" disabled={!canLockStaffAccounts || busy} onClick={() => runRowAction(id, () => lockUser(id), 'Account locked')} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">Lock Account</button><button type="button" disabled={!canSuspendStaffAccounts || busy} onClick={() => runRowAction(id, () => reactivateUser(id), 'Account reactivated')} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">Reactivate Account</button><button type="button" disabled={!canSuspendStaffAccounts || busy} onClick={() => openAccessModal(teamUser)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">Extend Access</button></div></div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-950">Session list</div><div className="mt-2 text-sm leading-6 text-slate-700">{Array.isArray((teamUser as any).sessions) && (teamUser as any).sessions.length ? (teamUser as any).sessions.map((session: any, index: number) => <div key={session.id || index} className="rounded-lg border border-slate-200 bg-white px-3 py-2">{session.device || session.ip || 'Session'} · {session.status || 'unknown'} · {formatDateTime(session.lastSeenAt || session.createdAt)}</div>) : <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">No active session list returned by backend.</div>}</div></div><div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><div className="font-semibold">Account status explanation</div><p className="mt-2">Active can use assigned access. Suspended blocks login temporarily. Locked requires Founder/Admin review. Expired requires access extension. Founder account is excluded from staff security actions.</p></div></div>
          </div>
        </div>}
      </SectionCard>
    );
  };

  const renderStaffTasks = () => {
    const filteredTasks = teamTasks.filter((task) => {
      const assignedStaff = selectableStaffRows.find((staff) => userId(staff) === task.assignedStaffId);
      if (taskFilters.accountGroup && task.accountGroup !== taskFilters.accountGroup) return false;
      if (taskFilters.position && roleLabel(assignedStaff?.role) !== taskFilters.position && (task as any).position !== taskFilters.position) return false;
      if (taskFilters.assignedStaffId && task.assignedStaffId !== taskFilters.assignedStaffId) return false;
      if (taskFilters.taskCategory && task.taskCategory !== taskFilters.taskCategory) return false;
      if (taskFilters.taskLevel && task.taskLevel !== taskFilters.taskLevel) return false;
      if (taskFilters.status && task.status !== taskFilters.status) return false;
      if (taskFilters.priority && task.priority !== taskFilters.priority) return false;
      if (taskFilters.dueDate && task.dueDate !== taskFilters.dueDate) return false;
      const query = taskFilters.search.trim().toLowerCase();
      if (query && ![task.title, task.description, task.notes, task.taskCategory, task.department, assignedStaff?.email, assignedStaff?.name, assignedStaff?.fullName].some((value) => String(value || '').toLowerCase().includes(query))) return false;
      return true;
    });
    return (
      <div className="space-y-4">
        <SectionCard title="Staff Tasks" subtitle="Task Board / Assignment Desk for management, newsroom, field, finance, ads, technical, grievance, SEO, live TV, video, social, and intern work.">
          <div className="flex flex-wrap gap-2">{TASK_BOARD_VIEWS.map((view) => <span key={view} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{view}</span>)}</div>
        </SectionCard>
        <SectionCard title="Create Task" subtitle="Founder can create, assign, reassign, review, close, and delete tasks when backend permissions allow it.">
          <form className="space-y-4" onSubmit={submitTeamTask}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={fieldLabelClass}>Task Title<input value={taskForm.title} onChange={(event) => setTaskForm((state) => ({ ...state, title: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Assigned Staff<select value={taskForm.assignedStaffId} onChange={(event) => setTaskForm((state) => ({ ...state, assignedStaffId: event.target.value }))} className={inputClass}><option value="">Select staff</option>{selectableStaffRows.map((staff) => <option key={userId(staff) || staff.email} value={userId(staff)}>{displayFullName(staff, false)} · {displayStaffId(staff.staffId)}</option>)}</select></label><label className={fieldLabelClass}>Account Group<select value={taskForm.accountGroup} onChange={(event) => setTaskForm((state) => ({ ...state, accountGroup: event.target.value }))} className={inputClass}>{ACCOUNT_GROUPS.filter((group) => group !== 'Founder Account').map((group) => <option key={group} value={group}>{group}</option>)}</select></label><label className={fieldLabelClass}>Task Category<select value={taskForm.taskCategory} onChange={(event) => setTaskForm((state) => ({ ...state, taskCategory: event.target.value }))} className={inputClass}>{TASK_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className={fieldLabelClass}>Task Level<select value={taskForm.taskLevel} onChange={(event) => setTaskForm((state) => ({ ...state, taskLevel: event.target.value }))} className={inputClass}>{TASK_LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className={fieldLabelClass}>Department<input value={taskForm.department} onChange={(event) => setTaskForm((state) => ({ ...state, department: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Coverage Area<input value={taskForm.coverageArea} onChange={(event) => setTaskForm((state) => ({ ...state, coverageArea: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Priority<select value={taskForm.priority} onChange={(event) => setTaskForm((state) => ({ ...state, priority: event.target.value }))} className={inputClass}>{TASK_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className={fieldLabelClass}>Due Date<input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((state) => ({ ...state, dueDate: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Status<select value={taskForm.status} onChange={(event) => setTaskForm((state) => ({ ...state, status: event.target.value }))} className={inputClass}>{TASK_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className={fieldLabelClass}>Related Module<input value={taskForm.relatedModule} onChange={(event) => setTaskForm((state) => ({ ...state, relatedModule: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Related News<input value={taskForm.relatedNews} onChange={(event) => setTaskForm((state) => ({ ...state, relatedNews: event.target.value }))} className={inputClass} /></label></div><label className={fieldLabelClass}>Description<textarea value={taskForm.description} onChange={(event) => setTaskForm((state) => ({ ...state, description: event.target.value }))} className={`${inputClass} min-h-24`} /></label><label className={fieldLabelClass}>Notes<textarea value={taskForm.notes} onChange={(event) => setTaskForm((state) => ({ ...state, notes: event.target.value }))} className={`${inputClass} min-h-20`} /></label><button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Save Task</button>
          </form>
        </SectionCard>
        <SectionCard title="Task Board Filters"><div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6"><select value={taskFilters.accountGroup} onChange={(event) => setTaskFilters((state) => ({ ...state, accountGroup: event.target.value }))} className={inputClass}><option value="">Account Group</option>{ACCOUNT_GROUPS.filter((group) => group !== 'Founder Account').map((group) => <option key={group} value={group}>{group}</option>)}</select><select value={taskFilters.assignedStaffId} onChange={(event) => setTaskFilters((state) => ({ ...state, assignedStaffId: event.target.value }))} className={inputClass}><option value="">Assigned Staff</option>{selectableStaffRows.map((staff) => <option key={userId(staff) || staff.email} value={userId(staff)}>{displayFullName(staff, false)}</option>)}</select><select value={taskFilters.taskCategory} onChange={(event) => setTaskFilters((state) => ({ ...state, taskCategory: event.target.value }))} className={inputClass}><option value="">Task Category</option>{TASK_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={taskFilters.taskLevel} onChange={(event) => setTaskFilters((state) => ({ ...state, taskLevel: event.target.value }))} className={inputClass}><option value="">Task Level</option>{TASK_LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={taskFilters.status} onChange={(event) => setTaskFilters((state) => ({ ...state, status: event.target.value }))} className={inputClass}><option value="">Status</option>{TASK_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select><input value={taskFilters.search} onChange={(event) => setTaskFilters((state) => ({ ...state, search: event.target.value }))} className={inputClass} placeholder="Search" /></div></SectionCard>
        <SectionCard title="Task Board">{tasksLoading ? <div className="text-sm text-slate-600">Loading tasks...</div> : taskErr ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{taskErr}</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-slate-600"><th className="py-2 pr-3">Task</th><th className="py-2 pr-3">Assigned Staff</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Level</th><th className="py-2 pr-3">Priority</th><th className="py-2 pr-3">Due</th><th className="py-2 pr-3">Status</th></tr></thead><tbody>{filteredTasks.map((task) => { const staff = selectableStaffRows.find((item) => userId(item) === task.assignedStaffId); return <tr key={String(task.id || task._id || task.title)} className="border-t border-slate-200"><td className="py-3 pr-3 font-semibold text-slate-900">{task.title}</td><td className="py-3 pr-3 text-slate-700">{task.assignedStaffName || (staff ? displayFullName(staff, false) : '-')}</td><td className="py-3 pr-3 text-slate-700">{task.taskCategory || '-'}</td><td className="py-3 pr-3 text-slate-700">{task.taskLevel || '-'}</td><td className="py-3 pr-3 text-slate-700">{task.priority || '-'}</td><td className="py-3 pr-3 text-slate-700">{formatDateTime(task.dueDate)}</td><td className="py-3 pr-3"><StatusPill label={task.status || 'Assigned'} /></td></tr>; })}{!filteredTasks.length ? <tr><td colSpan={7} className="py-6 text-center text-slate-500">No tasks returned by backend for these filters.</td></tr> : null}</tbody></table></div>}</SectionCard>
      </div>
    );
  };

  const renderAccountControl = () => {
    const teamUser = selectedAccessUser;
    const id = teamUser ? userId(teamUser) : '';
    const founder = !!teamUser && isFounderUser(teamUser);
    const busy = !!id && rowBusyId === id;
    return (
      <SectionCard title="Account Control" subtitle="Founder and Founder-appointed account managers can run allowed staff account actions. Appointed managers can never touch Founder account.">
        {!teamUser ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Select staff first.</div> : <div className="space-y-4"><div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-semibold text-slate-950">Select Staff</div><div className="mt-3 space-y-2">{selectableStaffRows.map((item) => { const itemId = userId(item); return <button key={itemId || item.email} type="button" onClick={() => setSelectedAccessUserId(itemId)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${itemId === id ? 'border-slate-900 bg-white text-slate-950 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}><span className="block font-semibold">{displayFullName(item, false)}</span><span className="block text-xs text-slate-500">{roleLabel(item.role)} · {displayStaffId(item.staffId)}</span></button>; })}</div></div><div className="space-y-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="font-semibold text-slate-950">Account Summary</div><div className="mt-2 grid grid-cols-1 gap-3 text-sm md:grid-cols-4"><div>{displayFullName(teamUser, founder)}</div><div>{roleLabel(teamUser.role)}</div><div>{displayStaffId(teamUser.staffId, founder)}</div><div><StatusPill label={founder ? 'Protected Founder' : displayAccountStatus(teamUser, isUserActive(teamUser))} /></div></div></div>{founder ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">Founder account is protected and cannot be controlled here.</div> : null}<label className={fieldLabelClass}>Reason for sensitive actions<textarea value={accessForm.reason} onChange={(event) => setAccessForm((state) => ({ ...state, reason: event.target.value }))} className={`${inputClass} min-h-20`} /></label><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="font-semibold text-slate-950">Allowed Account Control Actions</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openStaffDetails(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100">View Details</button><button type="button" disabled={!canEditStaffAccounts || founder || busy} onClick={() => openEditModal(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Edit Account</button><button type="button" disabled={!canChangeStaffEmail(teamUser) || founder || busy} onClick={() => openEmailChangeModal(teamUser)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">Change Email/Login ID</button><button type="button" disabled={!canManageStaffPasswords || founder || busy} onClick={() => openPasswordModal(teamUser, 'generate')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Generate Temporary Password</button><button type="button" disabled={!canManageStaffPasswords || founder || busy} onClick={() => openPasswordModal(teamUser, 'reset')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Reset Password</button><button type="button" disabled={!canManageStaffPasswords || founder || busy || staffMustChangePassword(teamUser)} onClick={() => runForceChangePassword(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Force Password Change</button><button type="button" disabled={!canManageStaffSessions || founder || busy} onClick={() => runLogoutAllDevices(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Logout All Devices</button><button type="button" disabled={!canSuspendStaffAccounts || founder || busy} onClick={() => openAccessModal(teamUser)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">Extend Access / Reactivate</button><button type="button" disabled={!canSuspendStaffAccounts || founder || busy} onClick={() => runRowAction(id, () => suspendUser(id), 'Account suspended')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Suspend Account</button><button type="button" disabled={!canLockStaffAccounts || founder || busy} onClick={() => runRowAction(id, () => lockUser(id), 'Account locked')} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">Lock Account</button><button type="button" disabled={!canArchiveStaffAccounts || founder || busy} onClick={() => openArchiveModal(teamUser)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Archive Account</button><button type="button" disabled={!isFounder || !canDeleteTestAccounts || founder || busy || !canShowPermanentDeleteAction(teamUser)} onClick={() => openDeleteTestModal(teamUser)} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">Delete Permanently</button></div></div></div></div></div>}
      </SectionCard>
    );
  };

  const renderRolesAndWorkflow = () => (
    <div className="space-y-4">
      <SectionCard title="Roles & Workflow" subtitle="Role gives default access only. Staff Access Control gives final access.">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{ROLE_CONFIGS.filter((roleItem) => roleItem.id !== 'finance_accounts_manager' || DEFAULT_ROLE_ACCESS.some((item) => item.id === 'finance_accounts_manager')).map((roleItem) => <div key={roleItem.id} className={`rounded-xl border p-4 ${roleItem.protected ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="font-semibold text-slate-950">{roleItem.label}</div><div className="flex flex-wrap gap-1.5">{roleItem.badges.map((roleBadge) => <BadgePill key={roleBadge.label} badge={roleBadge} />)}</div></div><p className="mt-3 text-sm leading-6 text-slate-700">{roleItem.description}</p></div>)}</div>
      </SectionCard>
      <SectionCard title="Role Templates" subtitle="Create or update custom default templates. Founder role remains protected.">
        {roleErr ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{roleErr}</div> : null}
        <form className="space-y-4" onSubmit={handleSaveRole}><div className="grid grid-cols-1 gap-4 lg:grid-cols-4"><label className={fieldLabelClass}>Role Name<input value={roleForm.roleName} onChange={(event) => setRoleForm((state) => ({ ...state, roleName: event.target.value }))} className={inputClass} /></label><label className={fieldLabelClass}>Sort Order<input type="number" min={1} value={roleForm.sortOrder} onChange={(event) => setRoleForm((state) => ({ ...state, sortOrder: Number(event.target.value) }))} className={inputClass} /></label><label className={`${fieldLabelClass} lg:col-span-2`}>Description<input value={roleForm.description} onChange={(event) => setRoleForm((state) => ({ ...state, description: event.target.value }))} className={inputClass} /></label></div><div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div><div className="mb-2 text-sm font-semibold text-slate-950">Default Module Access</div><CheckboxList items={ADMIN_MODULES} values={roleForm.moduleAccess} disabled={!isFounder} onChange={(moduleAccess) => setRoleForm((state) => ({ ...state, moduleAccess }))} /></div><div><div className="mb-2 text-sm font-semibold text-slate-950">Default Special Rights</div><CheckboxList items={SPECIAL_RIGHTS} values={roleForm.specialRights} disabled={!isFounder} onChange={(specialRights) => setRoleForm((state) => ({ ...state, specialRights }))} /></div></div><button type="submit" disabled={!isFounder || savingRole} className={`rounded-lg px-4 py-2 text-sm font-semibold ${isFounder ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-300 text-slate-700'}`}>{savingRole ? 'Saving...' : 'Save Role Template'}</button></form>
      </SectionCard>
      <SectionCard title="Access Matrix" subtitle="Read-only default modules and special rights by role. Daily control belongs in Staff Access Control."><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-slate-600"><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Modules</th><th className="py-2 pr-4">Special Rights</th></tr></thead><tbody>{DEFAULT_ROLE_ACCESS.map((roleItem) => <tr key={roleItem.id} className="border-t border-slate-200 align-top"><td className="py-3 pr-4 font-semibold text-slate-950">{roleItem.label}</td><td className="py-3 pr-4 text-xs leading-6 text-slate-700">{roleItem.modules.map((key) => ADMIN_MODULES.find((item) => item.key === key)?.label || key).join(', ')}</td><td className="py-3 pr-4 text-xs leading-6 text-slate-700">{roleItem.specialRights.length ? roleItem.specialRights.map((key) => SPECIAL_RIGHTS.find((item) => item.key === key)?.label || key).join(', ') : 'No special rights'}</td></tr>)}</tbody></table></div></SectionCard>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><SectionCard title="Editorial Workflow"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">Reporter {'->'} Copy Editor {'->'} Editor {'->'} Founder/Admin Publish</div></SectionCard><SectionCard title="Broadcast Workflow"><div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-950">Live TV Controller prepares {'->'} Admin/Founder approves {'->'} Live goes active {'->'} Founder can stop anytime</div></SectionCard></div>
    </div>
  );

  const renderArchivedAccounts = () => (
    <div className="space-y-4">
      <SectionCard title="Archived / Test Accounts" subtitle="Archived accounts, test accounts, duplicate disabled accounts, and backend-deleted records when returned by the API.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Archived Accounts</div><div className="mt-1 text-2xl font-semibold text-slate-950">{archivedRows.filter(isArchivedStaff).length}</div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Test Accounts</div><div className="mt-1 text-2xl font-semibold text-slate-950">{archivedRows.filter(isTestStaffAccount).length}</div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Duplicate Disabled</div><div className="mt-1 text-2xl font-semibold text-slate-950">{archivedRows.filter(isDuplicateDisabledStaff).length}</div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Deleted / Removed</div><div className="mt-1 text-2xl font-semibold text-slate-950">{archivedRows.filter(isDeletedOrTestRemovedStaff).length}</div></div></div>
      </SectionCard>
      <SectionCard title="Archived Accounts"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-slate-600"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email/Login ID</th><th className="py-2 pr-3">Staff ID</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Actions</th></tr></thead><tbody>{archivedRows.map((teamUser) => { const id = userId(teamUser); const busy = rowBusyId === id; return <tr key={id || teamUser.email} className="border-t border-slate-200"><td className="py-3 pr-3 font-semibold text-slate-900">{displayFullName(teamUser, false)}</td><td className="py-3 pr-3 text-slate-700">{teamUser.email || '-'}</td><td className="py-3 pr-3 text-slate-700">{displayStaffId(teamUser.staffId)}</td><td className="py-3 pr-3"><div className="flex flex-wrap gap-1.5">{isArchivedStaff(teamUser) ? <StatusPill label="Archived" tone="slate" /> : null}{isTestStaffAccount(teamUser) ? <StatusPill label="Test Account" tone="amber" /> : null}{isDuplicateDisabledStaff(teamUser) ? <StatusPill label="Duplicate Disabled" tone="amber" /> : null}{isDeletedOrTestRemovedStaff(teamUser) ? <StatusPill label="Deleted/Removed" tone="rose" /> : null}</div></td><td className="py-3 pr-3"><div className="flex flex-wrap gap-2"><button type="button" disabled={!isFounder || !id || busy} onClick={() => runRestoreAccount(teamUser)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">Restore Account</button><button type="button" disabled={!isFounder || !canDeleteTestAccounts || !id || busy || !canShowPermanentDeleteAction(teamUser)} onClick={() => openDeleteTestModal(teamUser)} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">Delete Permanently</button></div></td></tr>; })}</tbody></table></div>{!archivedRows.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No archived or test accounts returned by backend.</div> : null}<div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-900">Delete Permanently is Founder-only, never available for Founder, requires double confirmation, requires a reason, shows a warning, and is sent to the backend permanent-delete route for audit logging.</div></SectionCard>
    </div>
  );

  useEffect(() => {
    void fetchStaff();
    void refreshStaffIdPreview();
    void fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Staff Control Center</div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Create staff, assign tasks, control staff access, manage special rights, passwords, sessions, and staff roles — all under Founder control.</div>
            {!isFounder && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Access denied: founder-only controls are disabled.</div>}
          </div>
          <button type="button" onClick={() => { void fetchStaff(); void refreshStaffIdPreview(); }} disabled={loading || sessionBlocked} className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
            {sessionBlocked ? 'Login required' : loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {STAFF_CONTROL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${activeTab === tab.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {createdEmail && createdTempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="temporary-password-title">
          <div className="w-full max-w-lg rounded-2xl border border-amber-300 bg-white p-5 text-slate-950 shadow-2xl">
            <div id="temporary-password-title" className="text-lg font-semibold">Temporary Password</div>
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Temporary password is visible only once. Copy it now. It will not be shown again.</div>
            <div className="mt-3 text-sm">For: <span className="font-semibold">{createdEmail}</span></div>
            {createdStaffId ? <div className="mt-2 text-sm">Staff ID: <span className="font-semibold">{createdStaffId}</span></div> : null}
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm">{createdTempPassword}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={async () => {
                  try {
                    if (!navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
                    await navigator.clipboard.writeText(createdTempPassword);
                    toast.success('Copied');
                  } catch {
                    toast.error('Copy failed');
                  }
                }}
              >
                Copy
              </button>
              <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100" onClick={() => { setCreatedTempPassword(null); setCreatedEmail(null); setCreatedStaffId(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {emailChangeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="change-staff-email-title">
          <form onSubmit={handleEmailChange} className="w-full max-w-xl rounded-2xl border border-blue-200 bg-white p-5 text-slate-950 shadow-2xl">
            <div id="change-staff-email-title" className="text-lg font-semibold">Change Staff Email / Login ID</div>
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
              Only change email if this is the same staff member. If this is a new person replacing old staff, suspend the old account and create a new account instead.
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <label className={fieldLabelClass}>Current Email / Login ID<input value={emailChangeUser.email || ''} readOnly aria-readonly="true" className={inputClass} /></label>
              <label className={fieldLabelClass}>New Email / Login ID<input type="email" value={emailChangeForm.newEmail} onChange={(event) => setEmailChangeForm((state) => ({ ...state, newEmail: event.target.value }))} placeholder="new.email@example.com" className={inputClass} required /></label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Email/Login ID is used for login and password reset. Use a unique email for each staff account.</div>
              <label className={fieldLabelClass}>Reason for Change<textarea value={emailChangeForm.reason} onChange={(event) => setEmailChangeForm((state) => ({ ...state, reason: event.target.value }))} placeholder="Explain why this same staff member needs a new login email." className={`${inputClass} min-h-24`} required /></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={emailChangeForm.forcePasswordChange} onChange={(event) => setEmailChangeForm((state) => ({ ...state, forcePasswordChange: event.target.checked }))} />
                  Force Password Change
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={emailChangeForm.logoutAllDevices} onChange={(event) => setEmailChangeForm((state) => ({ ...state, logoutAllDevices: event.target.checked }))} />
                  Logout All Devices
                </label>
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold leading-6 text-rose-900">
                <input type="checkbox" className="mt-1" checked={emailChangeForm.confirmedSamePerson} onChange={(event) => setEmailChangeForm((state) => ({ ...state, confirmedSamePerson: event.target.checked }))} required />
                I confirm this is the same staff person, not a new replacement user.
              </label>
            </div>
            {emailChangeErr ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{emailChangeErr}</div> : null}
            {emailChangeSuccess ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-800">{emailChangeSuccess}</div> : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={closeEmailChangeModal} disabled={changingEmail} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={changingEmail || !emailChangeForm.confirmedSamePerson} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{changingEmail ? 'Updating...' : 'Update Email'}</button>
            </div>
          </form>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-staff-account-title">
          <form onSubmit={handleSaveEditAccount} className="my-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl">
            <div id="edit-staff-account-title" className="text-lg font-semibold">Edit Account</div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className={fieldLabelClass}>Full Name<input value={editForm.fullName} onChange={(event) => setEditForm((state) => ({ ...state, fullName: event.target.value }))} className={inputClass} required /></label>
              <label className={fieldLabelClass}>Role<select value={editForm.role} onChange={(event) => setEditForm((state) => ({ ...state, role: event.target.value, department: safeDepartmentForRole(event.target.value, state.department) }))} className={inputClass}>{roleOptions.filter((option) => option.id !== 'founder').map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label className={fieldLabelClass}>Department<select value={editForm.department} onChange={(event) => setEditForm((state) => ({ ...state, department: event.target.value }))} className={inputClass}>{DEPARTMENT_OPTIONS.filter((option) => option !== FOUNDER_DEPARTMENT).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className={fieldLabelClass}>Designation<input value={editForm.designation} onChange={(event) => setEditForm((state) => ({ ...state, designation: event.target.value }))} className={inputClass} /></label>
              <MultiSelectDropdown label="Assigned Sections" helper="Select staff content sections." values={editForm.assignedSections} options={ASSIGNED_SECTION_OPTIONS} onChange={(assignedSections) => setEditForm((state) => ({ ...state, assignedSections }))} />
              <MultiSelectDropdown label="Coverage Area" helper="Select staff coverage areas." values={editForm.coverageArea} options={COVERAGE_AREA_OPTIONS} onChange={(coverageArea) => setEditForm((state) => ({ ...state, coverageArea }))} />
              <label className={fieldLabelClass}>Access Expiry Date<input type="date" value={editForm.accessExpiryDate} onChange={(event) => setEditForm((state) => ({ ...state, accessExpiryDate: event.target.value }))} className={inputClass} /></label>
              <label className={fieldLabelClass}>Account Status<select value={editForm.accountStatus} disabled={!canSuspendStaffAccounts} onChange={(event) => setEditForm((state) => ({ ...state, accountStatus: event.target.value }))} className={inputClass}>{ACCOUNT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Staff ID</div><div className="mt-1 font-semibold text-slate-950">{displayStaffId(editUser.staffId)}</div></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Created At</div><div className="mt-1 font-semibold text-slate-950">{formatDateTime(editUser.createdAt)}</div></div>
            </div>
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">Founder protected fields are read-only here and cannot be assigned to staff.</div>
            {editErr ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{editErr}</div> : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={closeEditModal} disabled={savingEdit} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={savingEdit} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{savingEdit ? 'Saving...' : 'Save Account'}</button>
            </div>
          </form>
        </div>
      )}

      {staffActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="staff-action-title">
          <div className="my-8 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl">
            <div id="staff-action-title" className="text-lg font-semibold">
              {staffActionModal.type === 'password' ? (staffActionModal.mode === 'generate' ? 'Generate Temporary Password' : 'Reset Password') : staffActionModal.type === 'access' ? 'Extend Access / Reactivate' : staffActionModal.type === 'archive' ? 'Archive Account' : staffActionModal.type === 'mark-test' ? 'Mark as Test / Unwanted' : 'Delete Test Account'}
            </div>
            <div className="mt-2 text-sm text-slate-600">{displayFullName(staffActionModal.user, false)} · {staffActionModal.user.email || '-'}</div>

            {staffActionModal.type === 'password' ? (
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 font-semibold text-amber-950">Copy now. This password will not be shown again.</div>
                {staffActionModal.mode === 'reset' ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">Confirm reset. Backend will generate a temporary password, set mustChangePassword=true, and logout all devices.</div> : null}
              </div>
            ) : null}

            {staffActionModal.type === 'access' ? (
              <div className="mt-4 grid grid-cols-1 gap-4">
                <label className={fieldLabelClass}>New Access Expiry Date<input type="date" value={accessForm.accessExpiryDate} onChange={(event) => setAccessForm((state) => ({ ...state, accessExpiryDate: event.target.value }))} className={inputClass} required /></label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={accessForm.reactivate} onChange={(event) => setAccessForm((state) => ({ ...state, reactivate: event.target.checked }))} />Reactivate account</label>
                <label className={fieldLabelClass}>Reason<textarea value={accessForm.reason} onChange={(event) => setAccessForm((state) => ({ ...state, reason: event.target.value }))} className={`${inputClass} min-h-24`} /></label>
              </div>
            ) : null}

            {staffActionModal.type === 'archive' ? (
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Archive disables login and hides this staff account from active lists, but keeps audit history.</div>
                <label className={fieldLabelClass}>Reason<textarea value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} className={`${inputClass} min-h-24`} /></label>
              </div>
            ) : null}

            {staffActionModal.type === 'delete-test' ? (
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold leading-6 text-rose-900">Warning: this permanently removes an archived/test account when the backend allows it. Founder account can never be deleted. Audit log reason is required.</div>
                <label className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold leading-6 text-rose-900"><input type="checkbox" className="mt-1" checked={deleteTestForm.confirmed} onChange={(event) => setDeleteTestForm((state) => ({ ...state, confirmed: event.target.checked }))} />I confirm this is not the Founder account and permanent deletion is intended.</label>
                <label className={fieldLabelClass}>Type DELETE PERMANENTLY<input value={deleteTestForm.confirmation} onChange={(event) => setDeleteTestForm((state) => ({ ...state, confirmation: event.target.value }))} className={inputClass} /></label>
                <label className={fieldLabelClass}>Reason<textarea value={deleteTestForm.reason} onChange={(event) => setDeleteTestForm((state) => ({ ...state, reason: event.target.value }))} className={`${inputClass} min-h-24`} required /></label>
              </div>
            ) : null}

            {staffActionModal.type === 'mark-test' ? (
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">Mark this account as test/unwanted only when it is not a real staff account.</div>
                <label className={fieldLabelClass}>Reason<textarea value={markTestForm.reason} onChange={(event) => setMarkTestForm((state) => ({ ...state, reason: event.target.value }))} className={`${inputClass} min-h-24`} required /></label>
                <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold leading-6 text-amber-900"><input type="checkbox" className="mt-1" checked={markTestForm.confirmed} onChange={(event) => setMarkTestForm((state) => ({ ...state, confirmed: event.target.checked }))} />I confirm this is a test/unwanted account, not a real staff account.</label>
              </div>
            ) : null}

            {staffActionErr ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{staffActionErr}</div> : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={closeStaffActionModal} disabled={staffActionBusy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
              {staffActionModal.type === 'password' ? <button type="button" onClick={submitPasswordAction} disabled={staffActionBusy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{staffActionBusy ? 'Working...' : staffActionModal.mode === 'generate' ? 'Generate' : 'Reset Password'}</button> : null}
              {staffActionModal.type === 'access' ? <button type="button" onClick={submitAccessAction} disabled={staffActionBusy || !accessForm.accessExpiryDate} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{staffActionBusy ? 'Saving...' : accessForm.reactivate ? 'Reactivate' : 'Extend Access'}</button> : null}
              {staffActionModal.type === 'archive' ? <button type="button" onClick={submitArchiveAction} disabled={staffActionBusy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{staffActionBusy ? 'Archiving...' : 'Archive Account'}</button> : null}
              {staffActionModal.type === 'delete-test' ? <button type="button" onClick={submitDeleteTestAction} disabled={staffActionBusy || deleteTestForm.confirmation !== 'DELETE PERMANENTLY' || !deleteTestForm.confirmed || !deleteTestForm.reason.trim()} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{staffActionBusy ? 'Deleting...' : 'Delete Permanently'}</button> : null}
              {staffActionModal.type === 'mark-test' ? <button type="button" onClick={submitMarkTestAction} disabled={staffActionBusy || !markTestForm.reason.trim() || !markTestForm.confirmed} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{staffActionBusy ? 'Saving...' : 'Mark as Test / Unwanted'}</button> : null}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' ? renderCreateStaffAccount() : null}
      {activeTab === 'registry' ? renderStaffRegistry() : null}
      {activeTab === 'access' ? renderFounderAccessStudio() : null}
      {activeTab === 'tasks' ? renderStaffTasks() : null}
      {activeTab === 'account' ? renderAccountControl() : null}
      {activeTab === 'security' ? renderSecurityAndSessions() : null}
      {activeTab === 'roles' ? renderRolesAndWorkflow() : null}
      {activeTab === 'archived' ? renderArchivedAccounts() : null}
      {activeTab === 'audit' ? <AuditLogsView /> : null}

      {detailsUser ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="dialog" aria-modal="true" aria-labelledby="staff-details-title">
          <div className="h-full w-full max-w-4xl overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div id="staff-details-title" className="text-lg font-semibold text-slate-950">Staff Details</div>
                <div className="mt-1 text-sm text-slate-600">{displayFullName(detailsUser, isFounderUser(detailsUser))} · {detailsUser.email || '-'}</div>
              </div>
              <button type="button" onClick={() => setDetailsUser(null)} className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100">Close</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">{STAFF_DETAILS_TABS.map((tab) => <button key={tab.key} type="button" onClick={() => setDetailsTab(tab.key)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${detailsTab === tab.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}>{tab.label}</button>)}</div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {detailsTab === 'profile' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><div><div className="text-xs font-semibold uppercase text-slate-500">Full Name</div><div className="mt-1 font-semibold text-slate-950">{displayFullName(detailsUser, isFounderUser(detailsUser))}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Staff ID</div><div className="mt-1 font-semibold text-slate-950">{displayStaffId(detailsUser.staffId, isFounderUser(detailsUser))}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Role</div><div className="mt-1 font-semibold text-slate-950">{roleLabel(detailsUser.role)}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Department</div><div className="mt-1 font-semibold text-slate-950">{displayDepartment(detailsUser, isFounderUser(detailsUser))}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Assigned Sections</div><div className="mt-1 font-semibold text-slate-950">{listText(detailsUser.assignedSections)}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Coverage Area</div><div className="mt-1 font-semibold text-slate-950">{listText(coverageAreaValues(detailsUser))}</div></div></div> : null}
              {detailsTab === 'access' ? <div className="flex flex-wrap gap-1.5">{getEffectiveModuleAccess(detailsUser).map((key) => <StatusPill key={key} label={ADMIN_MODULES.find((item) => item.key === key)?.label || key} tone={FOUNDER_ONLY_MODULES.has(key) ? 'rose' : 'emerald'} />)}</div> : null}
              {detailsTab === 'rights' ? <div className="flex flex-wrap gap-1.5">{getEffectiveSpecialRights(detailsUser).map((key) => <StatusPill key={key} label={SPECIAL_RIGHTS.find((item) => item.key === key)?.label || key} tone={FOUNDER_ONLY_RIGHTS.has(key) ? 'rose' : 'blue'} />)}</div> : null}
              {detailsTab === 'security' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><div><div className="text-xs font-semibold uppercase text-slate-500">Account Status</div><div className="mt-1"><StatusPill label={displayAccountStatus(detailsUser, isUserActive(detailsUser))} /></div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Session Status</div><div className="mt-1"><StatusPill label={getSessionStatusDisplay(detailsUser, user)} /></div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Must Change Password</div><div className="mt-1 font-semibold text-slate-950">{staffMustChangePassword(detailsUser) ? 'Yes' : 'No'}</div></div></div> : null}
              {detailsTab === 'activity' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-4"><div><div className="text-xs font-semibold uppercase text-slate-500">Last Login</div><div className="mt-1 font-semibold text-slate-950">{formatDateTime(detailsUser.lastLogin || detailsUser.lastLoginAt || detailsUser.loginAt)}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Last Logout</div><div className="mt-1 font-semibold text-slate-950">{formatDateTime(detailsUser.lastLogout || detailsUser.lastLogoutAt || detailsUser.logoutAt)}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Created At</div><div className="mt-1 font-semibold text-slate-950">{formatDateTime(detailsUser.createdAt)}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Updated At</div><div className="mt-1 font-semibold text-slate-950">{formatDateTime(detailsUser.updatedAt)}</div></div></div> : null}
              {detailsTab === 'danger' ? <div className="space-y-3"><div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-semibold text-rose-900">{isFounderUser(detailsUser) ? 'Founder account is protected. No staff danger actions are available.' : 'Archive or permanent-delete actions require Founder permission and backend enforcement.'}</div>{!isFounderUser(detailsUser) ? <div className="flex flex-wrap gap-2"><button type="button" disabled={!canArchiveStaffAccounts} onClick={() => openArchiveModal(detailsUser)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Archive</button>{canShowPermanentDeleteAction(detailsUser) ? <button type="button" disabled={!isFounder || !canDeleteTestAccounts} onClick={() => openDeleteTestModal(detailsUser)} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">Delete Permanently</button> : null}</div> : null}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {false ? (<div className="hidden" aria-hidden="true">

      <SectionCard title="Founder Protection">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-950">
          <div className="text-base font-semibold">Founder Protection Active</div>
          <div className="mt-3 space-y-1 leading-6">
            <p>Founder has full ownership and all rights reserved.</p>
            <p>Founder can create roles, assign access control, create staff accounts, and override any staff access.</p>
            <p>Founder account and Founder role cannot be deleted, suspended, demoted, edited, or restricted.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Password Reset / Temporary Password">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-800">
          <div className="text-base font-semibold text-slate-950">News Pulse never stores readable passwords.</div>
          <div className="mt-3 space-y-1 leading-6">
            <p>No one can view current staff passwords, including Founder and Admin.</p>
            <p>Temporary passwords are visible only once and expire automatically.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Create Staff Account" subtitle="Invite staff with account status, role, access expiry, and password-safety options.">
        <form className="space-y-5" onSubmit={handleCreate}>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            Founder account cannot be created here. This form is only for staff accounts. Founder account is protected and must be managed from Founder My Account / Safe Zone.
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className={fieldLabelClass}>Full Name<input value={createForm.name} onChange={(e) => setCreateForm((state) => ({ ...state, name: e.target.value }))} placeholder="Full Name" className={inputClass} /></label>
            <label className={fieldLabelClass}>Email / Login ID<input value={createForm.email} onChange={(e) => setCreateForm((state) => ({ ...state, email: e.target.value }))} placeholder="Email / Login ID" className={inputClass} /></label>
            <label className={fieldLabelClass}>{staffIdPreviewLabel}<input value={loadingStaffIdPreview ? 'Loading next staff ID...' : staffIdPreviewText} readOnly aria-readonly="true" placeholder="Auto-generated, e.g. NP-2026-0001" aria-label="Next Non-Founder Staff ID" className={inputClass} /></label>
            <label className={fieldLabelClass}>Role<select value={createForm.role} onChange={(e) => setRoleAndDepartment(e.target.value)} className={inputClass}>
              {roleOptions.map((roleItem) => <option key={roleItem.id} value={roleItem.id} disabled={roleItem.protected}>{roleItem.label}{roleItem.protected ? ' (protected)' : ''}</option>)}
            </select><span className="text-xs font-normal leading-5 text-slate-500">Founder is protected and cannot be created here.</span></label>
            <label className={fieldLabelClass}>Department<select value={createForm.department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
              <option value="">Select Department</option>
              {DEPARTMENT_OPTIONS.map((department) => <option key={department} value={department}>{department}</option>)}
            </select><span className="text-xs font-normal leading-5 text-slate-500">Department is auto-selected from Role. Founder can adjust if needed.</span></label>
            <MultiSelectDropdown
              label="Assigned Sections"
              helper="Select website sections this staff member can work on. Gujarat means full Gujarat coverage."
              values={createForm.assignedSections}
              options={ASSIGNED_SECTION_OPTIONS}
              onChange={setAssignedSections}
            />
            <label className={fieldLabelClass}>Account Status<select value={createForm.accountStatus} onChange={(e) => setCreateForm((state) => ({ ...state, accountStatus: e.target.value }))} className={inputClass}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="locked">Locked</option>
            </select></label>
            <label className={fieldLabelClass}>Access Expiry Date<input type="date" value={createForm.expiresAt} onChange={(e) => setCreateForm((state) => ({ ...state, expiresAt: e.target.value }))} className={inputClass} /></label>
            <label className={fieldLabelClass}>Designation<input value={createForm.designation} onChange={(e) => setCreateForm((state) => ({ ...state, designation: e.target.value }))} placeholder="Designation" className={inputClass} /></label>
            <MultiSelectDropdown
              label="Coverage Area"
              helper="Select city/region responsibility. Use All Gujarat for state-wide coverage."
              values={createForm.coverageArea}
              options={COVERAGE_AREA_OPTIONS}
              onChange={(coverageArea) => setCreateForm((state) => ({ ...state, coverageArea }))}
            />
          </div>
          {founderEmailTypedInCreate ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">This looks like Founder email. Do not create Founder as staff. Use Founder My Account / backend repair.</div> : null}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">Staff ID is auto-generated and used for internal records, attendance, reports, and access logs.</div>
            <div className="mt-1 text-xs text-slate-600">Founder ID is protected as {FOUNDER_STAFF_ID}. This ID is for new staff accounts only.</div>
            <div className="mt-1 text-xs text-slate-600">{nextStaffIdPreview ? `Next Non-Founder Staff ID: ${nextStaffIdPreview}` : 'Auto-generated on create'}</div>
          </div>
          {createErr ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{createErr}</div> : null}
          {createForm.assignedSections.includes('Gujarat') && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              Gujarat in Assigned Sections means full Gujarat state coverage, including all cities and districts. Coverage Area decides exact city/region responsibility.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={createForm.generateTemporaryPassword} onChange={(e) => setCreateForm((state) => ({ ...state, generateTemporaryPassword: e.target.checked }))} />
              Generate Temporary Password
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={createForm.mustChangePassword} onChange={(e) => setCreateForm((state) => ({ ...state, mustChangePassword: e.target.checked }))} />
              Must Change Password on First Login
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className={fieldLabelClass}>Special Permissions<textarea value={createForm.permissions} onChange={(e) => setCreateForm((state) => ({ ...state, permissions: e.target.value }))} placeholder="Optional, comma-separated" className={`${inputClass} min-h-28`} /></label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Selected role plan: {selectedRole?.label}</div>
              <p className="mt-2 leading-6">{selectedRole?.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{selectedRole?.badges.map((roleBadge) => <BadgePill key={roleBadge.label} badge={roleBadge} />)}</div>
              <div className="mt-3 text-xs text-slate-600">Default permissions are applied unless special permissions are entered above.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={!isFounder || creating} className={`rounded-lg px-4 py-2 text-sm font-semibold ${isFounder ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-300 text-slate-700'}`}>{creating ? 'Creating...' : 'Create Account'}</button>
            {!isFounder && <div className="text-xs text-slate-600">Founder-only</div>}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Role Templates" subtitle="Create custom roles, set display rank, and grant module access or special rights.">
        {roleErr ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{roleErr}</div> : null}
        <form className="space-y-5" onSubmit={handleSaveRole}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <label className={fieldLabelClass}>Role Name<input value={roleForm.roleName} onChange={(e) => setRoleForm((state) => ({ ...state, roleName: e.target.value }))} placeholder="Role Name" className={inputClass} /></label>
            <label className={fieldLabelClass}>Sort Order / Display Rank<input type="number" min={1} value={roleForm.sortOrder} onChange={(e) => setRoleForm((state) => ({ ...state, sortOrder: Number(e.target.value) }))} placeholder="99" className={inputClass} /></label>
            <label className={`${fieldLabelClass} lg:col-span-2`}>Role Description<input value={roleForm.description} onChange={(e) => setRoleForm((state) => ({ ...state, description: e.target.value }))} placeholder="Role Description" className={inputClass} /></label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Lower number appears higher in the role list. Custom roles can use 99 by default.</div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 font-semibold text-slate-700">Custom Role</span>
            <span className="text-slate-600">System Role / Custom Role indicator</span>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-950">Module Access</div>
            <CheckboxList items={ADMIN_MODULES} values={roleForm.moduleAccess} disabled={!isFounder} onChange={(moduleAccess) => setRoleForm((state) => ({ ...state, moduleAccess }))} />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-950">Special Rights</div>
            <CheckboxList items={SPECIAL_RIGHTS} values={roleForm.specialRights} disabled={!isFounder} onChange={(specialRights) => setRoleForm((state) => ({ ...state, specialRights }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={!isFounder || savingRole} className={`rounded-lg px-4 py-2 text-sm font-semibold ${isFounder ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-300 text-slate-700'}`}>{savingRole ? 'Saving...' : 'Save Role'}</button>
            <div className="text-xs text-slate-600">Founder role/account remains permanently protected.</div>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Access Matrix" subtitle="Review default modules and special rights for system and custom roles.">
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950">Role gives default access. Founder can customize access for any individual staff member.</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-slate-600"><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">System / Custom</th><th className="py-2 pr-4">Module Access</th><th className="py-2 pr-4">Special Rights</th></tr></thead>
              <tbody>
                {DEFAULT_ROLE_ACCESS.map((roleItem) => (
                  <tr key={roleItem.id} className="border-t border-slate-200 align-top">
                    <td className="py-3 pr-4 font-semibold text-slate-950">{roleItem.label}</td>
                    <td className="py-3 pr-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleItem.protected ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>{roleItem.protected ? 'Protected System Role' : 'System Role'}</span></td>
                    <td className="py-3 pr-4 text-xs leading-6 text-slate-700">{roleItem.modules.map((key) => ADMIN_MODULES.find((item) => item.key === key)?.label || key).join(', ')}</td>
                    <td className="py-3 pr-4 text-xs leading-6 text-slate-700">{roleItem.specialRights.length ? roleItem.specialRights.map((key) => SPECIAL_RIGHTS.find((item) => item.key === key)?.label || key).join(', ') : 'No special rights'}</td>
                  </tr>
                ))}
                {roles.map((roleItem) => (
                  <tr key={String(roleItem._id || roleItem.id || roleItem.roleName)} className="border-t border-slate-200 align-top">
                    <td className="py-3 pr-4 font-semibold text-slate-950">{roleItem.roleName || roleItem.id || 'Custom Role'}</td>
                    <td className="py-3 pr-4"><span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">Custom Role</span></td>
                    <td className="py-3 pr-4 text-xs leading-6 text-slate-700">{(roleItem.moduleAccess || []).map((key) => ADMIN_MODULES.find((item) => item.key === key)?.label || key).join(', ') || 'No modules selected'}</td>
                    <td className="py-3 pr-4 text-xs leading-6 text-slate-700">{(roleItem.specialRights || []).map((key) => SPECIAL_RIGHTS.find((item) => item.key === key)?.label || key).join(', ') || 'No special rights'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Role Overview">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {ROLE_CONFIGS.map((roleItem) => (
            <div key={roleItem.id} className={`rounded-xl border p-4 ${roleItem.protected ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold text-slate-950">{roleItem.label}</div>
                <div className="flex flex-wrap gap-1.5">{roleItem.badges.map((roleBadge) => <BadgePill key={roleBadge.label} badge={roleBadge} />)}</div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{roleItem.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Editorial Workflow">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {STORY_RIGHTS.map((group) => (
            <div key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-semibold text-slate-950">{group.title}</div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">{group.points.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <div className="font-semibold">Workflow text</div>
          <div className="mt-2 space-y-1 leading-6">{WORKFLOWS.map((workflow) => <p key={workflow}>{workflow}</p>)}</div>
        </div>
      </SectionCard>

      <SectionCard title="Live TV Rights">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <div className="text-base font-semibold">Live TV Rights</div>
          <div className="mt-3 space-y-1 leading-6">
            <p>Live TV is a sensitive public broadcast feature.</p>
            <p>Only Founder has full Live TV control.</p>
            <p>Admin or Live TV Controller may prepare stream links, schedules, tickers, and recordings only if permission is granted.</p>
            <p>Going LIVE requires Founder/Admin approval.</p>
            <p>Founder can stop Live TV instantly using Emergency Stop.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="font-semibold text-slate-950">Live TV Controller can</div><ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700"><li>prepare live stream link</li><li>add live title</li><li>add live description</li><li>add live ticker</li><li>schedule live event</li><li>update live status</li><li>prepare recordings/clips</li></ul></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="font-semibold text-slate-950">Live TV Controller cannot</div><ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700"><li>access Safe Owner Zone</li><li>change Founder settings</li><li>manage team</li><li>change public site settings</li><li>go live without approval if Founder/Admin approval is required</li></ul></div>
        </div>
      </SectionCard>

      <SectionCard title="Staff Access Control">
        <div className="space-y-3">
          {teamRows.filter((teamUser) => !isFounderUser(teamUser)).map((teamUser) => {
            const id = userId(teamUser);
            const draft = overrideDrafts[id] || { moduleAccess: getEffectiveModuleAccess(teamUser), specialRights: getEffectiveSpecialRights(teamUser) };
            const assignedModules = defaultModulesForRole(teamUser.role);
            const assignedRights = defaultRightsForRole(teamUser.role);
            return (
              <div key={id || teamUser.email || teamUser.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold text-slate-950">{teamUser.name || 'Unnamed staff'} · {roleLabel(teamUser.role)}</div>
                    <div className="mt-1 text-xs text-slate-600">{teamUser.email || '-'} · {displayStaffId(teamUser.staffId)}</div>
                  </div>
                  <button type="button" disabled={!isFounder || !id || savingOverrideId === id} onClick={() => saveOverride(teamUser)} className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{savingOverrideId === id ? 'Saving...' : 'Save Override'}</button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-950">Assigned role access</div>
                    <div className="flex flex-wrap gap-1.5 text-xs text-slate-700">
                      {assignedModules.map((key) => <span key={key} className="rounded-full border border-slate-200 bg-white px-2 py-1">{ADMIN_MODULES.find((item) => item.key === key)?.label || key}</span>)}
                      {assignedRights.map((key) => <span key={key} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800">{SPECIAL_RIGHTS.find((item) => item.key === key)?.label || key}</span>)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-950">Individual override modules</div>
                    <CheckboxList items={ADMIN_MODULES} values={draft.moduleAccess} disabled={!isFounder} onChange={(moduleAccess) => setOverrideDrafts((state) => ({ ...state, [id]: { ...draft, moduleAccess } }))} />
                  </div>
                  <div className="xl:col-span-2">
                    <div className="mb-2 text-sm font-semibold text-slate-950">Individual special rights</div>
                    <CheckboxList items={SPECIAL_RIGHTS} values={draft.specialRights} disabled={!isFounder} onChange={(specialRights) => setOverrideDrafts((state) => ({ ...state, [id]: { ...draft, specialRights } }))} />
                  </div>
                </div>
              </div>
            );
          })}
          {!teamRows.filter((teamUser) => !isFounderUser(teamUser)).length && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No staff accounts loaded yet.</div>}
        </div>
      </SectionCard>

      <SectionCard title="Suspend / Lock / Logout Staff">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          Founder can suspend accounts, lock accounts when backend support is available, reset staff passwords, force password changes, and logout all staff devices. Founder account and Founder role are excluded from every staff control action.
        </div>
      </SectionCard>

      <SectionCard
        title="Staff Activity & Attendance"
        subtitle="Track session status, login/logout, attendance, breaks, off days, leave, and schedules."
        actions={(
          <button
            type="button"
            onClick={() => navigate('/admin/settings/admin-panel/staff-activity-attendance')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Staff Activity & Attendance
          </button>
        )}
      >
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          Login/logout and attendance records now live on their own Settings Center page.
        </div>
      </SectionCard>

      <SectionCard title="Staff Registry" subtitle="Account Status is account access. Session Status is login/session state.">
        {loading ? <div className="text-slate-600">Loading...</div> : err ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">{err} Showing the protected founder account view below.</div> : null}
        {isFounder && founderLikeCount > 1 ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Multiple Founder-like records detected. Review old/test accounts.</div> : null}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <div className="font-semibold">Email/Login ID change policy</div>
            <p className="mt-2">Same staff person = update email, keep same Staff ID, logout all devices, force password change.</p>
            <p>New staff person = create new account, new Staff ID. Do not reuse old account.</p>
            <p>Old staff leaves = suspend/lock account and keep audit history.</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">Do not reuse an old staff account for a new person. Suspend old account and create new account.</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STAFF_LIST_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStaffListFilter(filter.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${staffListFilter === filter.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-slate-600"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email / Login ID</th><th className="py-2 pr-3">Staff ID</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Account Status</th><th className="py-2 pr-3">Session Status</th><th className="py-2 pr-3">Last Login</th><th className="py-2 pr-3">Last Logout</th><th className="py-2 pr-3">Actions</th></tr></thead>
            <tbody>
              {teamRows.map((teamUser) => {
                const id = userId(teamUser);
                const founder = isFounderUser(teamUser);
                const active = founder || isUserActive(teamUser);
                const accountStatus = founder ? 'Active' : displayAccountStatus(teamUser, active);
                const sessionStatus = getSessionStatusDisplay(teamUser, user);
                const currentUser = matchesCurrentUser(teamUser, user);
                const busy = rowBusyId === id;
                const mustChangePassword = staffMustChangePassword(teamUser);
                const rowRole = founder ? roleById('founder') : roleById(teamUser.role);
                const rowBadges = founder ? [badge('Founder', 'protected'), ...(rowRole?.badges || [])] : rowRole?.badges || [badge('Limited', 'limited')];
                const rowKey = id || `${teamUser.email}-${teamUser.name}`;
                const testAccount = !founder && canShowDeleteTestAction(teamUser);
                const showTestBadge = !founder && isTestStaffAccount(teamUser);
                const archivedBadge = !founder && isArchivedStaff(teamUser);
                const deletedTestBadge = !founder && isDeletedOrTestRemovedStaff(teamUser);
                const duplicateDisabledBadge = !founder && isDuplicateDisabledStaff(teamUser);
                const actionDisabled = !id || busy;
                const showAccessAction = !founder && shouldShowAccessAction(accountStatus);
                const showSuspendAction = !founder && shouldShowSuspendAction(accountStatus);
                const showLockAction = !founder && shouldShowLockAction(teamUser, accountStatus);
                const showArchiveAction = !founder && !isArchivedStaff(teamUser) && !isDeletedOrTestRemovedStaff(teamUser);
                return (
                  <Fragment key={rowKey}>
                    <tr key={rowKey} className="border-t border-slate-200 align-top">
                      <td className="py-3 pr-3 font-medium text-slate-900"><div className="flex flex-wrap items-center gap-2"><span>{displayFullName(teamUser, founder)}</span>{currentUser ? <StatusPill label="You" tone="violet" /> : null}{founder ? <StatusPill label="Protected" tone="rose" /> : null}{archivedBadge ? <StatusPill label="Archived" tone="slate" /> : null}{deletedTestBadge ? <StatusPill label="Deleted Test" tone="rose" /> : null}{duplicateDisabledBadge ? <StatusPill label="Duplicate Disabled" tone="amber" /> : null}{showTestBadge ? <StatusPill label="Test Account" tone="amber" /> : null}</div></td>
                      <td className="py-3 pr-3 text-slate-700">{teamUser.email || (founder ? FOUNDER_EMAIL : '-')}</td>
                      <td className="py-3 pr-3 text-slate-700">{displayStaffId(teamUser.staffId, founder)}</td>
                      <td className="py-3 pr-3"><div className="font-semibold text-slate-900">{rowRole?.label || teamUser.role || 'Staff'}</div><div className="mt-1 flex flex-wrap gap-1.5">{rowBadges.map((roleBadge) => <BadgePill key={roleBadge.label} badge={roleBadge} />)}</div></td>
                      <td className="py-3 pr-3"><div className="flex flex-wrap gap-1.5"><StatusPill label={accountStatus} />{mustChangePassword ? <StatusPill label="Must Change Password" tone="amber" /> : null}</div></td>
                      <td className="py-3 pr-3"><StatusPill label={sessionStatus} /></td>
                      <td className="py-3 pr-3 text-slate-700">{formatDateTime(teamUser.lastLogin || teamUser.lastLoginAt || teamUser.loginAt)}</td>
                      <td className="py-3 pr-3 text-slate-700">{formatDateTime(teamUser.lastLogout || teamUser.lastLogoutAt || teamUser.logoutAt)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setExpandedStaffId(expandedStaffId === rowKey ? null : rowKey)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">{expandedStaffId === rowKey ? 'Hide Details' : 'View Details'}</button>
                          {founder ? (
                            <><span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800">Protected</span><span className="max-w-xs rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold leading-5 text-rose-800">Founder account is protected. Manage from Founder My Account / Safe Zone.</span></>
                          ) : (
                            <><button type="button" disabled={!canEditStaffAccounts || actionDisabled} onClick={() => openEditModal(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Edit Account</button><button type="button" disabled={!canChangeStaffEmail(teamUser) || busy} onClick={() => openEmailChangeModal(teamUser)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">Change Email / Login ID</button><button type="button" disabled={!canManageStaffPasswords || actionDisabled} onClick={() => openPasswordModal(teamUser, 'generate')} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Generate Temporary Password</button><button type="button" disabled={!canManageStaffPasswords || actionDisabled} onClick={() => openPasswordModal(teamUser, 'reset')} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Reset Password</button><button type="button" disabled={!canManageStaffPasswords || actionDisabled || mustChangePassword} onClick={() => runForceChangePassword(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Force Change Password</button>{showAccessAction ? <button type="button" disabled={!canSuspendStaffAccounts || actionDisabled} onClick={() => openAccessModal(teamUser)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">{accountStatus === 'Locked' ? 'Unlock / Reactivate' : 'Extend Access / Reactivate'}</button> : null}{showSuspendAction ? <button type="button" disabled={!canSuspendStaffAccounts || actionDisabled} onClick={() => runRowAction(id, () => suspendUser(id), 'Account suspended')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Suspend Account</button> : null}{showLockAction ? <button type="button" disabled={!canLockStaffAccounts || actionDisabled} onClick={() => runRowAction(id, () => lockUser(id), 'Account locked')} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">Lock Account</button> : null}<button type="button" disabled={!canManageStaffSessions || actionDisabled} onClick={() => runLogoutAllDevices(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Logout All Devices</button>{showArchiveAction ? <button type="button" disabled={!canArchiveStaffAccounts || actionDisabled} onClick={() => openArchiveModal(teamUser)} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Archive Account</button> : null}{testAccount ? <div className="basis-full rounded-xl border border-rose-200 bg-rose-50 p-2"><div className="mb-2 text-xs font-semibold uppercase text-rose-800">Danger Zone</div><button type="button" disabled={!canDeleteTestAccounts || actionDisabled} onClick={() => openDeleteTestModal(teamUser)} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">Delete Test Account only</button></div> : null}</>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedStaffId === rowKey ? (
                      <tr key={`${rowKey}-details`} className="border-t border-slate-100 bg-slate-50/70">
                        <td colSpan={9} className="p-4">
                          <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
                              <div className="text-xs font-semibold uppercase text-slate-500">{founder ? 'Founder Staff ID' : 'Staff ID'}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 font-medium text-slate-900"><span>{displayStaffId(teamUser.staffId, founder)}</span>{founder ? <StatusPill label="Protected" tone="rose" /> : null}</div>
                              <div className="mt-2 text-xs leading-5 text-slate-600">Staff ID is read-only. Staff ID does not change when email changes.</div>
                            </div>
                            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
                              <div className="text-xs font-semibold uppercase text-slate-500">Email / Login ID</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 font-medium text-slate-900"><span>{teamUser.email || (founder ? FOUNDER_EMAIL : '-')}</span>{mustChangePassword ? <StatusPill label="Must Change Password" tone="amber" /> : null}</div>
                              <div className="mt-2 text-xs leading-5 text-slate-600">Email/Login ID is used for login and password reset. Use a unique email for each staff account.</div>
                              {founder ? (
                                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-800">Founder email is protected. Change only through Safe Zone Founder Security.</div>
                              ) : currentUser ? (
                                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">You cannot change your own email from this screen.</div>
                              ) : (
                                <button type="button" disabled={!canChangeStaffEmail(teamUser)} onClick={() => openEmailChangeModal(teamUser)} className="mt-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">Change Email / Login ID</button>
                              )}
                            </div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Full Name</div><div className="mt-1 font-medium text-slate-900">{displayFullName(teamUser, founder)}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Role</div><div className="mt-1 font-medium text-slate-900">{rowRole?.label || roleLabel(teamUser.role)}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Department</div><div className="mt-1 font-medium text-slate-900">{displayDepartment(teamUser, founder)}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Assigned Sections</div><div className="mt-1 font-medium text-slate-900">{listText(teamUser.assignedSections)}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Coverage Area</div><div className="mt-1 font-medium text-slate-900">{listText(coverageAreaValues(teamUser))}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Designation</div><div className="mt-1 font-medium text-slate-900">{teamUser.designation || '-'}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Account Status</div><div className="mt-1"><StatusPill label={accountStatus} /></div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Session Status</div><div className="mt-1"><StatusPill label={sessionStatus} /></div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Last Login</div><div className="mt-1 font-medium text-slate-900">{formatDateTime(teamUser.lastLogin || teamUser.lastLoginAt || teamUser.loginAt)}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Last Logout</div><div className="mt-1 font-medium text-slate-900">{formatDateTime(teamUser.lastLogout || teamUser.lastLogoutAt || teamUser.logoutAt)}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Access Expiry Date</div><div className="mt-1 font-medium text-slate-900">{formatDateTime(accessExpiryValue(teamUser))}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Must Change Password</div><div className="mt-1 font-medium text-slate-900">{mustChangePassword ? 'Yes' : 'No'}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Created At</div><div className="mt-1 font-medium text-slate-900">{formatDateTime(teamUser.createdAt)}</div></div>
                            <div><div className="text-xs font-semibold uppercase text-slate-500">Updated At</div><div className="mt-1 font-medium text-slate-900">{formatDateTime(teamUser.updatedAt)}</div></div>
                            {!founder ? (
                              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm xl:col-span-4">
                                <div className="text-xs font-semibold uppercase text-rose-800">Danger Zone</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {isFounder ? <button type="button" disabled={!id || busy || isArchivedStaff(teamUser)} onClick={() => openMarkTestModal(teamUser)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Mark as Test / Unwanted</button> : null}
                                  {testAccount ? <button type="button" disabled={!canDeleteTestAccounts || actionDisabled} onClick={() => openDeleteTestModal(teamUser)} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">Delete Test Account</button> : null}
                                </div>
                              </div>
                            ) : null}
                            {founder ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800 xl:col-span-2">Founder account is protected. Manage from Founder My Account / Safe Zone.</div> : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isFounder && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">You can view staff, but only a founder can create, activate, suspend, reset, or change team access.</div>}
      </SectionCard>

      <SectionCard title="Access Audit Summary">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2 text-sm text-slate-700">{['Founder protection verified', 'Access Matrix uses module keys', 'Staff Access Control saves individual module and special-right grants'].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{item}</div>)}</div>
          <div className="space-y-2 text-sm text-slate-700">{['Founder session protected from suspension or forced reset by other users', 'Staff sessions remain Founder/Admin permission controlled', 'Logout All Devices revokes staff sessions through admin API'].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{item}</div>)}</div>
          <div className="space-y-3 text-sm text-slate-700"><input type="date" value={createForm.expiresAt} onChange={(e) => setCreateForm((state) => ({ ...state, expiresAt: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /><div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Account expiry is sent when creating a staff account and must be enforced by the backend API.</div></div>
        </div>
      </SectionCard>
      </div>) : null}
    </div>
  );
}
