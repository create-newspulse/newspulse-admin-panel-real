import { adminJson, AdminApiError } from '@/lib/http/adminFetch';

export const TEAM_AUTH_ERROR_MESSAGE = 'Session expired. Please login again.';
export const TEAM_ROLE_API_UNAVAILABLE_MESSAGE = 'Team role API is not available yet.';

export type TeamUser = {
  id?: string;
  _id?: string;
  email?: string;
  name?: string;
  fullName?: string;
  staffId?: string;
  role?: string;
  designation?: string;
  department?: string;
  assignedSections?: string[];
  coverageArea?: string[];
  coverageAreas?: string[];
  permissions?: string[];
  moduleAccess?: string[];
  specialRights?: string[];
  accountStatus?: string;
  accessExpiresAt?: string;
  accessExpiryDate?: string;
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
  fullName: string;
  email: string;
  recoveryEmail?: string;
  phone?: string;
  accountGroup?: string;
  position?: string;
  officialTitle?: string;
  defaultTasks?: string[];
  role?: string;
  employmentType?: string;
  reportingManager?: string;
  responsibility?: string;
  department?: string;
  assignedSections?: string[];
  coverageAreas?: string[];
  accountStatus?: string;
  accessExpiryDate?: string;
  designation?: string;
  generateTemporaryPassword?: boolean;
  mustChangePassword?: boolean;
  specialPermissions?: string[];
  moduleAccess?: string[];
  specialRights?: string[];
  temporaryGrants?: { targetType: 'module' | 'right'; key: string; expiresAt?: string; reason?: string }[];
  staffId?: string;
};

export type ChangeTeamUserEmailPayload = {
  newEmail: string;
  reason: string;
  forcePasswordChange: boolean;
  logoutAllDevices: boolean;
};

export type UpdateTeamUserPayload = {
  fullName?: string;
  role?: string;
  department?: string;
  assignedSections?: string[];
  coverageAreas?: string[];
  designation?: string;
  accessExpiryDate?: string;
  accountStatus?: string;
};

export type StaffReasonPayload = {
  reason?: string;
};

export type StaffAccessPayload = StaffReasonPayload & {
  accessExpiryDate: string;
};

export type MarkTestAccountPayload = StaffReasonPayload & {
  markAsTest?: boolean;
  markAsUnwanted?: boolean;
};

export type TeamStaffIdPreviewResponse = {
  staffId?: string;
  nextStaffId?: string;
  previewStaffId?: string;
  data?: {
    staffId?: string;
    nextStaffId?: string;
    previewStaffId?: string;
    [k: string]: any;
  };
  [k: string]: any;
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

export type TeamTaskPayload = {
  title: string;
  description?: string;
  assignedStaffId?: string;
  accountGroup?: string;
  taskCategory?: string;
  taskLevel?: string;
  department?: string;
  coverageArea?: string;
  priority?: string;
  dueDate?: string;
  status?: string;
  notes?: string;
  relatedModule?: string;
  relatedNews?: string;
};

export type TeamTask = TeamTaskPayload & {
  id?: string;
  _id?: string;
  assignedStaffName?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

const TEAM_API_PATHS = {
  users: '/admin-api/admin/team/staff',
  accessStaff: '/admin-api/admin/team/access/staff',
  accountGroups: '/admin-api/admin/team/account-groups',
  positions: '/admin-api/admin/team/positions',
  defaultTaskTemplates: '/admin-api/admin/team/default-task-templates',
  roles: '/admin-api/admin/team/roles',
  rolesWorkflow: '/admin-api/admin/team/roles-workflow',
  nextStaffId: '/admin-api/admin/team/next-staff-id',
  user: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}`,
  role: (id: string) => `/admin-api/admin/team/roles/${encodeURIComponent(id)}`,
  userEmail: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/email`,
  accessRecord: (id: string) => `/admin-api/admin/team/access/staff/${encodeURIComponent(id)}`,
  accessModules: (id: string) => `/admin-api/admin/team/access/staff/${encodeURIComponent(id)}/modules`,
  accessRights: (id: string) => `/admin-api/admin/team/access/staff/${encodeURIComponent(id)}/rights`,
  accessTaskRights: (id: string) => `/admin-api/admin/team/access/staff/${encodeURIComponent(id)}/task-rights`,
  accessAccountControlRights: (id: string) => `/admin-api/admin/team/access/staff/${encodeURIComponent(id)}/account-control-rights`,
  accessTemporary: (id: string) => `/admin-api/admin/team/access/staff/${encodeURIComponent(id)}/temporary`,
  effectiveAccess: (id: string) => `/admin-api/admin/team/access/staff/${encodeURIComponent(id)}/effective-access`,
  generateTemporaryPassword: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/generate-temporary-password`,
  resetPassword: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/reset-password`,
  forceChangePassword: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/force-change-password`,
  extendAccess: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/extend-access`,
  reactivate: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/reactivate`,
  suspend: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/suspend`,
  lock: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/lock`,
  logoutAllDevices: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/logout-all-devices`,
  archived: '/admin-api/admin/team/archived',
  archive: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/archive`,
  restore: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/restore`,
  deleteTestOnly: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/delete-permanently`,
  markTestAccount: (id: string) => `/admin-api/admin/team/staff/${encodeURIComponent(id)}/mark-test-account`,
  tasks: '/admin-api/admin/team/tasks',
  task: (id: string) => `/admin-api/admin/team/tasks/${encodeURIComponent(id)}`,
  taskAssign: (id: string) => `/admin-api/admin/team/tasks/${encodeURIComponent(id)}/assign`,
  taskReassign: (id: string) => `/admin-api/admin/team/tasks/${encodeURIComponent(id)}/reassign`,
  taskStatus: (id: string) => `/admin-api/admin/team/tasks/${encodeURIComponent(id)}/status`,
  taskComment: (id: string) => `/admin-api/admin/team/tasks/${encodeURIComponent(id)}/comment`,
  taskClose: (id: string) => `/admin-api/admin/team/tasks/${encodeURIComponent(id)}/close`,
  taskComplete: (id: string) => `/admin-api/admin/team/tasks/${encodeURIComponent(id)}/complete`,
} as const;

const TASK_RIGHT_KEYS = new Set(['can_create_task', 'can_assign_task', 'can_edit_task', 'can_update_task_status', 'can_complete_task', 'can_close_task', 'can_delete_task', 'can_view_team_tasks', 'can_manage_department_tasks', 'can_comment_on_task', 'can_escalate_task']);
const ACCOUNT_CONTROL_RIGHT_KEYS = new Set(['can_view_staff_details', 'can_edit_staff_basic_details', 'can_change_staff_email', 'can_generate_temporary_password', 'can_reset_staff_password', 'can_force_password_change', 'can_logout_all_devices', 'can_extend_or_reactivate_staff', 'can_suspend_staff', 'can_suspend_staff_account', 'can_lock_staff_account', 'can_archive_staff', 'can_delete_staff_permanently', 'can_control_founder_account', 'can_grant_account_control_rights']);

function normalizeList<T = any>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (Array.isArray(raw.items)) return raw.items as T[];
  if (Array.isArray(raw.users)) return raw.users as T[];
  if (Array.isArray(raw.staff)) return raw.staff as T[];
  if (Array.isArray(raw.data)) return raw.data as T[];
  return [];
}

function statusOf(err: unknown): number {
  const e: any = err as any;
  return Number(e?.status ?? e?.response?.status ?? 0);
}

export function isTeamApiUnauthorized(err: unknown): boolean {
  return statusOf(err) === 401;
}

export function isTeamRoleApiUnavailable(err: unknown): boolean {
  return statusOf(err) === 404;
}

export function isTeamValidationError(err: unknown): boolean {
  return statusOf(err) === 400;
}

export function toTeamApiErrorMessage(err: unknown, fallback: string): string {
  if (isTeamApiUnauthorized(err)) return TEAM_AUTH_ERROR_MESSAGE;
  const status = statusOf(err);
  if (status === 403) return 'Founder permission required.';
  if (status === 404) return 'Staff not found.';
  if (status === 409) return 'Duplicate email.';
  if (!err) return fallback;
  if (err instanceof AdminApiError) return err.message || fallback;
  const e: any = err as any;
  return e?.message || e?.response?.data?.message || e?.response?.data?.error || e?.response?.data?.details || fallback;
}

export function logTeamApiError(context: string, err: unknown): void {
  if (!import.meta.env.DEV) return;
  try {
    const e: any = err as any;
    // eslint-disable-next-line no-console
    console.error(`[team-api] ${context}`, {
      status: e?.status ?? e?.response?.status,
      message: e?.message,
      body: e?.body ?? e?.response?.data,
      url: e?.url,
    });
  } catch {
    // ignore
  }
}

function extractStaffIdToken(value: unknown): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = text.match(/\bNP-\d{4}-\d{4,}\b/i);
  return match ? match[0].toUpperCase() : text;
}

function extractPreviewStaffId(raw: TeamStaffIdPreviewResponse | null | undefined): string | null {
  const value = raw?.staffId || raw?.nextStaffId || raw?.previewStaffId || raw?.data?.staffId || raw?.data?.nextStaffId || raw?.data?.previewStaffId;
  return extractStaffIdToken(value);
}

function withoutStaffId(payload: CreateTeamUserPayload): Omit<CreateTeamUserPayload, 'staffId'> {
  const { staffId: _staffId, ...safePayload } = payload;
  return safePayload;
}

export async function getTeamUsers(): Promise<TeamUser[]> {
  const raw = await adminJson<any>(TEAM_API_PATHS.users, { cache: 'no-store' } as any);
  return normalizeList<TeamUser>(raw);
}

export async function getTeamUser(id: string): Promise<TeamUser> {
  const raw = await adminJson<any>(TEAM_API_PATHS.user(id), { cache: 'no-store' } as any);
  return (raw?.user || raw?.data?.user || raw?.data || raw) as TeamUser;
}

export async function createTeamUser(payload: CreateTeamUserPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.users, {
    method: 'POST',
    json: withoutStaffId(payload),
  });
}

export async function getNextTeamStaffIdPreview(): Promise<string | null> {
  try {
    const raw = await adminJson<TeamStaffIdPreviewResponse>(TEAM_API_PATHS.nextStaffId, { cache: 'no-store' } as any);
    return extractPreviewStaffId(raw);
  } catch (err: any) {
    const status = statusOf(err);
    if ([404, 405, 501].includes(status)) return null;
    throw err;
  }
}

export async function updateTeamUser(id: string, payload: UpdateTeamUserPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.user(id), {
    method: 'PATCH',
    json: payload,
  });
}

export async function changeTeamUserEmail(id: string, payload: ChangeTeamUserEmailPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.userEmail(id), {
    method: 'PATCH',
    json: payload,
  });
}

export async function getTeamRoles(): Promise<TeamRole[]> {
  const raw = await adminJson<any>(TEAM_API_PATHS.rolesWorkflow, { cache: 'no-store' } as any).catch(() => adminJson<any>(TEAM_API_PATHS.roles, { cache: 'no-store' } as any));
  return normalizeList<TeamRole>(raw);
}

export async function getTeamAccountGroups(): Promise<any[]> {
  const raw = await adminJson<any>(TEAM_API_PATHS.accountGroups, { cache: 'no-store' } as any);
  return normalizeList<any>(raw);
}

export async function getTeamPositions(): Promise<any[]> {
  const raw = await adminJson<any>(TEAM_API_PATHS.positions, { cache: 'no-store' } as any);
  return normalizeList<any>(raw);
}

export async function getDefaultTeamTaskTemplates(): Promise<any[]> {
  const raw = await adminJson<any>(TEAM_API_PATHS.defaultTaskTemplates, { cache: 'no-store' } as any);
  return normalizeList<any>(raw);
}

export async function createTeamRole(payload: TeamRolePayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.roles, {
    method: 'POST',
    json: payload,
  });
}

export async function updateTeamRole(id: string, payload: Partial<TeamRolePayload>): Promise<any> {
  return adminJson(TEAM_API_PATHS.role(id), {
    method: 'PUT',
    json: payload,
  });
}

export async function saveStaffAccessOverride(id: string, payload: { moduleAccess?: string[]; specialRights?: string[]; reason?: string; accessExpiryDate?: string; temporaryGrants?: { targetType: 'module' | 'right'; key: string; expiresAt: string; reason?: string }[] }): Promise<any> {
  const requests: Promise<any>[] = [];
  if (payload.moduleAccess) {
    requests.push(adminJson(TEAM_API_PATHS.accessModules(id), {
      method: 'PATCH',
      json: { moduleAccess: payload.moduleAccess, modules: payload.moduleAccess, reason: payload.reason },
    }));
  }
  if (payload.specialRights) {
    const taskRights = payload.specialRights.filter((right) => TASK_RIGHT_KEYS.has(right));
    const accountControlRights = payload.specialRights.filter((right) => ACCOUNT_CONTROL_RIGHT_KEYS.has(right));
    requests.push(adminJson(TEAM_API_PATHS.accessRights(id), {
      method: 'PATCH',
      json: { specialRights: payload.specialRights, rights: payload.specialRights, reason: payload.reason },
    }));
    requests.push(adminJson(TEAM_API_PATHS.accessTaskRights(id), {
      method: 'PATCH',
      json: { taskRights, rights: taskRights, reason: payload.reason },
    }));
    requests.push(adminJson(TEAM_API_PATHS.accessAccountControlRights(id), {
      method: 'PATCH',
      json: { accountControlRights, rights: accountControlRights, appointedAccountManager: accountControlRights.length > 0, reason: payload.reason },
    }));
  }
  if (payload.accessExpiryDate) {
    requests.push(adminJson(TEAM_API_PATHS.accessTemporary(id), {
      method: 'POST',
      json: { accessExpiryDate: payload.accessExpiryDate, reason: payload.reason },
    }).catch((err) => {
      if ([404, 405, 501].includes(statusOf(err))) return { temporaryUnavailable: true };
      throw err;
    }));
  }
  payload.temporaryGrants?.forEach((grant) => {
    requests.push(adminJson(TEAM_API_PATHS.accessTemporary(id), {
      method: 'POST',
      json: { targetType: grant.targetType, key: grant.key, expiresAt: grant.expiresAt, accessExpiryDate: grant.expiresAt, reason: grant.reason || payload.reason },
    }).catch((err) => {
      if ([404, 405, 501].includes(statusOf(err))) return { temporaryUnavailable: true };
      throw err;
    }));
  });
  return Promise.all(requests);
}

export async function generateTemporaryPasswordUser(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.generateTemporaryPassword(id), { method: 'POST' });
}

export async function resetPasswordUser(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.resetPassword(id), {
    method: 'POST',
    json: { mustChangePassword: true, logoutAllDevices: true },
  });
}

export async function forceResetUser(id: string): Promise<any> {
  return resetPasswordUser(id);
}

export async function forceChangePasswordUser(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.forceChangePassword(id), { method: 'POST' });
}

export async function extendAccessUser(id: string, payload: StaffAccessPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.extendAccess(id), {
    method: 'POST',
    json: payload,
  });
}

export async function reactivateUser(id: string, payload?: Partial<StaffAccessPayload>): Promise<any> {
  return adminJson(TEAM_API_PATHS.reactivate(id), {
    method: 'POST',
    json: payload || {},
  });
}

export async function restoreUser(id: string, payload?: StaffReasonPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.restore(id), {
    method: 'POST',
    json: payload || {},
  });
}

export async function activateUser(id: string): Promise<any> {
  return reactivateUser(id);
}

export async function suspendUser(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.suspend(id), { method: 'POST' });
}

export async function lockUser(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.lock(id), { method: 'POST' });
}

export async function logoutAllTeamUserDevices(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.logoutAllDevices(id), { method: 'POST' });
}

export async function archiveUser(id: string, payload: StaffReasonPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.archive(id), {
    method: 'POST',
    json: payload,
  });
}

export async function deleteTestUserOnly(id: string, payload: { confirmation: string; reason?: string }): Promise<any> {
  return adminJson(TEAM_API_PATHS.deleteTestOnly(id), {
    method: 'DELETE',
    json: { ...payload, confirmation: payload.confirmation, auditRequired: true },
  });
}

export async function markTestAccountUser(id: string, payload: MarkTestAccountPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.markTestAccount(id), {
    method: 'POST',
    json: payload,
  });
}

export async function getTeamTasks(): Promise<TeamTask[]> {
  const raw = await adminJson<any>(TEAM_API_PATHS.tasks, { cache: 'no-store' } as any);
  return normalizeList<TeamTask>(raw);
}

export async function createTeamTask(payload: TeamTaskPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.tasks, {
    method: 'POST',
    json: payload,
  });
}

export async function updateTeamTask(id: string, payload: Partial<TeamTaskPayload>): Promise<any> {
  return adminJson(TEAM_API_PATHS.task(id), {
    method: 'PATCH',
    json: payload,
  });
}

export async function assignTeamTask(id: string, payload: { assignedStaffId: string; reason?: string }): Promise<any> {
  return adminJson(TEAM_API_PATHS.taskAssign(id), {
    method: 'POST',
    json: payload,
  });
}

export async function reassignTeamTask(id: string, payload: { assignedStaffId: string; reason?: string }): Promise<any> {
  return adminJson(TEAM_API_PATHS.taskReassign(id), {
    method: 'POST',
    json: payload,
  });
}

export async function updateTeamTaskStatus(id: string, payload: { status: string; reason?: string }): Promise<any> {
  return adminJson(TEAM_API_PATHS.taskStatus(id), {
    method: 'POST',
    json: payload,
  });
}

export async function commentOnTeamTask(id: string, payload: { comment: string }): Promise<any> {
  return adminJson(TEAM_API_PATHS.taskComment(id), {
    method: 'POST',
    json: payload,
  });
}

export async function completeTeamTask(id: string, reason?: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.taskComplete(id), {
    method: 'POST',
    json: { reason },
  });
}

export async function closeTeamTask(id: string, reason?: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.taskClose(id), {
    method: 'POST',
    json: { reason },
  });
}

export async function deleteTeamTask(id: string, reason?: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.task(id), {
    method: 'DELETE',
    json: { reason },
  });
}
