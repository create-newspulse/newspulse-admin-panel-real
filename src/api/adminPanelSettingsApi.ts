import { adminJson, AdminApiError } from '@/lib/http/adminFetch';

export type { CreateTeamUserPayload, TeamRole, TeamRolePayload, TeamStaffIdPreviewResponse, TeamUser } from '@/api/teamManagementApi';
export {
  activateUser,
  createTeamRole,
  createTeamUser,
  forceResetUser,
  getNextTeamStaffIdPreview,
  getTeamRoles,
  getTeamUsers,
  saveStaffAccessOverride,
  suspendUser,
  updateTeamRole,
  updateTeamUser,
} from '@/api/teamManagementApi';

export type TeamPresenceRow = {
  id?: string;
  userId?: string;
  staffId?: string;
  email?: string;
  name?: string;
  role?: string;
  onlineStatus?: string;
  status?: string;
  lastSeen?: string;
  lastLogin?: string;
  lastLogout?: string;
  device?: string;
  browser?: string;
  ipAddress?: string;
  sessionDuration?: string;
  logoutReason?: string;
  [k: string]: any;
};

export type TeamSessionLog = {
  id?: string;
  _id?: string;
  userId?: string;
  staffId?: string;
  email?: string;
  name?: string;
  lastLogin?: string;
  loginAt?: string;
  lastLogout?: string;
  logoutAt?: string;
  lastSeen?: string;
  device?: string;
  browser?: string;
  ipAddress?: string;
  sessionDuration?: string;
  logoutReason?: string;
  [k: string]: any;
};

export type AttendanceRecord = {
  id?: string;
  _id?: string;
  userId?: string;
  staffId?: string;
  email?: string;
  name?: string;
  date?: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalWorkTime?: string;
  totalBreakTime?: string;
  attendanceStatus?: string;
  status?: string;
  correctionStatus?: string;
  breakStatus?: string;
  [k: string]: any;
};

export type LeaveRequestRow = {
  id?: string;
  _id?: string;
  userId?: string;
  staffId?: string;
  email?: string;
  name?: string;
  type?: string;
  reason?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  [k: string]: any;
};

export type ScheduleRow = {
  id?: string;
  _id?: string;
  userId?: string;
  staffId?: string;
  email?: string;
  role?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  weeklyOffDay?: string;
  active?: boolean;
  status?: string;
  [k: string]: any;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type AuditLogRow = {
  ts?: string;
  time?: string;
  actorEmail?: string;
  actorId?: string;
  action?: string;
  type?: string;
  target?: string;
  meta?: any;
  payload?: any;
  [k: string]: any;
};

export type AdminPanelPreviewResponse = {
  ok?: boolean;
  version?: string;
  updatedAt?: string;
  draft?: any;
  published?: any;
  effective?: any;
  [k: string]: any;
};

function normalizeList<T = any>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (Array.isArray(raw.items)) return raw.items as T[];
  if (Array.isArray(raw.users)) return raw.users as T[];
  if (Array.isArray(raw.staff)) return raw.staff as T[];
  if (Array.isArray(raw.data)) return raw.data as T[];
  if (Array.isArray(raw.audit)) return raw.audit as T[];
  return [];
}

export function isAccessDenied(err: unknown): boolean {
  const e = err as any;
  const status = e?.status ?? e?.response?.status;
  return status === 403;
}

export function isUnauthenticated(err: unknown): boolean {
  const e = err as any;
  const status = e?.status ?? e?.response?.status;
  return status === 401;
}

export function toFriendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (err instanceof AdminApiError) return err.message || fallback;
  const e: any = err as any;
  return e?.message || e?.response?.data?.message || e?.response?.data?.error || fallback;
}

// Security
export async function logoutAll(userId?: string): Promise<any> {
  return adminJson('/admin/auth/logout-all', {
    method: 'POST',
    json: userId ? { userId } : {},
  });
}

// Staff activity, attendance, leave, and schedules
export async function getTeamPresence(): Promise<TeamPresenceRow[]> {
  const raw = await adminJson<any>('/admin-api/team/presence', { cache: 'no-store' } as any);
  return normalizeList<TeamPresenceRow>(raw);
}

export async function getTeamSessionLogs(): Promise<TeamSessionLog[]> {
  const raw = await adminJson<any>('/admin-api/team/session-logs', { cache: 'no-store' } as any);
  return normalizeList<TeamSessionLog>(raw);
}

export async function sendTeamPresenceHeartbeat(): Promise<any> {
  return adminJson('/admin-api/team/presence/heartbeat', {
    method: 'POST',
    json: { at: new Date().toISOString() },
  });
}

export async function attendanceCheckIn(): Promise<any> {
  return adminJson('/admin-api/attendance/check-in', { method: 'POST' });
}

export async function attendanceCheckOut(): Promise<any> {
  return adminJson('/admin-api/attendance/check-out', { method: 'POST' });
}

export async function attendanceBreakStart(reason?: string): Promise<any> {
  return adminJson('/admin-api/attendance/break/start', {
    method: 'POST',
    json: reason ? { reason } : {},
  });
}

export async function attendanceBreakEnd(): Promise<any> {
  return adminJson('/admin-api/attendance/break/end', { method: 'POST' });
}

export async function getAttendanceToday(): Promise<AttendanceRecord[]> {
  const raw = await adminJson<any>('/admin-api/attendance/today', { cache: 'no-store' } as any);
  return normalizeList<AttendanceRecord>(raw);
}

export async function getAttendanceReport(range = 'daily'): Promise<AttendanceRecord[]> {
  const raw = await adminJson<any>(`/admin-api/attendance/report?range=${encodeURIComponent(range)}`, { cache: 'no-store' } as any);
  return normalizeList<AttendanceRecord>(raw);
}

export async function requestLeave(payload: { startDate?: string; endDate?: string; reason?: string; type?: string }): Promise<any> {
  return adminJson('/admin-api/leave/request', {
    method: 'POST',
    json: payload,
  });
}

export async function getLeaveRequests(): Promise<LeaveRequestRow[]> {
  const raw = await adminJson<any>('/admin-api/leave/all', { cache: 'no-store' } as any);
  return normalizeList<LeaveRequestRow>(raw);
}

export async function approveLeaveRequest(id: string): Promise<any> {
  return adminJson(`/admin-api/leave/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
}

export async function rejectLeaveRequest(id: string): Promise<any> {
  return adminJson(`/admin-api/leave/${encodeURIComponent(id)}/reject`, { method: 'PATCH' });
}

export async function createSchedule(payload: Partial<ScheduleRow>): Promise<any> {
  return adminJson('/admin-api/schedules', {
    method: 'POST',
    json: payload,
  });
}

export async function getSchedules(): Promise<ScheduleRow[]> {
  const raw = await adminJson<any>('/admin-api/schedules', { cache: 'no-store' } as any);
  return normalizeList<ScheduleRow>(raw);
}

// Password
export async function changePassword(payload: ChangePasswordPayload): Promise<any> {
  return adminJson('/admin/auth/change-password', {
    method: 'POST',
    json: payload,
  });
}

// Audit
export async function getAuditLogs(limit = 50): Promise<AuditLogRow[]> {
  const raw = await adminJson<any>(`/admin-api/admin/audit-logs?limit=${encodeURIComponent(String(limit))}`, { cache: 'no-store' } as any);
  return normalizeList<AuditLogRow>(raw);
}

// Preview
export async function getAdminPanelPreview(): Promise<AdminPanelPreviewResponse> {
  const raw = await adminJson<AdminPanelPreviewResponse>('/admin/settings/admin-panel/preview', { cache: 'no-store' } as any);
  return raw || {};
}
