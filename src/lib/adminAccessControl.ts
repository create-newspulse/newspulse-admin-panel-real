import type { AdminFeatureVisibilityState } from '@/lib/adminFeatureVisibility';
import {
  DEFAULT_ADMIN_MODULE_POLICY,
  denialMessageForReason,
  type AdminAccessReasonCode,
  type AdminEffectiveModuleAccess,
  type AdminModulePolicyState,
  type AdminModulePolicyMap,
} from '@/lib/adminModulePolicy';

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
  | 'marketing'
  | 'compliance_reports'
  | 'dpdp_privacy_requests'
  | 'ai_engine'
  | 'settings'
  | 'safe_zone'
  | 'staff_tasks'
  | 'audit_logs'
  | 'team_management';

export type SpecialRightKey =
  | 'can_create_news'
  | 'can_edit_news'
  | 'can_submit_news'
  | 'can_publish_news'
  | 'can_schedule_news'
  | 'can_delete_news'
  | 'can_approve_news'
  | 'can_reject_or_send_back_news'
  | 'can_pin_breaking_news'
  | 'can_restore_news'
  | 'can_prepare_live_tv'
  | 'can_edit_live_tv_title'
  | 'can_add_stream_link'
  | 'can_update_ticker'
  | 'can_schedule_live_tv'
  | 'can_start_live_tv'
  | 'can_stop_live_tv'
  | 'can_emergency_stop_live_tv'
  | 'can_view_ads'
  | 'can_manage_ad_slots'
  | 'can_manage_sponsor_leads'
  | 'can_manage_campaigns'
  | 'can_view_ad_analytics'
  | 'media_kit_view'
  | 'media_kit_manage'
  | 'analytics.view_traffic'
  | 'analytics.view_ad_performance'
  | 'analytics.view_revenue'
  | 'analytics.refresh'
  | 'analytics.export'
  | 'can_submit_sponsor_request_for_approval'
  | 'view_marketing'
  | 'view_advertisers'
  | 'create_advertiser'
  | 'edit_advertiser'
  | 'manage_contacts'
  | 'log_sales_activity'
  | 'manage_followups'
  | 'view_proposals'
  | 'create_proposal'
  | 'edit_proposal'
  | 'view_partnerships'
  | 'manage_partnerships'
  | 'assign_sales_owner'
  | 'approve_proposal'
  | 'approve_marketing_discount'
  | 'mark_deal_won'
  | 'mark_deal_lost'
  | 'send_to_ads_manager'
  | 'manage_internal_rate_card'
  | 'delete_marketing_record'
  | 'view_audience_growth'
  | 'view_promotions'
  | 'create_promotion'
  | 'edit_promotion'
  | 'manage_promotion_calendar'
  | 'create_utm_links'
  | 'log_promotion_activity'
  | 'view_growth_goals'
  | 'manage_growth_goals'
  | 'manage_utm_presets'
  | 'manage_channel_settings'
  | 'archive_promotion'
  | 'delete_promotion'
  | 'manage_marketing_settings'
  | 'view_marketing_performance'
  | 'view_campaign_performance'
  | 'view_promotion_performance'
  | 'view_renewals'
  | 'manage_renewals'
  | 'create_campaign_report'
  | 'view_growth_performance'
  | 'view_marketing_deal_values'
  | 'approve_campaign_report'
  | 'export_marketing_performance'
  | 'manage_renewal_settings'
  | 'delete_campaign_report'
  | 'delete_renewal_record'
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
  | 'can_manage_dpdp_privacy_requests'
  | 'can_create_task'
  | 'can_assign_task'
  | 'can_edit_task'
  | 'can_update_task_status'
  | 'can_complete_task'
  | 'can_close_task'
  | 'can_delete_task'
  | 'can_view_team_tasks'
  | 'can_manage_department_tasks'
  | 'can_comment_on_task'
  | 'can_escalate_task'
  | 'can_view_staff_details'
  | 'can_edit_staff_basic_details'
  | 'can_change_staff_email'
  | 'can_generate_temporary_password'
  | 'can_force_password_change'
  | 'can_logout_all_devices'
  | 'can_extend_or_reactivate_staff'
  | 'can_suspend_staff_account'
  | 'can_lock_staff_account'
  | 'can_archive_staff'
  | 'can_delete_staff_permanently'
  | 'can_control_founder_account'
  | 'can_grant_account_control_rights'
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
  { key: 'marketing', label: 'Marketing', ownerVisibilityKey: 'marketing' },
  { key: 'compliance_reports', label: 'Compliance Reports', ownerVisibilityKey: 'compliance-reports' },
  { key: 'dpdp_privacy_requests', label: 'DPDP Privacy Requests' },
  { key: 'ai_engine', label: 'AI Engine', ownerVisibilityKey: 'ai-engine' },
  { key: 'settings', label: 'Settings', ownerVisibilityKey: 'settings' },
  { key: 'safe_zone', label: 'Safe Zone' },
  { key: 'staff_tasks', label: 'Staff Tasks' },
  { key: 'audit_logs', label: 'Audit Logs' },
  { key: 'team_management', label: 'Team Management', ownerVisibilityKey: 'settings' },
];

export const SPECIAL_RIGHTS: SpecialRightDefinition[] = [
  { key: 'can_create_news', label: 'Create news' },
  { key: 'can_edit_news', label: 'Edit news' },
  { key: 'can_submit_news', label: 'Submit news' },
  { key: 'can_publish_news', label: 'Can publish news' },
  { key: 'can_schedule_news', label: 'Schedule news' },
  { key: 'can_delete_news', label: 'Can delete news' },
  { key: 'can_approve_news', label: 'Can approve news' },
  { key: 'can_reject_or_send_back_news', label: 'Can reject/send back news' },
  { key: 'can_pin_breaking_news', label: 'Can pin breaking news' },
  { key: 'can_restore_news', label: 'Restore news' },
  { key: 'can_prepare_live_tv', label: 'Can prepare Live TV' },
  { key: 'can_edit_live_tv_title', label: 'Can edit Live TV title' },
  { key: 'can_add_stream_link', label: 'Can add stream link' },
  { key: 'can_update_ticker', label: 'Can update ticker' },
  { key: 'can_schedule_live_tv', label: 'Can schedule Live TV' },
  { key: 'can_start_live_tv', label: 'Can start Live TV' },
  { key: 'can_stop_live_tv', label: 'Can stop Live TV' },
  { key: 'can_emergency_stop_live_tv', label: 'Can emergency stop Live TV' },
  { key: 'can_view_ads', label: 'Can view ads' },
  { key: 'can_manage_ad_slots', label: 'Can manage ad slots' },
  { key: 'can_manage_sponsor_leads', label: 'Can manage sponsor leads' },
  { key: 'can_manage_campaigns', label: 'Can manage campaigns' },
  { key: 'can_view_ad_analytics', label: 'Can view ad analytics' },
  { key: 'media_kit_view', label: 'Media Kit: view' },
  { key: 'media_kit_manage', label: 'Media Kit: manage' },
  { key: 'analytics.view_traffic', label: 'Analytics: view traffic' },
  { key: 'analytics.view_ad_performance', label: 'Analytics: view ad performance' },
  { key: 'analytics.view_revenue', label: 'Analytics: view revenue' },
  { key: 'analytics.refresh', label: 'Analytics: refresh data' },
  { key: 'analytics.export', label: 'Analytics: export data' },
  { key: 'can_submit_sponsor_request_for_approval', label: 'Can submit sponsor request for approval' },
  { key: 'view_marketing', label: 'Marketing: view workspace' },
  { key: 'view_advertisers', label: 'Marketing: view advertisers' },
  { key: 'create_advertiser', label: 'Marketing: create advertiser' },
  { key: 'edit_advertiser', label: 'Marketing: edit advertiser' },
  { key: 'manage_contacts', label: 'Marketing: manage contacts' },
  { key: 'log_sales_activity', label: 'Marketing: log sales activity' },
  { key: 'manage_followups', label: 'Marketing: manage follow-ups' },
  { key: 'view_proposals', label: 'Marketing: view proposals' },
  { key: 'create_proposal', label: 'Marketing: create proposal' },
  { key: 'edit_proposal', label: 'Marketing: edit proposal' },
  { key: 'view_partnerships', label: 'Marketing: view partnerships' },
  { key: 'manage_partnerships', label: 'Marketing: manage partnerships' },
  { key: 'assign_sales_owner', label: 'Marketing: assign sales owner' },
  { key: 'approve_proposal', label: 'Marketing: approve proposal' },
  { key: 'approve_marketing_discount', label: 'Marketing: approve discount' },
  { key: 'mark_deal_won', label: 'Marketing: mark deal won' },
  { key: 'mark_deal_lost', label: 'Marketing: mark deal lost' },
  { key: 'send_to_ads_manager', label: 'Marketing: send handoff to Ads Manager' },
  { key: 'manage_internal_rate_card', label: 'Marketing: manage internal rate card' },
  { key: 'delete_marketing_record', label: 'Marketing: delete record' },
  { key: 'view_audience_growth', label: 'Marketing: view audience growth' },
  { key: 'view_promotions', label: 'Marketing: view promotions' },
  { key: 'create_promotion', label: 'Marketing: create promotion' },
  { key: 'edit_promotion', label: 'Marketing: edit promotion' },
  { key: 'manage_promotion_calendar', label: 'Marketing: manage promotion calendar' },
  { key: 'create_utm_links', label: 'Marketing: create UTM links' },
  { key: 'log_promotion_activity', label: 'Marketing: log promotion activity' },
  { key: 'view_growth_goals', label: 'Marketing: view growth goals' },
  { key: 'manage_growth_goals', label: 'Marketing: manage growth goals' },
  { key: 'manage_utm_presets', label: 'Marketing: manage UTM presets' },
  { key: 'manage_channel_settings', label: 'Marketing: manage channel settings' },
  { key: 'archive_promotion', label: 'Marketing: archive promotion' },
  { key: 'delete_promotion', label: 'Marketing: delete promotion' },
  { key: 'manage_marketing_settings', label: 'Marketing: manage settings' },
  { key: 'view_marketing_performance', label: 'Marketing: view performance' },
  { key: 'view_campaign_performance', label: 'Marketing: view campaign performance' },
  { key: 'view_promotion_performance', label: 'Marketing: view promotion performance' },
  { key: 'view_renewals', label: 'Marketing: view renewals' },
  { key: 'manage_renewals', label: 'Marketing: manage renewals' },
  { key: 'create_campaign_report', label: 'Marketing: create campaign report' },
  { key: 'view_growth_performance', label: 'Marketing: view growth performance' },
  { key: 'view_marketing_deal_values', label: 'Marketing: view deal values' },
  { key: 'approve_campaign_report', label: 'Marketing: approve campaign report' },
  { key: 'export_marketing_performance', label: 'Marketing: export performance' },
  { key: 'manage_renewal_settings', label: 'Marketing: manage renewal settings' },
  { key: 'delete_campaign_report', label: 'Marketing: delete campaign report' },
  { key: 'delete_renewal_record', label: 'Marketing: delete renewal record' },
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
  { key: 'can_manage_dpdp_privacy_requests', label: 'Can manage DPDP privacy requests' },
  { key: 'can_create_task', label: 'Can create task' },
  { key: 'can_assign_task', label: 'Can assign task' },
  { key: 'can_edit_task', label: 'Can edit task' },
  { key: 'can_update_task_status', label: 'Can update task status' },
  { key: 'can_complete_task', label: 'Can complete task' },
  { key: 'can_close_task', label: 'Can close task' },
  { key: 'can_delete_task', label: 'Can delete task' },
  { key: 'can_view_team_tasks', label: 'Can view team tasks' },
  { key: 'can_manage_department_tasks', label: 'Can manage department tasks' },
  { key: 'can_comment_on_task', label: 'Can comment on task' },
  { key: 'can_escalate_task', label: 'Can escalate task' },
  { key: 'can_view_staff_details', label: 'Can view staff details' },
  { key: 'can_edit_staff_basic_details', label: 'Can edit staff basic details' },
  { key: 'can_change_staff_email', label: 'Can change staff email/login' },
  { key: 'can_generate_temporary_password', label: 'Can generate temporary password' },
  { key: 'can_force_password_change', label: 'Can force password change' },
  { key: 'can_logout_all_devices', label: 'Can logout all devices' },
  { key: 'can_extend_or_reactivate_staff', label: 'Can extend/reactivate staff' },
  { key: 'can_suspend_staff_account', label: 'Can suspend account' },
  { key: 'can_lock_staff_account', label: 'Can lock account' },
  { key: 'can_archive_staff', label: 'Can archive staff' },
  { key: 'can_delete_staff_permanently', label: 'Can delete staff permanently' },
  { key: 'can_control_founder_account', label: 'Can control Founder account' },
  { key: 'can_grant_account_control_rights', label: 'Can give/remove account-control rights' },
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
const ANALYTICS_TRAFFIC_RIGHTS: SpecialRightKey[] = ['analytics.view_traffic'];
const ANALYTICS_AD_PERFORMANCE_RIGHTS: SpecialRightKey[] = ['analytics.view_ad_performance'];
const ANALYTICS_REVENUE_RIGHTS: SpecialRightKey[] = ['analytics.view_revenue'];
const ADS_GROWTH_RIGHTS: SpecialRightKey[] = ['can_view_ads', 'can_manage_ad_slots', 'can_manage_sponsor_leads', 'can_manage_campaigns', 'can_view_ad_analytics', 'media_kit_view', 'media_kit_manage', 'can_submit_sponsor_request_for_approval', ...ANALYTICS_TRAFFIC_RIGHTS, ...ANALYTICS_AD_PERFORMANCE_RIGHTS];
const FINANCE_OPERATIONS_RIGHTS: SpecialRightKey[] = ['can_view_finance', 'can_create_invoice', 'can_update_invoice_status', 'can_add_revenue_entry', 'can_add_expense_entry', 'can_upload_receipt', 'can_prepare_monthly_finance_report', 'can_export_finance_summary', 'can_view_sponsor_payment_status', ...ANALYTICS_REVENUE_RIGHTS];
const FOUNDER_ONLY_FINANCE_RIGHTS: SpecialRightKey[] = ['can_approve_payment', 'can_delete_finance_record', 'can_change_bank_details', 'can_change_payment_gateway', 'can_approve_withdrawal', 'can_approve_final_finance_report'];
const FOUNDER_ONLY_DPDP_RIGHTS: SpecialRightKey[] = ['can_manage_dpdp_privacy_requests'];
const FOUNDER_ONLY_MARKETING_RIGHTS: SpecialRightKey[] = ['view_marketing_deal_values', 'approve_campaign_report', 'export_marketing_performance', 'manage_renewal_settings', 'delete_campaign_report', 'delete_renewal_record'];

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
    description: 'Senior admin for newsroom operations, publishing support, analytics, and staff coordination. Safe Zone and Team Management require explicit Founder grant.',
    systemRole: true,
    modules: ALL_MODULE_KEYS.filter((key) => key !== 'safe_zone' && key !== 'team_management' && key !== 'dpdp_privacy_requests'),
    specialRights: ALL_SPECIAL_RIGHT_KEYS.filter((key) => !['can_access_safe_zone', 'can_use_emergency_lock', 'can_delete_roles', ...FOUNDER_ONLY_FINANCE_RIGHTS, ...FOUNDER_ONLY_DPDP_RIGHTS, ...FOUNDER_ONLY_MARKETING_RIGHTS].includes(key)),
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
    specialRights: ['can_approve_news', 'can_reject_or_send_back_news', ...ANALYTICS_TRAFFIC_RIGHTS],
  },
  {
    id: 'editor',
    label: 'Editor',
    description: 'Editorial review role for writing, editing, approving, rejecting, and sending stories back.',
    systemRole: true,
    modules: [...REVIEW_MODULES, 'analytics'],
    specialRights: ['can_approve_news', 'can_reject_or_send_back_news', 'can_pin_breaking_news', ...ANALYTICS_TRAFFIC_RIGHTS],
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
    specialRights: ['can_prepare_live_tv', 'can_edit_live_tv_title', 'can_add_stream_link', 'can_update_ticker', 'can_schedule_live_tv'],
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
    specialRights: ['can_pin_breaking_news', 'can_view_ad_analytics', ...ANALYTICS_TRAFFIC_RIGHTS],
  },
  {
    id: 'tech_support',
    label: 'Tech Support',
    description: 'Technical support role for diagnostics, login support, audit-assisted troubleshooting, and account help.',
    systemRole: true,
    modules: ['dashboard', 'settings'],
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
  const raw = firstArray(
    user?.moduleAccess,
    user?.moduleAccessKeys,
    user?.modules,
    user?.access?.modules,
    user?.accessControl?.modules,
  );
  return normalizeModuleKeys(raw);
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
  const overrides = getOverrideModules(user);
  const denied = new Set(overrides.deny);
  return Array.from(new Set([...explicit, ...overrides.allow])).filter((key) => !denied.has(key));
}

export function getEffectiveSpecialRights(user: any): SpecialRightKey[] {
  const roleId = normalizeRoleId(user?.role);
  if (roleId === 'founder') return ALL_SPECIAL_RIGHT_KEYS;
  const explicitRaw = firstArray(
    user?.specialRights,
    user?.rights,
    user?.access?.specialRights,
    user?.accessControl?.specialRights,
  );
  const explicit = normalizeSpecialRightKeys(explicitRaw);
  const overrides = user?.accessOverrides || user?.individualOverrides || user?.overrides || {};
  const allow = normalizeSpecialRightKeys(firstArray(overrides?.specialRights, overrides?.allowSpecialRights, overrides?.rightsAllow));
  const deny = new Set(normalizeSpecialRightKeys(firstArray(overrides?.denySpecialRights, overrides?.rightsDeny, overrides?.blockedSpecialRights)));
  return Array.from(new Set([...explicit, ...allow])).filter((key) => !deny.has(key));
}

export function canAccessAdminModule(user: any, moduleKey: AdminModuleKey, visibility?: AdminFeatureVisibilityState): boolean {
  return resolveAdminModuleAccess(user, moduleKey, { legacyVisibility: visibility }).allowed;
}

export function canAccessAnyAdminModule(user: any, moduleKeys: AdminModuleKey[], visibility?: AdminFeatureVisibilityState): boolean {
  return moduleKeys.some((moduleKey) => canAccessAdminModule(user, moduleKey, visibility));
}

type RuntimeIndividualAccess = AdminEffectiveModuleAccess['individualAccess'];

function expiredDate(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function accountStatusReasonCode(accountStatus: unknown, accountExpiry: unknown): AdminAccessReasonCode | null {
  const normalized = String(accountStatus ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'suspended') return 'ACCOUNT_SUSPENDED';
  if (normalized === 'locked') return 'ACCOUNT_LOCKED';
  if (normalized === 'expired' || expiredDate(accountExpiry)) return 'ACCOUNT_EXPIRED';
  return null;
}

function normalizeRuntimeIndividualAccess(value: unknown): RuntimeIndividualAccess {
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'enabled' || normalized === 'temporary' || normalized === 'not_configurable') return normalized;
  return 'disabled';
}

function findTemporaryModuleGrant(user: any, moduleKey: AdminModuleKey): any | undefined {
  const raw = firstArray(user?.temporaryGrants, user?.temporaryPermissions, user?.temporaryAccess, user?.accessOverrides?.temporaryGrants);
  return raw?.find((grant: any) => {
    const targetType = String(grant?.targetType ?? grant?.type ?? 'module').trim().toLowerCase();
    const key = String(grant?.key ?? grant?.module ?? grant?.moduleKey ?? '').trim();
    return targetType === 'module' && key === moduleKey;
  });
}

export function resolveModuleAccess(input: {
  moduleKey: AdminModuleKey;
  isFounder: boolean;
  accountStatus?: unknown;
  accountExpiry?: unknown;
  globalPolicy?: AdminModulePolicyState;
  individualAccess?: RuntimeIndividualAccess | boolean;
  temporaryExpiry?: unknown;
}): AdminEffectiveModuleAccess {
  const moduleKey = input.moduleKey;
  const policyState = input.globalPolicy || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only';
  const individualAccess = moduleKey === 'safe_zone' && !input.isFounder ? 'not_configurable' : normalizeRuntimeIndividualAccess(input.individualAccess);

  let reasonCode: AdminAccessReasonCode = 'ALLOWED';
  if (!input.isFounder) {
    reasonCode = accountStatusReasonCode(input.accountStatus, input.accountExpiry) || 'ALLOWED';
    if (reasonCode === 'ALLOWED') {
      if (policyState === 'hidden') reasonCode = 'HIDDEN';
      else if (policyState === 'founder_only') reasonCode = 'FOUNDER_ONLY';
      else if (policyState === 'staff_locked') reasonCode = 'GLOBAL_STAFF_LOCK';
      else if (individualAccess === 'temporary' && expiredDate(input.temporaryExpiry)) reasonCode = 'TEMPORARY_ACCESS_EXPIRED';
      else if (individualAccess !== 'enabled' && individualAccess !== 'temporary') reasonCode = 'STAFF_ACCESS_DISABLED';
    }
  }

  const allowed = input.isFounder || reasonCode === 'ALLOWED';
  const visible = input.isFounder || policyState !== 'hidden';
  return {
    moduleKey,
    visible,
    allowed,
    locked: !allowed && visible,
    policyState: input.isFounder ? 'available' : policyState,
    reasonCode: allowed ? 'ALLOWED' : reasonCode,
    reason: allowed ? 'Allowed' : denialMessageForReason(reasonCode),
    individualAccess: input.isFounder ? 'enabled' : individualAccess,
    temporary: individualAccess === 'temporary',
  };
}

export function resolveAdminModuleAccess(
  user: any,
  moduleKey: AdminModuleKey,
  options?: { modulePolicy?: AdminModulePolicyMap; legacyVisibility?: AdminFeatureVisibilityState; backendAccess?: Partial<Record<AdminModuleKey, AdminEffectiveModuleAccess>> },
): AdminEffectiveModuleAccess {
  const roleId = normalizeRoleId(user?.role);
  const isFounder = roleId === 'founder';
  const backend = options?.backendAccess?.[moduleKey];
  const isFixedStaffControl = moduleKey === 'dashboard';

  if (backend && !isFixedStaffControl) {
    return {
      ...backend,
      locked: !backend.allowed && backend.visible,
      reason: backend.allowed ? 'Allowed' : backend.reason || denialMessageForReason(backend.reasonCode),
    };
  }

  const policy = options?.modulePolicy || DEFAULT_ADMIN_MODULE_POLICY;
  const definition = ADMIN_MODULES.find((item) => item.key === moduleKey);
  const legacyHidden = definition?.ownerVisibilityKey && options?.legacyVisibility?.[definition.ownerVisibilityKey] === false;
  const policyState = legacyHidden ? 'hidden' : (policy[moduleKey]?.state || backend?.policyState || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only');
  const temporaryGrant = findTemporaryModuleGrant(user, moduleKey);
  const savedAccess = getEffectiveModuleAccess(user).includes(moduleKey);
  const individualAccess = isFixedStaffControl ? 'enabled' : backend?.individualAccess || (temporaryGrant ? 'temporary' : savedAccess ? 'enabled' : 'disabled');

  return resolveModuleAccess({
    moduleKey,
    isFounder,
    accountStatus: user?.accountStatus ?? user?.status,
    accountExpiry: user?.accessExpiresAt ?? user?.accessExpiryDate ?? user?.accessEndDate,
    globalPolicy: policyState,
    individualAccess,
    temporaryExpiry: (backend as any)?.expiresAt ?? temporaryGrant?.expiresAt ?? temporaryGrant?.accessExpiryDate ?? temporaryGrant?.expiryDate,
  });
}

export function resolveAnyAdminModuleAccess(
  user: any,
  moduleKeys: AdminModuleKey[],
  options?: { modulePolicy?: AdminModulePolicyMap; legacyVisibility?: AdminFeatureVisibilityState; backendAccess?: Partial<Record<AdminModuleKey, AdminEffectiveModuleAccess>> },
): AdminEffectiveModuleAccess {
  const results = moduleKeys.map((moduleKey) => resolveAdminModuleAccess(user, moduleKey, options));
  return results.find((item) => item.allowed) || results.find((item) => item.visible) || results[0];
}