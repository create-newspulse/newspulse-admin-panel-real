import { adminJson, AdminApiError } from '@/lib/http/adminFetch';

export const TEAM_AUTH_ERROR_MESSAGE = 'Session expired or unauthorized. Please login again.';
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
  role?: string;
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
  staffId?: string;
};

export type ChangeTeamUserEmailPayload = {
  newEmail: string;
  reason: string;
  forcePasswordChange: boolean;
  logoutAllDevices: boolean;
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

const TEAM_API_PATHS = {
  users: '/admin-api/admin/team/users',
  roles: '/admin-api/admin/team/roles',
  nextStaffId: '/admin-api/admin/team/next-staff-id',
  user: (id: string) => `/admin-api/admin/team/users/${encodeURIComponent(id)}`,
  role: (id: string) => `/admin-api/admin/team/roles/${encodeURIComponent(id)}`,
  userEmail: (id: string) => `/admin-api/admin/team/users/${encodeURIComponent(id)}/email`,
  accessOverride: (id: string) => `/admin-api/admin/team/users/${encodeURIComponent(id)}/access-override`,
  activate: (id: string) => `/admin-api/admin/team/users/${encodeURIComponent(id)}/activate`,
  suspend: (id: string) => `/admin-api/admin/team/users/${encodeURIComponent(id)}/suspend`,
  forceReset: (id: string) => `/admin-api/admin/team/users/${encodeURIComponent(id)}/force-reset`,
} as const;

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

export async function updateTeamUser(id: string, payload: Partial<CreateTeamUserPayload>): Promise<any> {
  return adminJson(TEAM_API_PATHS.user(id), {
    method: 'PUT',
    json: withoutStaffId(payload as CreateTeamUserPayload),
  });
}

export async function changeTeamUserEmail(id: string, payload: ChangeTeamUserEmailPayload): Promise<any> {
  return adminJson(TEAM_API_PATHS.userEmail(id), {
    method: 'PATCH',
    json: payload,
  });
}

export async function getTeamRoles(): Promise<TeamRole[]> {
  const raw = await adminJson<any>(TEAM_API_PATHS.roles, { cache: 'no-store' } as any);
  return normalizeList<TeamRole>(raw);
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

export async function saveStaffAccessOverride(id: string, payload: { moduleAccess?: string[]; specialRights?: string[] }): Promise<any> {
  return adminJson(TEAM_API_PATHS.accessOverride(id), {
    method: 'PUT',
    json: payload,
  });
}

export async function activateUser(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.activate(id), { method: 'POST' });
}

export async function suspendUser(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.suspend(id), { method: 'POST' });
}

export async function forceResetUser(id: string): Promise<any> {
  return adminJson(TEAM_API_PATHS.forceReset(id), { method: 'POST' });
}
