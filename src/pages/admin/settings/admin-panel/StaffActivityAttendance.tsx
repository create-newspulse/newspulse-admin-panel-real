import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import {
  approveLeaveRequest,
  attendanceBreakEnd,
  attendanceBreakStart,
  attendanceCheckIn,
  attendanceCheckOut,
  createSchedule,
  getAttendanceReport,
  getAttendanceToday,
  getLeaveRequests,
  getSchedules,
  getTeamPresence,
  getTeamSessionLogs,
  rejectLeaveRequest,
  requestLeave,
  toFriendlyErrorMessage,
  type AttendanceRecord,
  type LeaveRequestRow,
  type ScheduleRow,
  type TeamPresenceRow,
  type TeamSessionLog,
  type TeamUser,
} from '@/api/adminPanelSettingsApi';

type Props = {
  teamRows?: TeamUser[];
};

type ActivityTab = 'activity' | 'attendance' | 'breaks' | 'leave' | 'schedule' | 'reports';
type LoadState = 'idle' | 'loading' | 'ready' | 'offline';
type BadgeTone = 'emerald' | 'amber' | 'rose' | 'sky' | 'slate' | 'blue' | 'violet';
type SessionStatusLabel = 'Active Session' | 'No Active Session' | 'Logged Out' | 'Session Expired';

const ACCESS_DENIED = 'Access Denied\n\nYou do not have permission to view staff activity or attendance.\nFounder permission is required.';

const tabLabels: Record<ActivityTab, string> = {
  activity: 'Staff Activity',
  attendance: 'Attendance',
  breaks: 'Break',
  leave: 'Leave / Off Days',
  schedule: 'Schedule',
  reports: 'Reports',
};

const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRIMARY_FOUNDER_EMAIL = 'newspulse.team@gmail.com';
const PRIMARY_FOUNDER_NAME = 'NewsPulse Founder';
const PRIMARY_FOUNDER_STAFF_ID = 'NP-FND-0001';
const LEGACY_FOUNDER_EMAILS = new Set(['owner@newspulse.co.in', 'admin@newspulse.ai', 'founder@newspulse.ai']);

function normalize(value?: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isPrimaryFounderEmail(email?: unknown): boolean {
  return normalize(email) === PRIMARY_FOUNDER_EMAIL;
}

function isFounderLikeRow(row: { role?: string; email?: string; name?: string }): boolean {
  const normalizedRole = normalize(row.role);
  const normalizedEmail = normalize(row.email);
  const normalizedName = normalize(row.name);
  return normalizedRole === 'founder' || normalizedRole === 'owner' || normalizedEmail === PRIMARY_FOUNDER_EMAIL || LEGACY_FOUNDER_EMAILS.has(normalizedEmail) || normalizedName === 'founder admin';
}

function shouldRenderActivityRow(row: { role?: string; email?: string; name?: string }): boolean {
  if (!isFounderLikeRow(row)) return true;
  return isPrimaryFounderEmail(row.email);
}

function userKey(row?: { userId?: string; id?: string; _id?: string; email?: string; staffId?: string } | null): string {
  return normalize(row?.userId || row?.id || row?._id || row?.email || row?.staffId);
}

function teamUserKey(row?: TeamUser | null): string {
  return normalize(row?.id || row?._id || row?.email || row?.staffId);
}

function isSamePerson(row: { userId?: string; id?: string; _id?: string; email?: string; staffId?: string }, currentUser: any): boolean {
  const currentKeys = [currentUser?.id, currentUser?._id, currentUser?.email, currentUser?.staffId].map(normalize).filter(Boolean);
  const rowKeys = [row.userId, row.id, row._id, row.email, row.staffId].map(normalize).filter(Boolean);
  return rowKeys.some((key) => currentKeys.includes(key));
}

function hasGrant(user: any): boolean {
  const permissions = [
    ...(Array.isArray(user?.permissions) ? user.permissions : []),
    ...(Array.isArray(user?.specialRights) ? user.specialRights : []),
    ...(Array.isArray(user?.moduleAccess) ? user.moduleAccess : []),
    ...(Array.isArray(user?.accessOverrides?.specialRights) ? user.accessOverrides.specialRights : []),
    ...(Array.isArray(user?.accessOverrides?.modules) ? user.accessOverrides.modules : []),
  ].map(normalize);
  return permissions.some((item) => ['team.view_activity', 'auth.view_login_activity', 'team_management', 'can_view_staff_activity', 'can_manage_attendance'].includes(item));
}

function displayDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function displayText(value?: unknown, fallback = '-'): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function displayStaffId(value?: unknown, founder = false): string {
  if (founder) return PRIMARY_FOUNDER_STAFF_ID;
  const text = String(value || '').trim();
  if (!text || /^np-backend/i.test(text)) return 'Pending ID';
  return text;
}

function valueId(row: { id?: string; _id?: string }): string {
  return String(row.id || row._id || '').trim();
}

function statusLabel(value?: unknown, fallback = 'Pending'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.split(/[_\s-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

function toneForStatus(value?: unknown): BadgeTone {
  const status = normalize(value);
  if (['online', 'present', 'approved', 'active', 'active session'].includes(status)) return 'emerald';
  if (['idle', 'late', 'pending', 'half day', 'half_day'].includes(status)) return 'amber';
  if (['on break', 'on_break'].includes(status)) return 'sky';
  if (['on leave', 'on_leave', 'off day', 'off_day'].includes(status)) return 'blue';
  if (['you'].includes(status)) return 'violet';
  if (['rejected', 'absent', 'suspended', 'locked', 'expired', 'session expired'].includes(status)) return 'rose';
  return 'slate';
}

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: BadgeTone }) {
  const classes: Record<BadgeTone, string> = {
    emerald: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    amber: 'border-amber-200 bg-amber-100 text-amber-800',
    rose: 'border-rose-200 bg-rose-100 text-rose-800',
    sky: 'border-sky-200 bg-sky-100 text-sky-800',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    blue: 'border-blue-200 bg-blue-100 text-blue-800',
    violet: 'border-violet-200 bg-violet-100 text-violet-800',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}

function AccessDenied() {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      {ACCESS_DENIED.split('\n').map((line, index) => (
        <p key={`${line}-${index}`} className={index === 0 ? 'text-base font-semibold' : line ? 'mt-1' : 'mt-3'}>{line}</p>
      ))}
    </div>
  );
}

function BackendOfflineBanner({ loadState }: { loadState: LoadState }) {
  if (loadState !== 'offline') return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      Backend not connected yet. Activity, attendance, leave, and schedule controls are shown safely with unavailable actions disabled.
    </div>
  );
}

function ActionButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
    >
      {children}
    </button>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function matchesCurrentUser(row: { userId?: string; id?: string; _id?: string; email?: string; staffId?: string }, currentUser: any): boolean {
  const rowId = normalize(row.userId || row.id || row._id);
  const currentId = normalize(currentUser?.id || currentUser?._id || currentUser?.userId);
  if (rowId && currentId && rowId === currentId) return true;
  const rowEmail = normalize(row.email);
  const currentEmail = normalize(currentUser?.email);
  return !!rowEmail && !!currentEmail && rowEmail === currentEmail;
}

function getSessionStatusDisplay(row: any, currentUser: any): SessionStatusLabel {
  if (matchesCurrentUser(row, currentUser)) return 'Active Session';
  const rawStatus = normalize(row.sessionStatus || row.authSessionStatus || row.session?.status);
  if (['active', 'active_session', 'authenticated', 'valid'].includes(rawStatus)) return 'Active Session';
  if (['expired', 'session_expired'].includes(rawStatus)) return 'Session Expired';
  if (['logged_out', 'logout', 'signed_out'].includes(rawStatus)) return 'Logged Out';
  const sessionExpiresAt = row.sessionExpiresAt || row.session?.expiresAt;
  if (sessionExpiresAt) {
    const expires = new Date(String(sessionExpiresAt)).getTime();
    if (!Number.isNaN(expires) && expires < Date.now()) return 'Session Expired';
  }
  if (row.hasActiveSession === true || row.activeSession === true || row.session?.active === true) return 'Active Session';
  if (row.lastLogout || row.logoutAt || row.lastLogoutAt) return 'Logged Out';
  return 'No Active Session';
}

export default function StaffActivityAttendance({ teamRows = [] }: Props) {
  const { user } = useAuth();
  const role = normalize(user?.role);
  const canViewAll = role === 'founder' || hasGrant(user);
  const canUseOwn = Boolean(user?.id || user?._id || user?.email);
  const canManage = canViewAll;

  const [activeTab, setActiveTab] = useState<ActivityTab>('activity');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [presence, setPresence] = useState<TeamPresenceRow[]>([]);
  const [sessionLogs, setSessionLogs] = useState<TeamSessionLog[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceRecord[]>([]);
  const [attendanceReport, setAttendanceReport] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [reportRange, setReportRange] = useState('daily');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [breakReason, setBreakReason] = useState('');
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [scheduleForm, setScheduleForm] = useState({ title: '', staffId: '', role: '', startTime: '', endTime: '', weeklyOffDay: 'Sunday', active: true });

  const inferredTeamRows = useMemo<TeamUser[]>(() => {
    if (teamRows.length) return teamRows;
    const byKey = new Map<string, TeamUser>();
    const add = (row: any) => {
      if (!shouldRenderActivityRow(row)) return;
      const key = userKey(row);
      if (!key || byKey.has(key)) return;
      byKey.set(key, {
        id: row.id || row.userId,
        _id: row._id,
        name: isPrimaryFounderEmail(row.email) ? PRIMARY_FOUNDER_NAME : row.name,
        email: isPrimaryFounderEmail(row.email) ? PRIMARY_FOUNDER_EMAIL : row.email,
        staffId: isPrimaryFounderEmail(row.email) ? PRIMARY_FOUNDER_STAFF_ID : row.staffId,
        role: isPrimaryFounderEmail(row.email) ? 'founder' : row.role,
      });
    };
    presence.forEach(add);
    sessionLogs.forEach(add);
    attendanceToday.forEach(add);
    attendanceReport.forEach(add);
    leaveRequests.forEach(add);
    schedules.forEach(add);
    return Array.from(byKey.values());
  }, [attendanceReport, attendanceToday, leaveRequests, presence, schedules, sessionLogs, teamRows]);

  const visibleTeamRows = useMemo(() => {
    if (canViewAll) return inferredTeamRows;
    return inferredTeamRows.filter((row) => isSamePerson(row as any, user));
  }, [canViewAll, inferredTeamRows, user]);

  const filteredPresence = useMemo(() => (canViewAll ? presence : presence.filter((row) => isSamePerson(row, user))).filter(shouldRenderActivityRow), [canViewAll, presence, user]);
  const filteredLogs = useMemo(() => (canViewAll ? sessionLogs : sessionLogs.filter((row) => isSamePerson(row, user))).filter(shouldRenderActivityRow), [canViewAll, sessionLogs, user]);
  const filteredAttendanceToday = useMemo(() => canViewAll ? attendanceToday : attendanceToday.filter((row) => isSamePerson(row, user)), [attendanceToday, canViewAll, user]);
  const filteredAttendanceReport = useMemo(() => canViewAll ? attendanceReport : attendanceReport.filter((row) => isSamePerson(row, user)), [attendanceReport, canViewAll, user]);
  const filteredLeaveRequests = useMemo(() => canViewAll ? leaveRequests : leaveRequests.filter((row) => isSamePerson(row, user)), [canViewAll, leaveRequests, user]);
  const filteredSchedules = useMemo(() => canViewAll ? schedules : schedules.filter((row) => isSamePerson(row, user)), [canViewAll, schedules, user]);

  const activityRows = useMemo(() => {
    const byKey = new Map<string, TeamPresenceRow & TeamSessionLog & TeamUser>();
    visibleTeamRows.forEach((row) => byKey.set(teamUserKey(row), { ...row }));
    filteredPresence.forEach((row) => {
      if (!shouldRenderActivityRow(row)) return;
      const key = userKey(row);
      const normalized = isPrimaryFounderEmail(row.email) ? { ...row, name: PRIMARY_FOUNDER_NAME, email: PRIMARY_FOUNDER_EMAIL, staffId: PRIMARY_FOUNDER_STAFF_ID, role: 'founder' } : row;
      byKey.set(key, { ...(byKey.get(key) || {}), ...normalized });
    });
    filteredLogs.forEach((row) => {
      if (!shouldRenderActivityRow(row)) return;
      const key = userKey(row);
      const normalized = isPrimaryFounderEmail(row.email) ? { ...row, name: PRIMARY_FOUNDER_NAME, email: PRIMARY_FOUNDER_EMAIL, staffId: PRIMARY_FOUNDER_STAFF_ID, role: 'founder' } : row;
      byKey.set(key, { ...(byKey.get(key) || {}), ...normalized });
    });
    return Array.from(byKey.values());
  }, [filteredLogs, filteredPresence, visibleTeamRows]);

  const dashboardCards = useMemo(() => {
    const activeSessions = activityRows.filter((row) => getSessionStatusDisplay(row, user) === 'Active Session').length;
    const noActiveSessions = activityRows.filter((row) => getSessionStatusDisplay(row, user) === 'No Active Session').length;
    const loggedOut = activityRows.filter((row) => getSessionStatusDisplay(row, user) === 'Logged Out').length;
    const presentToday = attendanceToday.filter((row) => normalize(row.attendanceStatus || row.status) === 'present').length;
    const absentToday = attendanceToday.filter((row) => normalize(row.attendanceStatus || row.status) === 'absent').length;
    const lateToday = attendanceToday.filter((row) => normalize(row.attendanceStatus || row.status) === 'late').length;
    const onLeave = attendanceToday.filter((row) => ['on leave', 'on_leave'].includes(normalize(row.attendanceStatus || row.status))).length;
    const offDay = attendanceToday.filter((row) => ['off day', 'off_day'].includes(normalize(row.attendanceStatus || row.status))).length;
    const pendingLeave = leaveRequests.filter((row) => normalize(row.status) === 'pending').length;
    return [
      ['Active Sessions', activeSessions],
      ['No Active Session', noActiveSessions],
      ['Logged Out', loggedOut],
      ['Present Today', presentToday],
      ['Absent Today', absentToday],
      ['Late Today', lateToday],
      ['On Leave', onLeave],
      ['Off Day', offDay],
      ['Pending Leave Requests', pendingLeave],
    ] as const;
  }, [activityRows, attendanceToday, leaveRequests, user]);

  async function loadActivity(range = reportRange) {
    if (!canUseOwn && !canViewAll) return;
    setLoadState('loading');
    const results = await Promise.allSettled([
      getTeamPresence(),
      getTeamSessionLogs(),
      getAttendanceToday(),
      getAttendanceReport(range),
      getLeaveRequests(),
      getSchedules(),
    ]);
    const [presenceResult, logsResult, todayResult, reportResult, leaveResult, scheduleResult] = results;
    if (presenceResult.status === 'fulfilled') setPresence(presenceResult.value);
    if (logsResult.status === 'fulfilled') setSessionLogs(logsResult.value);
    if (todayResult.status === 'fulfilled') setAttendanceToday(todayResult.value);
    if (reportResult.status === 'fulfilled') setAttendanceReport(reportResult.value);
    if (leaveResult.status === 'fulfilled') setLeaveRequests(leaveResult.value);
    if (scheduleResult.status === 'fulfilled') setSchedules(scheduleResult.value);
    const anySuccess = results.some((result) => result.status === 'fulfilled');
    setLoadState(anySuccess ? 'ready' : 'offline');
  }

  useEffect(() => {
    void loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseOwn, canViewAll]);

  const runAction = async (label: string, action: () => Promise<any>) => {
    setActionBusy(label);
    try {
      await action();
      toast.success(label);
      await loadActivity();
    } catch (err: any) {
      toast.error(toFriendlyErrorMessage(err, loadState === 'offline' ? 'Backend not connected yet' : 'Action failed'));
    } finally {
      setActionBusy(null);
    }
  };

  const submitLeave = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      toast.error('Select leave start and end dates.');
      return;
    }
    await runAction('Leave request submitted', () => requestLeave({ ...leaveForm, type: 'leave' }));
    setLeaveForm({ startDate: '', endDate: '', reason: '' });
  };

  const submitSchedule = async () => {
    if (!canManage) return;
    if (!scheduleForm.startTime || !scheduleForm.endTime) {
      toast.error('Enter schedule start and end time.');
      return;
    }
    await runAction('Schedule assigned', () => createSchedule(scheduleForm));
  };

  const renderAccessCheck = (children: ReactNode) => {
    if (!canViewAll && !canUseOwn) return <AccessDenied />;
    return children;
  };

  return (
    <section id="staff-activity-attendance" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-base font-semibold text-slate-950">Staff Activity &amp; Attendance</div>
          <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Track session state, login/logout, attendance, breaks, off days, leave, and schedules.</div>
        </div>
        <button type="button" onClick={() => loadActivity()} disabled={loadState === 'loading'} className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
          {loadState === 'loading' ? 'Refreshing...' : 'Refresh Activity'}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <BackendOfflineBanner loadState={loadState} />
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950">
          Login/logout is for security tracking. Check-in/check-out is for attendance.
        </div>
        {!canViewAll && canUseOwn ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">You can view only your own attendance, schedule, leave, and login/logout records.</div> : null}

        {canViewAll ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {dashboardCards.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {['Session Status', 'Attendance Today', 'Break Status', 'Leave / Off Days', 'Schedule', 'Reports'].map((label) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 shadow-sm">{label}</div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(Object.keys(tabLabels) as ActivityTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${activeTab === tab ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'activity' && renderAccessCheck(
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-slate-600"><th className="py-2 pr-4">Staff</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Session Status</th><th className="py-2 pr-4">Last Seen</th><th className="py-2 pr-4">Last Login</th><th className="py-2 pr-4">Last Logout</th><th className="py-2 pr-4">Device</th><th className="py-2 pr-4">Session Details</th></tr></thead>
                <tbody>
                  {activityRows.map((row) => {
                    const sessionStatus = getSessionStatusDisplay(row, user);
                    const currentUser = matchesCurrentUser(row, user);
                    return (
                      <tr key={userKey(row) || `${row.email}-${row.name}`} className="border-t border-slate-200 align-top">
                        <td className="py-3 pr-4"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950">{displayText(row.name, 'Unnamed staff')}</span>{currentUser ? <Badge tone="violet">You</Badge> : null}</div><div className="mt-1 text-xs text-slate-600">{displayText(row.email)}</div></td>
                        <td className="py-3 pr-4 text-slate-700">{statusLabel(row.role, 'Staff')}</td>
                        <td className="py-3 pr-4"><Badge tone={toneForStatus(sessionStatus)}>{sessionStatus}</Badge></td>
                        <td className="py-3 pr-4 text-slate-700">{displayDateTime(row.lastSeen)}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayDateTime(row.lastLogin || row.loginAt)}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayDateTime(row.lastLogout || row.logoutAt)}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayText([row.device, row.browser].filter(Boolean).join(' / '))}</td>
                        <td className="py-3 pr-4 text-slate-700"><div>{displayText(row.sessionDuration || row.duration, sessionStatus)}</div><div className="mt-1 text-xs text-slate-500">{displayText(row.logoutReason, 'No logout reason')}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!activityRows.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No activity records available yet.</div> : null}
          </div>
        )}

        {activeTab === 'attendance' && renderAccessCheck(
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {['daily', 'weekly', 'monthly'].map((range) => (
                <button key={range} type="button" onClick={() => { setReportRange(range); void loadActivity(range); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${reportRange === range ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{statusLabel(range)}</button>
              ))}
              <ActionButton disabled={loadState === 'offline'}>Export Report</ActionButton>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ActionButton disabled={!canUseOwn || loadState === 'offline' || Boolean(actionBusy)} onClick={() => runAction('Checked in', attendanceCheckIn)}>Check In</ActionButton>
              <ActionButton disabled={!canUseOwn || loadState === 'offline' || Boolean(actionBusy)} onClick={() => runAction('Checked out', attendanceCheckOut)}>Check Out</ActionButton>
              <ActionButton disabled={!canManage || loadState === 'offline'}>Correct Attendance</ActionButton>
              <ActionButton disabled={!canManage || loadState === 'offline'}>Mark Off Day</ActionButton>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-slate-600"><th className="py-2 pr-4">Staff</th><th className="py-2 pr-4">Check In</th><th className="py-2 pr-4">Check Out</th><th className="py-2 pr-4">Total Work Time</th><th className="py-2 pr-4">Break Time</th><th className="py-2 pr-4">Attendance Status</th><th className="py-2 pr-4">Shift</th><th className="py-2 pr-4">Actions</th></tr></thead>
                <tbody>
                  {(filteredAttendanceReport.length ? filteredAttendanceReport : filteredAttendanceToday).map((row) => {
                    const attendanceStatus = row.attendanceStatus || row.status || 'absent';
                    return (
                      <tr key={valueId(row) || `${row.email}-${row.date}`} className="border-t border-slate-200 align-top">
                        <td className="py-3 pr-4"><div className="font-semibold text-slate-950">{displayText(row.name, 'Staff')}</div><div className="mt-1 text-xs text-slate-600">{displayText(row.email || row.staffId)}</div></td>
                        <td className="py-3 pr-4 text-slate-700">{displayDateTime(row.checkInTime || row.checkInAt)}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayDateTime(row.checkOutTime || row.checkOutAt)}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayText(row.totalWorkTime || row.workDuration)}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayText(row.totalBreakTime || row.breakDuration)}</td>
                        <td className="py-3 pr-4"><Badge tone={toneForStatus(attendanceStatus)}>{statusLabel(attendanceStatus, 'Absent')}</Badge></td>
                        <td className="py-3 pr-4 text-slate-700">{displayText(row.shift || row.schedule || row.shiftName)}</td>
                        <td className="py-3 pr-4"><ActionButton disabled={!canManage || loadState === 'offline'}>Correct Attendance</ActionButton></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filteredAttendanceToday.length && !filteredAttendanceReport.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No attendance records available yet.</div> : null}
          </div>
        )}

        {activeTab === 'breaks' && renderAccessCheck(
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
              <input value={breakReason} onChange={(event) => setBreakReason(event.target.value)} placeholder="Break reason" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <ActionButton disabled={!canUseOwn || loadState === 'offline' || Boolean(actionBusy)} onClick={() => runAction('Break started', () => attendanceBreakStart(breakReason.trim() || undefined))}>Start Break</ActionButton>
              <ActionButton disabled={!canUseOwn || loadState === 'offline' || Boolean(actionBusy)} onClick={() => runAction('Break ended', attendanceBreakEnd)}>End Break</ActionButton>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {filteredAttendanceToday.map((row) => (
                <div key={valueId(row) || `${row.email}-break`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-semibold text-slate-950">{displayText(row.name, 'Staff')}</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <Field label="Current break status" value={<Badge tone={toneForStatus(row.breakStatus)}>{statusLabel(row.breakStatus, 'Not On Break')}</Badge>} />
                    <Field label="Break start" value={displayDateTime(row.breakStart || row.breakStartedAt)} />
                    <Field label="Break end" value={displayDateTime(row.breakEnd || row.breakEndedAt)} />
                    <Field label="Total break time" value={displayText(row.totalBreakTime || row.breakDuration)} />
                    <Field label="Break reason" value={displayText(row.breakReason)} />
                  </div>
                </div>
              ))}
            </div>
            {!filteredAttendanceToday.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No break records available yet.</div> : null}
          </div>
        )}

        {activeTab === 'leave' && renderAccessCheck(
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_2fr_auto]">
              <input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm((state) => ({ ...state, startDate: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <input type="date" value={leaveForm.endDate} onChange={(event) => setLeaveForm((state) => ({ ...state, endDate: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <input value={leaveForm.reason} onChange={(event) => setLeaveForm((state) => ({ ...state, reason: event.target.value }))} placeholder="Leave reason" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <ActionButton disabled={!canUseOwn || loadState === 'offline' || Boolean(actionBusy)} onClick={submitLeave}>Request Leave</ActionButton>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-slate-600"><th className="py-2 pr-4">Staff</th><th className="py-2 pr-4">Leave Type</th><th className="py-2 pr-4">Start Date</th><th className="py-2 pr-4">End Date</th><th className="py-2 pr-4">Reason</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Approve / Reject</th></tr></thead>
                <tbody>
                  {filteredLeaveRequests.map((row) => {
                    const id = valueId(row);
                    const pending = normalize(row.status) === 'pending';
                    return (
                      <tr key={id || `${row.email}-${row.startDate}`} className="border-t border-slate-200 align-top">
                        <td className="py-3 pr-4"><div className="font-semibold text-slate-950">{displayText(row.name, 'Staff')}</div><div className="mt-1 text-xs text-slate-600">{displayText(row.email || row.staffId)}</div></td>
                        <td className="py-3 pr-4 text-slate-700">{statusLabel(row.type, 'Leave')}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayText(row.startDate)}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayText(row.endDate)}</td>
                        <td className="py-3 pr-4 text-slate-700">{displayText(row.reason, '-')}</td>
                        <td className="py-3 pr-4"><Badge tone={toneForStatus(row.status)}>{statusLabel(row.status, 'Pending')}</Badge></td>
                        <td className="py-3 pr-4"><div className="flex flex-wrap gap-2"><ActionButton disabled={!canManage || !pending || !id || loadState === 'offline'} onClick={() => runAction('Leave approved', () => approveLeaveRequest(id))}>Approve Leave</ActionButton><ActionButton disabled={!canManage || !pending || !id || loadState === 'offline'} onClick={() => runAction('Leave rejected', () => rejectLeaveRequest(id))}>Reject Leave</ActionButton><ActionButton disabled={!canManage || loadState === 'offline'}>Mark Off Day</ActionButton></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filteredLeaveRequests.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No leave requests or off days available yet.</div> : null}
          </div>
        )}

        {activeTab === 'schedule' && renderAccessCheck(
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <input value={scheduleForm.title} onChange={(event) => setScheduleForm((state) => ({ ...state, title: event.target.value }))} placeholder="Schedule name" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={!canManage} />
              <input value={scheduleForm.staffId} onChange={(event) => setScheduleForm((state) => ({ ...state, staffId: event.target.value }))} placeholder="Assign to staff ID" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={!canManage} />
              <input value={scheduleForm.role} onChange={(event) => setScheduleForm((state) => ({ ...state, role: event.target.value }))} placeholder="Assign to role" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={!canManage} />
              <select value={scheduleForm.weeklyOffDay} onChange={(event) => setScheduleForm((state) => ({ ...state, weeklyOffDay: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={!canManage}>{dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}</select>
              <input type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm((state) => ({ ...state, startTime: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={!canManage} />
              <input type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm((state) => ({ ...state, endTime: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={!canManage} />
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"><input type="checkbox" checked={scheduleForm.active} onChange={(event) => setScheduleForm((state) => ({ ...state, active: event.target.checked }))} disabled={!canManage} /> Active</label>
              <ActionButton disabled={!canManage || loadState === 'offline' || Boolean(actionBusy)} onClick={submitSchedule}>Assign Schedule</ActionButton>
            </div>
            {!canManage ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">View My Schedule is limited to your own schedule.</div> : null}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-slate-600"><th className="py-2 pr-4">Shift Name</th><th className="py-2 pr-4">Start Time</th><th className="py-2 pr-4">End Time</th><th className="py-2 pr-4">Weekly Off</th><th className="py-2 pr-4">Assigned Staff</th><th className="py-2 pr-4">Assigned Role</th><th className="py-2 pr-4">Status</th></tr></thead>
                <tbody>
                  {filteredSchedules.map((row) => (
                    <tr key={valueId(row) || `${row.staffId}-${row.role}-${row.startTime}`} className="border-t border-slate-200 align-top">
                      <td className="py-3 pr-4 font-semibold text-slate-950">{displayText(row.title, 'Default schedule')}</td>
                      <td className="py-3 pr-4 text-slate-700">{displayText(row.startTime)}</td>
                      <td className="py-3 pr-4 text-slate-700">{displayText(row.endTime)}</td>
                      <td className="py-3 pr-4 text-slate-700">{displayText(row.weeklyOffDay)}</td>
                      <td className="py-3 pr-4 text-slate-700">{displayStaffId(row.staffId, isPrimaryFounderEmail(row.email))}</td>
                      <td className="py-3 pr-4 text-slate-700">{statusLabel(row.role, 'Staff')}</td>
                      <td className="py-3 pr-4"><Badge tone={row.active === false || normalize(row.status) === 'inactive' ? 'slate' : 'emerald'}>{row.active === false || normalize(row.status) === 'inactive' ? 'Inactive' : 'Active'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredSchedules.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No schedules available yet.</div> : null}
          </div>
        )}

        {activeTab === 'reports' && renderAccessCheck(
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Reports use the same attendance dataset and range filters shown in the Attendance tab.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['daily', 'weekly', 'monthly'].map((range) => (
                <button key={range} type="button" onClick={() => { setReportRange(range); void loadActivity(range); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${reportRange === range ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{statusLabel(range)}</button>
              ))}
              <ActionButton disabled={loadState === 'offline'}>Export Report</ActionButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}