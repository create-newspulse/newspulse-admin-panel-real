import { adminJson, AdminApiError } from '@/lib/http/adminFetch';

export type TeamUser = {
  id?: string;
  _id?: string;
  email?: string;
  name?: string;
  staffId?: string;
  role?: string;
  designation?: string;
  department?: string;
  assignedSections?: string[];
  permissions?: string[];
  moduleAccess?: string[];
  specialRights?: string[];
  accessOverrides?: {
    modules?: string[];
    specialRights?: string[];
    [k: string]: any;
  };
  isActive?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

export type CreateTeamUserPayload = {
  email: string;
  name?: string;
  staffId?: string;
  role?: string;
  designation?: string;
  department?: string;
  assignedSections?: string[];
  status?: string;
  accessExpiresAt?: string;
  generateTemporaryPassword?: boolean;
  mustChangePassword?: boolean;
  permissions?: string[];
  moduleAccess?: string[];
  specialRights?: string[];
};

export type TeamRolePayload = {
  id?: string;
  roleName: string;
  description?: string;
  sortOrder?: number;
  systemRole?: boolean;
  moduleAccess?: string[];
  specialRights?: string[];
};

export type TeamRole = TeamRolePayload & {
  _id?: string;
  protected?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

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

// Team management
export async function getTeamUsers(): Promise<TeamUser[]> {
  const raw = await adminJson<any>('/admin/team/users', { cache: 'no-store' } as any);
  return normalizeList<TeamUser>(raw);
}

export async function createTeamUser(payload: CreateTeamUserPayload): Promise<any> {
  return adminJson('/admin/team/users', {
    method: 'POST',
    json: payload,
  });
}

export async function updateTeamUser(id: string, payload: Partial<CreateTeamUserPayload>): Promise<any> {
  return adminJson(`/admin/team/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    json: payload,
  });
}

export async function getTeamRoles(): Promise<TeamRole[]> {
  const raw = await adminJson<any>('/admin/team/roles', { cache: 'no-store' } as any);
  return normalizeList<TeamRole>(raw);
}

export async function createTeamRole(payload: TeamRolePayload): Promise<any> {
  return adminJson('/admin/team/roles', {
    method: 'POST',
    json: payload,
  });
}

export async function updateTeamRole(id: string, payload: Partial<TeamRolePayload>): Promise<any> {
  return adminJson(`/admin/team/roles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    json: payload,
  });
}

export async function saveStaffAccessOverride(id: string, payload: { moduleAccess?: string[]; specialRights?: string[] }): Promise<any> {
  return adminJson(`/admin/team/users/${encodeURIComponent(id)}/access-override`, {
    method: 'PUT',
    json: payload,
  });
}

export async function activateUser(id: string): Promise<any> {
  return adminJson(`/admin/team/users/${encodeURIComponent(id)}/activate`, { method: 'POST' });
}

export async function suspendUser(id: string): Promise<any> {
  return adminJson(`/admin/team/users/${encodeURIComponent(id)}/suspend`, { method: 'POST' });
}

export async function forceResetUser(id: string): Promise<any> {
  return adminJson(`/admin/team/users/${encodeURIComponent(id)}/force-reset`, { method: 'POST' });
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
  const raw = await adminJson<any>(`/admin/audit?limit=${encodeURIComponent(String(limit))}`, { cache: 'no-store' } as any);
  return normalizeList<AuditLogRow>(raw);
}

// Preview
export async function getAdminPanelPreview(): Promise<AdminPanelPreviewResponse> {
  const raw = await adminJson<AdminPanelPreviewResponse>('/admin/settings/admin-panel/preview', { cache: 'no-store' } as any);
  return raw || {};
}
