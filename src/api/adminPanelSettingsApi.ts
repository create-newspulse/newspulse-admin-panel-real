import { adminJson, AdminApiError } from '@/lib/http/adminFetch';

export type TeamUser = {
  id?: string;
  _id?: string;
  email?: string;
  name?: string;
  role?: string;
  designation?: string;
  permissions?: string[];
  isActive?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

export type CreateTeamUserPayload = {
  email: string;
  name?: string;
  role?: string;
  designation?: string;
  permissions?: string[];
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
