import { api, apiUrl, adminApi, adminUrl, getAuthToken } from './api';

function stripTrailingSlashes(s: string) {
  return (s || '').replace(/\/+$/, '');
}

// Preserve existing exports used across the app.
export const adminRoot = stripTrailingSlashes(adminUrl('/'));
export const ADMIN_API_BASE = adminRoot;
export { adminApi, getAuthToken };

// Resolve an API path relative to the chosen base.
// Accepts legacy forms like '/api/admin/...' and normalizes to '/admin/...'.
export function resolveAdminPath(p: string): string {
  const s0 = (p || '').toString().trim();
  if (!s0) return adminUrl('/');
  if (/^https?:\/\//i.test(s0)) return s0;

  let clean = s0.startsWith('/') ? s0 : `/${s0}`;

  // Normalize legacy '/api/admin/*' -> '/admin/*'
  if (clean === '/api/admin') clean = '/admin';
  if (clean.startsWith('/api/admin/')) clean = clean.replace(/^\/api\/admin\//, '/admin/');
  if (clean.startsWith('/admin/')) return adminUrl(clean);
  // If a caller accidentally provides '/api/*', keep it on the public API base.
  if (clean.startsWith('/api/')) return apiUrl(clean);
  return adminUrl(clean);
}

// OTP Password Reset helpers (backend exposes /api/auth/otp/*)
function otpEndpoint(segment: string) {
  return `/auth/otp/${segment}`;
}

// Structured OTP request: always returns an object with success flag
export interface OtpRequestResult {
  success: boolean;
  message: string;
  status?: number;
  data?: any;
}
export async function requestPasswordResetOtp(email: string): Promise<OtpRequestResult> {
  const path = otpEndpoint('request');
  try {
    const res = await api.post(path, { email });
    const data = res.data || {};
    const success = data.success === true || data.ok === true;
    const message = data.message || (success ? 'OTP sent to your email.' : 'Failed to send OTP email');
    return { success, message, status: res.status, data };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data || {};
    const message = data.message || 'Failed to send OTP email';
    console.error('[OTP][api][request][error]', { status, data, error: err?.message });
    return { success: false, message, status, data };
  }
}

export async function verifyPasswordOtp(email: string, otp: string) {
  const path = otpEndpoint('verify');
  return (await api.post(path, { email, otp })).data;
}

export async function resetPasswordWithOtp(email: string, otp: string, password: string) {
  const path = otpEndpoint('reset');
  return (await api.post(path, { email, code: otp, newPassword: password })).data;
}

export async function resetPasswordWithToken(email: string, resetToken: string, password: string) {
  const path = otpEndpoint('reset');
  return (await api.post(path, { email, resetToken, newPassword: password })).data;
}

// Unified admin login with automatic path fallback
export interface LoginDTO { email: string; password: string }
export async function loginAdmin(dto: LoginDTO) {
  const paths = [resolveAdminPath('/login')];
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res = await adminApi.post(p, dto);
      const data = res.data || {};
      const user = data.user || data.data?.user || {
        id: data.id || data._id,
        email: data.email,
        name: data.name,
        role: data.role,
      };
      const token = data.token || data.accessToken || null;
      return { ok: true, token, user };
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      // Fallback only on 404/405; abort early on auth errors
      if (status === 401 || status === 403) break;
      continue;
    }
  }
  throw lastErr || new Error('Login failed');
}

// (Removed multi-path Community Reporter helper; component now calls single definitive endpoint.)
// Community Reporter decision helper (fetch-based per spec)
// Community Reporter direct calls now done inline; previous decision helper removed per updated spec.

export interface CommunityCleanupResponse {
  deletedCount: number;
  olderThanDays?: number;
  cutoffDate?: string;
}

export async function cleanupOldLowPriorityCommunityStories(): Promise<CommunityCleanupResponse> {
  const { data } = await adminApi.post('/community-reporter/cleanup');
  return data as CommunityCleanupResponse;
}

// --- Community Reporter & System Health helpers ---
// System Health
export async function getSystemHealth(): Promise<any> {
  const { data } = await adminApi.get('/system/health');
  return data;
}

// Community Reporter Queue
export interface CommunityQueueItem {
  id?: string;
  _id?: string;
  title?: string;
  status?: string;
  createdAt?: string;
  [key: string]: any;
}
export async function fetchCommunityReporterQueue(status: 'pending' | 'rejected' = 'pending'): Promise<CommunityQueueItem[]> {
  const { data } = await adminApi.get('/community-reporter/queue', {
    params: { status },
  });
  return Array.isArray(data) ? data : (data?.items || []);
}

// Reporter Contacts with query normalization
export interface ReporterContactQuery {
  activity?: 'all' | 'active' | 'inactive' | string;
  district?: string;
  area?: string;
  beats?: string;
  page?: number;
  limit?: number;
}
export interface ReporterContact {
  id?: string;
  _id?: string;
  name?: string;
  phone?: string;
  district?: string;
  area?: string;
  beats?: string[] | string;
  activity?: string;
  [key: string]: any;
}

function normalizeReporterQuery(q: ReporterContactQuery = {}): URLSearchParams {
  const params = new URLSearchParams();
  // activity: map UI label "All activity" -> "all"
  const activityRaw = (q.activity ?? '').toString().trim();
  const activity = activityRaw.toLowerCase() === 'all activity' ? 'all' : activityRaw.toLowerCase();
  if (activity) params.set('activity', activity);

  // district/area/beats: omit if empty or "all"
  const district = (q.district ?? '').toString().trim();
  if (district && district.toLowerCase() !== 'all') params.set('district', district);

  const area = (q.area ?? '').toString().trim();
  if (area && area.toLowerCase() !== 'all') params.set('area', area);

  const beats = (q.beats ?? '').toString().trim();
  if (beats && beats.toLowerCase() !== 'all' && beats.toLowerCase() !== 'allbeats') params.set('beats', beats);

  // pagination: default limit 200
  const page = q.page ?? 1;
  const limit = q.limit ?? 200;
  params.set('page', String(page));
  params.set('limit', String(limit));

  return params;
}

export async function listReporterContacts(q: ReporterContactQuery = {}): Promise<ReporterContact[]> {
  const params = normalizeReporterQuery(q);
  const url = `/community/reporters?${params.toString()}`;
  const { data } = await adminApi.get(url);
  const rows = Array.isArray(data) ? data : (data?.items || data?.rows || []);
  return rows as ReporterContact[];
}

// --- Founder Feature Toggles (Community Reporter) ---
// ON = closed, OFF = open
export type FounderFeatureToggles = {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
  updatedAt?: string;
};

export async function getFounderFeatureToggles(): Promise<FounderFeatureToggles> {
  const res = await adminApi.get('/founder/feature-toggles');
  const raw = res.data as any;
  const s = raw?.settings ?? raw ?? {};
  return {
    communityReporterClosed: !!s.communityReporterClosed,
    reporterPortalClosed: !!s.reporterPortalClosed,
    updatedAt: s.updatedAt,
  };
}

export async function patchFounderFeatureToggles(
  patch: Partial<FounderFeatureToggles>
): Promise<FounderFeatureToggles> {
  const res = await adminApi.patch('/founder/feature-toggles', patch);
  const raw = res.data as any;
  const s = raw?.settings ?? raw ?? {};
  return {
    communityReporterClosed: !!s.communityReporterClosed,
    reporterPortalClosed: !!s.reporterPortalClosed,
    updatedAt: s.updatedAt,
  };
}
