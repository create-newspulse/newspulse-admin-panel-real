import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  activateUser,
  createTeamRole,
  createTeamUser,
  getTeamRoles,
  forceResetUser,
  getTeamUsers,
  logoutAll,
  saveStaffAccessOverride,
  suspendUser,
  toFriendlyErrorMessage,
  updateTeamRole,
  type TeamUser,
  type TeamRole,
} from '@/api/adminPanelSettingsApi';
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

const FOUNDER_EMAIL = 'newspulse.team@gmail.com';
const FOUNDER_NAME = 'News Pulse Founder';

type BadgeTone = 'full' | 'protected' | 'editorial' | 'desk' | 'field' | 'live' | 'technical' | 'revenue' | 'finance' | 'growth' | 'limited';
type RoleBadge = { label: string; tone: BadgeTone };
type StatusTone = 'emerald' | 'amber' | 'rose' | 'sky' | 'slate' | 'blue';
type RoleConfig = {
  id: string;
  label: string;
  description: string;
  permissions: string[];
  badges: RoleBadge[];
  protected?: boolean;
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

function toggleValue<T extends string>(values: T[], value: T, checked: boolean): T[] {
  if (checked) return Array.from(new Set([...values, value]));
  return values.filter((item) => item !== value);
}

function defaultModulesForRole(role?: string): AdminModuleKey[] {
  return getDefaultRoleAccess(role)?.modules || ['dashboard'];
}

function defaultRightsForRole(role?: string): SpecialRightKey[] {
  return getDefaultRoleAccess(role)?.specialRights || [];
}

function roleLabel(role?: string) {
  const normalized = normalizeRoleId(role);
  return DEFAULT_ROLE_ACCESS.find((item) => item.id === normalized)?.label || roleById(role)?.label || String(role || 'Staff');
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function labelFromStatus(value?: unknown, fallback = '-'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.split(/[\s_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

function statusTone(value?: unknown): StatusTone {
  const status = String(value || '').trim().toLowerCase();
  if (['active', 'online', 'present', 'approved'].includes(status)) return 'emerald';
  if (['idle', 'late', 'half day', 'half_day', 'pending'].includes(status)) return 'amber';
  if (['on break', 'on_break'].includes(status)) return 'sky';
  if (['on leave', 'on_leave', 'off day', 'off_day'].includes(status)) return 'blue';
  if (['suspended', 'locked', 'expired', 'absent', 'rejected'].includes(status)) return 'rose';
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
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[tone || statusTone(label)]}`}>{label}</span>;
}

function accountStatusFor(teamUser: TeamUser, active: boolean): 'Active' | 'Suspended' | 'Locked' | 'Expired' {
  const status = String(teamUser?.accountStatus || teamUser?.status || '').trim().toLowerCase();
  const expiry = String(teamUser?.accessExpiresAt || teamUser?.expiresAt || '').trim();
  if (expiry) {
    const expiryDate = new Date(expiry);
    if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now()) return 'Expired';
  }
  if (status === 'locked') return 'Locked';
  if (status === 'expired') return 'Expired';
  if (!active || ['suspended', 'inactive', 'disabled'].includes(status)) return 'Suspended';
  return 'Active';
}

function onlineStatusFor(teamUser: TeamUser): 'Online' | 'Idle' | 'Offline' | 'On Break' {
  const status = String(teamUser?.onlineStatus || teamUser?.presenceStatus || teamUser?.sessionStatus || '').trim().toLowerCase();
  if (['online', 'idle', 'offline'].includes(status)) return labelFromStatus(status) as 'Online' | 'Idle' | 'Offline';
  if (status === 'on_break' || status === 'on break') return 'On Break';
  if (teamUser?.onBreak === true) return 'On Break';
  return 'Offline';
}

function attendanceStatusFor(teamUser: TeamUser): 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Off Day' {
  const status = String(teamUser?.attendanceStatus || teamUser?.todayAttendance?.status || teamUser?.todayAttendanceStatus || '').trim().toLowerCase();
  if (status === 'present') return 'Present';
  if (status === 'late') return 'Late';
  if (status === 'half_day' || status === 'half day') return 'Half Day';
  if (status === 'on_leave' || status === 'on leave') return 'On Leave';
  if (status === 'off_day' || status === 'off day') return 'Off Day';
  return 'Absent';
}

function breakStatusFor(teamUser: TeamUser): string {
  const status = String(teamUser?.breakStatus || teamUser?.todayAttendance?.breakStatus || '').trim();
  if (status) return labelFromStatus(status);
  return teamUser?.onBreak === true ? 'On Break' : 'Not On Break';
}

function shiftFor(teamUser: TeamUser): string {
  const schedule = teamUser?.schedule || teamUser?.todaySchedule || teamUser?.shift;
  if (typeof schedule === 'string' && schedule.trim()) return schedule;
  const start = schedule?.startTime || teamUser?.shiftStart || teamUser?.scheduleStart;
  const end = schedule?.endTime || teamUser?.shiftEnd || teamUser?.scheduleEnd;
  const offDay = schedule?.weeklyOffDay || teamUser?.weeklyOffDay;
  const range = [start, end].filter(Boolean).join(' - ');
  return [range, offDay ? `Off: ${offDay}` : ''].filter(Boolean).join(' · ') || '-';
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

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    staffId: '',
    role: 'editor',
    designation: '',
    department: '',
    assignedSections: '',
    accountStatus: 'active',
    permissions: '',
    expiresAt: '',
    generateTemporaryPassword: true,
    mustChangePassword: true,
  });
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
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  const selectedRole = useMemo(() => roleById(createForm.role) || roleById('editor'), [createForm.role]);
  const draftStaffId = useMemo(() => {
    if (createForm.staffId.trim()) return createForm.staffId.trim();
    const seed = createForm.email || createForm.name || 'backend-generated';
    const compact = seed.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
    return compact ? `NP-${compact}` : 'Backend-generated';
  }, [createForm.email, createForm.name, createForm.staffId]);

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
    setLoading(true);
    setErr(null);
    try {
      const [list, roleList] = await Promise.all([
        getTeamUsers(),
        getTeamRoles().catch(() => [] as TeamRole[]),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setRoles(Array.isArray(roleList) ? roleList : []);
    } catch (e: any) {
      setItems([]);
      setErr(toFriendlyErrorMessage(e, 'Failed to load staff.'));
    } finally {
      setLoading(false);
    }
  }

  const parsePermissions = () => {
    const manual = createForm.permissions.split(',').map((item) => item.trim()).filter(Boolean);
    return manual.length ? manual : selectedRole?.permissions || [];
  };

  const userId = (teamUser: TeamUser) => String(teamUser?._id || teamUser?.id || '');
  const isUserActive = (teamUser: TeamUser): boolean => {
    if (typeof teamUser?.isActive === 'boolean') return teamUser.isActive;
    const status = String(teamUser?.status || '').toLowerCase();
    if (status === 'suspended' || status === 'inactive' || status === 'disabled') return false;
    return true;
  };
  const isFounderUser = (teamUser: TeamUser): boolean => {
    const normalizedRole = String(teamUser?.role || '').toLowerCase();
    const normalizedEmail = String(teamUser?.email || '').trim().toLowerCase();
    return normalizedRole === 'founder' || normalizedEmail === FOUNDER_EMAIL;
  };

  const founderRow = useMemo<TeamUser>(() => {
    const existing = items.find(isFounderUser);
    return { ...(existing || {}), name: FOUNDER_NAME, email: FOUNDER_EMAIL, role: 'founder', isActive: true, status: 'active' };
  }, [items]);
  const teamRows = useMemo(() => [founderRow, ...items.filter((item) => !isFounderUser(item))], [founderRow, items]);

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
    if (createForm.role === 'founder') {
      toast.error('Founder role is protected and cannot be assigned from invites.');
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
    setCreating(true);
    try {
      const res: any = await createTeamUser({
        email,
        name,
        staffId: draftStaffId,
        role: createForm.role,
        designation: createForm.designation.trim() || undefined,
        permissions: parsePermissions(),
        moduleAccess: defaultModulesForRole(createForm.role),
        specialRights: defaultRightsForRole(createForm.role),
        department: createForm.department.trim() || undefined,
        assignedSections: createForm.assignedSections.split(',').map((item) => item.trim()).filter(Boolean),
        status: createForm.accountStatus,
        accessExpiresAt: createForm.expiresAt || undefined,
        generateTemporaryPassword: createForm.generateTemporaryPassword,
        mustChangePassword: createForm.mustChangePassword,
      } as any);
      const tempPassword = res?.temporaryPassword || res?.tempPassword || res?.password || res?.data?.temporaryPassword || res?.data?.tempPassword || res?.data?.password || null;
      setCreatedTempPassword(tempPassword ? String(tempPassword) : null);
      setCreatedEmail(email);
      toast.success('Team member invited');
      setCreateForm({ name: '', email: '', staffId: '', role: 'editor', designation: '', department: '', assignedSections: '', accountStatus: 'active', permissions: '', expiresAt: '', generateTemporaryPassword: true, mustChangePassword: true });
      await fetchStaff();
    } catch (err2: any) {
      toast.error(toFriendlyErrorMessage(err2, 'Create failed'));
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
      toast.error(toFriendlyErrorMessage(err2, 'Save role failed'));
    } finally {
      setSavingRole(false);
    }
  };

  const runRowAction = async (id: string, action: () => Promise<any>, label: string) => {
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    if (!id) return;
    setRowBusyId(id);
    try {
      await action();
      toast.success(label);
      await fetchStaff();
    } catch (err2: any) {
      toast.error(toFriendlyErrorMessage(err2, 'Action failed'));
    } finally {
      setRowBusyId(null);
    }
  };

  const captureTemporaryPassword = (res: any, fallbackEmail?: string) => {
    const tempPassword = res?.temporaryPassword || res?.tempPassword || res?.password || res?.data?.temporaryPassword || res?.data?.tempPassword || res?.data?.password || null;
    if (tempPassword) {
      setCreatedTempPassword(String(tempPassword));
      setCreatedEmail(fallbackEmail || res?.email || res?.data?.email || null);
    }
  };

  const runPasswordReset = async (teamUser: TeamUser, label: string) => {
    const id = userId(teamUser);
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    if (!id || isFounderUser(teamUser)) return;
    setRowBusyId(id);
    try {
      const res = await forceResetUser(id);
      captureTemporaryPassword(res, teamUser.email);
      toast.success(label);
      await fetchStaff();
    } catch (err2: any) {
      toast.error(toFriendlyErrorMessage(err2, 'Password reset failed'));
    } finally {
      setRowBusyId(null);
    }
  };

  const runLogoutAllDevices = async (teamUser: TeamUser) => {
    const id = userId(teamUser);
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    if (!id || isFounderUser(teamUser)) return;
    setRowBusyId(id);
    try {
      await logoutAll(id);
      toast.success('All devices logged out');
    } catch (err2: any) {
      toast.error(toFriendlyErrorMessage(err2, 'Logout all devices failed'));
    } finally {
      setRowBusyId(null);
    }
  };

  const saveOverride = async (teamUser: TeamUser) => {
    const id = userId(teamUser);
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    if (!id || isFounderUser(teamUser)) return;
    const draft = overrideDrafts[id] || { moduleAccess: getEffectiveModuleAccess(teamUser), specialRights: getEffectiveSpecialRights(teamUser) };
    setSavingOverrideId(id);
    try {
      await saveStaffAccessOverride(id, draft);
      toast.success('Staff access override saved');
      await fetchStaff();
    } catch (err2: any) {
      toast.error(toFriendlyErrorMessage(err2, 'Save override failed'));
    } finally {
      setSavingOverrideId(null);
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Team Management</div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Founder protection, staff accounts, roles, access control, password safety, and attendance planning.</div>
            {!isFounder && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Access denied: founder-only controls are disabled.</div>}
          </div>
          <button type="button" onClick={fetchStaff} disabled={loading} className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {createdEmail && createdTempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="temporary-password-title">
          <div className="w-full max-w-lg rounded-2xl border border-amber-300 bg-white p-5 text-slate-950 shadow-2xl">
            <div id="temporary-password-title" className="text-lg font-semibold">Temporary Password</div>
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Temporary password is visible only once. Copy it now. It will not be shown again.</div>
            <div className="mt-3 text-sm">For: <span className="font-semibold">{createdEmail}</span></div>
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
              <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100" onClick={() => { setCreatedTempPassword(null); setCreatedEmail(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className={fieldLabelClass}>Full Name<input value={createForm.name} onChange={(e) => setCreateForm((state) => ({ ...state, name: e.target.value }))} placeholder="Full Name" className={inputClass} /></label>
            <label className={fieldLabelClass}>Email / Login ID<input value={createForm.email} onChange={(e) => setCreateForm((state) => ({ ...state, email: e.target.value }))} placeholder="Email / Login ID" className={inputClass} /></label>
            <label className={fieldLabelClass}>Staff ID<input value={createForm.staffId} onChange={(e) => setCreateForm((state) => ({ ...state, staffId: e.target.value }))} placeholder={`Staff ID (${draftStaffId})`} aria-label="Staff ID" className={inputClass} /></label>
            <label className={fieldLabelClass}>Role<select value={createForm.role} onChange={(e) => setCreateForm((state) => ({ ...state, role: e.target.value }))} className={inputClass}>
              {roleOptions.map((roleItem) => <option key={roleItem.id} value={roleItem.id} disabled={roleItem.protected}>{roleItem.label}{roleItem.protected ? ' (protected)' : ''}</option>)}
            </select></label>
            <label className={fieldLabelClass}>Department<input value={createForm.department} onChange={(e) => setCreateForm((state) => ({ ...state, department: e.target.value }))} placeholder="Department" className={inputClass} /></label>
            <label className={fieldLabelClass}>Assigned Sections<input value={createForm.assignedSections} onChange={(e) => setCreateForm((state) => ({ ...state, assignedSections: e.target.value }))} placeholder="Assigned Sections" className={inputClass} /></label>
            <label className={fieldLabelClass}>Account Status<select value={createForm.accountStatus} onChange={(e) => setCreateForm((state) => ({ ...state, accountStatus: e.target.value }))} className={inputClass}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="locked">Locked</option>
            </select></label>
            <label className={fieldLabelClass}>Access Expiry Date<input type="date" value={createForm.expiresAt} onChange={(e) => setCreateForm((state) => ({ ...state, expiresAt: e.target.value }))} className={inputClass} /></label>
            <label className={fieldLabelClass}>Designation<input value={createForm.designation} onChange={(e) => setCreateForm((state) => ({ ...state, designation: e.target.value }))} placeholder="Designation" className={inputClass} /></label>
          </div>
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

      <SectionCard title="Create / Manage Roles" subtitle="Create custom roles, set display rank, and grant module access or special rights.">
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

      <SectionCard title="Role Access Control" subtitle="Review default modules and special rights for system and custom roles.">
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

      <SectionCard title="Story Writing Rights">
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

      <SectionCard title="Live TV Access Control">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <div className="text-base font-semibold">Live TV Access Control</div>
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

      <SectionCard title="Staff Access Override">
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
                    <div className="mt-1 text-xs text-slate-600">{teamUser.email || '-'} {teamUser.staffId ? `· ${teamUser.staffId}` : ''}</div>
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
        subtitle="Track online status, login/logout, attendance, breaks, off days, leave, and schedules."
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

      <SectionCard title="Staff List" subtitle="Account Status is account access. Online Status is live presence.">
        {loading ? <div className="text-slate-600">Loading...</div> : err ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">{err} Showing the protected founder account view below.</div> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-slate-600"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email / Login ID</th><th className="py-2 pr-3">Staff ID</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Account Status</th><th className="py-2 pr-3">Online Status</th><th className="py-2 pr-3">Last Login</th><th className="py-2 pr-3">Last Logout</th><th className="py-2 pr-3">Actions</th></tr></thead>
            <tbody>
              {teamRows.map((teamUser) => {
                const id = userId(teamUser);
                const founder = isFounderUser(teamUser);
                const active = founder || isUserActive(teamUser);
                const accountStatus = founder ? 'Active' : accountStatusFor(teamUser, active);
                const onlineStatus = onlineStatusFor(teamUser);
                const busy = rowBusyId === id;
                const rowRole = founder ? roleById('founder') : roleById(teamUser.role);
                const rowBadges = founder ? [badge('Founder', 'protected'), ...(rowRole?.badges || [])] : rowRole?.badges || [badge('Limited', 'limited')];
                return (
                  <tr key={id || `${teamUser.email}-${teamUser.name}`} className="border-t border-slate-200 align-top">
                    <td className="py-3 pr-3 font-medium text-slate-900">{teamUser.name || (founder ? FOUNDER_NAME : 'Unnamed staff')}</td>
                    <td className="py-3 pr-3 text-slate-700">{teamUser.email || (founder ? FOUNDER_EMAIL : '-')}</td>
                    <td className="py-3 pr-3 text-slate-700">{teamUser.staffId || (founder ? 'FOUNDER' : '-')}</td>
                    <td className="py-3 pr-3"><div className="font-semibold text-slate-900">{rowRole?.label || teamUser.role || 'Staff'}</div><div className="mt-1 flex flex-wrap gap-1.5">{rowBadges.map((roleBadge) => <BadgePill key={roleBadge.label} badge={roleBadge} />)}</div></td>
                    <td className="py-3 pr-3"><StatusPill label={accountStatus} /></td>
                    <td className="py-3 pr-3"><StatusPill label={onlineStatus} /></td>
                    <td className="py-3 pr-3 text-slate-700">{formatDateTime(teamUser.lastLogin || teamUser.lastLoginAt || teamUser.loginAt)}</td>
                    <td className="py-3 pr-3 text-slate-700">{formatDateTime(teamUser.lastLogout || teamUser.lastLogoutAt || teamUser.logoutAt)}</td>
                    <td className="py-3 pr-3">
                      {founder ? (
                        <div className="flex flex-wrap gap-2">
                          {['Generate Temporary Password Disabled', 'Reset Password Disabled', 'Force Change Password Disabled', 'Suspend Account Disabled', 'Lock Account Disabled', 'Logout All Devices Disabled'].map((label) => (
                            <button key={label} type="button" disabled className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">{label}</button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={!isFounder || !id || busy} onClick={() => runPasswordReset(teamUser, 'Temporary password generated')} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Generate Temporary Password</button>
                          <button type="button" disabled={!isFounder || !id || busy} onClick={() => runPasswordReset(teamUser, 'Password reset')} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Reset Password</button>
                          <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">Force Change Password</button>
                          <button type="button" disabled={!isFounder || !id || busy || !active} onClick={() => runRowAction(id, () => suspendUser(id), 'Account suspended')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Suspend Account</button>
                          <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">Lock Account</button>
                          <button type="button" disabled={!isFounder || !id || busy} onClick={() => runLogoutAllDevices(teamUser)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Logout All Devices</button>
                          {!active && <button type="button" disabled={!isFounder || !id || busy} onClick={() => runRowAction(id, () => activateUser(id), 'Account activated')} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">Activate Account</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isFounder && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">You can view staff, but only a founder can create, activate, suspend, reset, or change team access.</div>}
      </SectionCard>

      <SectionCard title="Access Audit Summary">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2 text-sm text-slate-700">{['Founder protection verified', 'Role access control uses module keys', 'Staff override saves individual module and special-right grants'].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{item}</div>)}</div>
          <div className="space-y-2 text-sm text-slate-700">{['Founder session protected from suspension or forced reset by other users', 'Staff sessions remain Founder/Admin permission controlled', 'Logout All Devices revokes staff sessions through admin API'].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{item}</div>)}</div>
          <div className="space-y-3 text-sm text-slate-700"><input type="date" value={createForm.expiresAt} onChange={(e) => setCreateForm((state) => ({ ...state, expiresAt: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /><div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Account expiry is sent when creating a staff account and must be enforced by the backend API.</div></div>
        </div>
      </SectionCard>
    </div>
  );
}
