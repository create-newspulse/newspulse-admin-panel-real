import { adminJson, AdminApiError } from '@/lib/http/adminFetch';

export type AccountProfile = {
  id?: string;
  _id?: string;
  email?: string;
  recoveryEmail?: string;
  founderRecoveryEmail?: string;
  name?: string;
  fullName?: string;
  staffId?: string;
  role?: string;
  department?: string;
  assignedSections?: string[];
  coverageArea?: string[];
  coverageAreas?: string[];
  designation?: string;
  accountStatus?: string;
  status?: string;
  accessExpiresAt?: string;
  accessExpiryDate?: string;
  expiresAt?: string;
  lastLogin?: string;
  lastLoginAt?: string;
  loginAt?: string;
  lastLogout?: string;
  lastLogoutAt?: string;
  logoutAt?: string;
  lastPasswordChanged?: string;
  lastPasswordChangedAt?: string;
  passwordChangedAt?: string;
  sessionStatus?: string;
  authSessionStatus?: string;
  device?: string;
  browser?: string;
  attendance?: unknown;
  schedule?: unknown;
  leaveStatus?: unknown;
  mustChangePassword?: boolean;
  passwordChangeRequired?: boolean;
  forcePasswordChange?: boolean;
  founderEmailChangeApiAvailable?: boolean;
  canChangeFounderEmail?: boolean;
  protectedEmailChangeEnabled?: boolean;
  [key: string]: unknown;
};

export type AccountSession = {
  id?: string;
  _id?: string;
  current?: boolean;
  isCurrent?: boolean;
  status?: string;
  sessionStatus?: string;
  lastLogin?: string;
  lastLoginAt?: string;
  loginAt?: string;
  lastLogout?: string;
  lastLogoutAt?: string;
  logoutAt?: string;
  device?: string;
  browser?: string;
  ipAddress?: string;
  [key: string]: unknown;
};

export type ChangeOwnPasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type ChangeFounderEmailPayload = {
  newEmail: string;
  recoveryEmail?: string;
  reason: string;
};

function normalizeObject<T>(raw: any): T {
  return (raw?.data?.account || raw?.data?.profile || raw?.data?.user || raw?.account || raw?.profile || raw?.user || raw?.data || raw || {}) as T;
}

function normalizeList<T>(raw: any): T[] {
  const value = raw?.data?.sessions || raw?.sessions || raw?.items || raw?.data || raw;
  return Array.isArray(value) ? value as T[] : [];
}

function isEndpointUnavailable(error: unknown): boolean {
  const status = Number((error as any)?.status ?? (error as any)?.response?.status ?? 0);
  return status === 404 || status === 405 || status === 501;
}

export function accountErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof AdminApiError) return error.message || fallback;
  const e: any = error as any;
  return e?.message || e?.response?.data?.message || e?.response?.data?.error || e?.response?.data?.details || fallback;
}

export async function getAccountMe(): Promise<AccountProfile> {
  const raw = await adminJson<any>('/admin-api/admin/account/me', { cache: 'no-store' } as any);
  return normalizeObject<AccountProfile>(raw);
}

export async function getFounderMyAccount(): Promise<AccountProfile> {
  const raw = await adminJson<any>('/admin-api/admin/founder/my-account', { cache: 'no-store' } as any);
  return normalizeObject<AccountProfile>(raw);
}

export async function getStaffMyAccount(): Promise<AccountProfile> {
  const raw = await adminJson<any>('/admin-api/admin/my-account', { cache: 'no-store' } as any);
  return normalizeObject<AccountProfile>(raw);
}

export async function getAccountSessions(): Promise<AccountSession[]> {
  const raw = await adminJson<any>('/admin-api/admin/account/sessions', { cache: 'no-store' } as any);
  return normalizeList<AccountSession>(raw);
}

export async function changeOwnPassword(payload: ChangeOwnPasswordPayload): Promise<any> {
  try {
    return await adminJson('/admin-api/admin/account/change-password', {
      method: 'POST',
      json: payload,
    });
  } catch (error) {
    if (!isEndpointUnavailable(error)) throw error;
    return adminJson('/admin/auth/change-password', {
      method: 'POST',
      json: payload,
    });
  }
}

export async function changeFounderEmail(payload: ChangeFounderEmailPayload): Promise<any> {
  return adminJson('/admin-api/admin/founder/my-account/email', {
    method: 'PATCH',
    json: payload,
  });
}

export async function logoutAllMyDevices(): Promise<any> {
  return adminJson('/admin-api/admin/account/logout-all-my-devices', { method: 'POST' });
}