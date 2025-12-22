import axios from 'axios';

// Standardize base URL:
// - Proxy mode (preferred): use same-origin '/admin-api' and let the proxy forward to backend.
// - Direct mode: set VITE_API_URL to a valid backend origin (no /api suffix).
const envAny = import.meta.env as any;
const rawHost0 = (envAny.VITE_API_URL || '').toString().trim();
let rawHost = (rawHost0 === 'undefined' || rawHost0 === 'null') ? '' : rawHost0;

const useProxy = String(envAny.VITE_USE_PROXY || '').toLowerCase() === 'true' && import.meta.env.DEV;

// (Kept minimal: this module now defaults to proxy mode when VITE_API_URL is unset.)

function isValidAbsoluteUrl(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

// Reject placeholder values and invalid absolute URLs.
if (/[<>]/.test(rawHost)) rawHost = '';
if (rawHost) {
  const hasApiSuffix = /\/api$/i.test(rawHost);
  const withoutApi = hasApiSuffix ? rawHost.replace(/\/api$/i, '') : rawHost;
  if (!isValidAbsoluteUrl(withoutApi)) rawHost = '';
  else rawHost = withoutApi;
}
// Proxy mode (Vercel + local dev): use '/admin-api' and let proxy map to backend '/api/*'.
function absolutizeIfRelativeBase(maybeRelative: string) {
  const s = (maybeRelative || '').toString();
  if (/^https?:\/\//i.test(s)) return s;
  if (!s.startsWith('/')) return s;
  try {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return `${window.location.origin}${s}`;
    }
  } catch {}
  return s;
}

let baseHost = rawHost ? rawHost : '';
if (!baseHost) {
  // Default to proxy mode in both DEV and PROD.
  baseHost = '/admin-api';
}

// DEV: if explicitly using proxy, always use same-origin /admin-api.
if (useProxy) baseHost = '/admin-api';

const baseHostAbs = absolutizeIfRelativeBase(baseHost);

// Base selection rules:
// - If base is '/admin-api', route through the same DEV contract as other calls:
//   '/admin-api/api/admin/*' (Vite proxy strips '/admin-api' and backend receives '/api/admin/*').
// - If base ends with '/api', admin endpoints are under '{base}/admin/*'.
// - Otherwise (origin without /api suffix), admin endpoints are under '{base}/api/admin/*'.
const trimmed = baseHostAbs.replace(/\/+$/, '');
export const adminRoot = /\/admin-api$/i.test(trimmed)
  ? `${trimmed}/api/admin`
  : (/\/api$/i.test(trimmed) ? `${trimmed}/admin` : `${trimmed}/api/admin`);

export const ADMIN_API_BASE = adminRoot;
export const adminApi = axios.create({ baseURL: adminRoot, withCredentials: true });

// Unified token retrieval for reuse across components/utilities.
// Order of precedence:
// 1. newsPulseAdminAuth.accessToken (stored auth object)
// 2. np_admin_access_token
// 3. np_admin_token
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Prefer unified keys set by AuthContext/Login
    const keys = ['np_admin_access_token', 'np_admin_token', 'adminToken'];
    for (const k of keys) {
      const val = localStorage.getItem(k);
      if (val && String(val).trim().length > 0) return String(val);
    }
    return null;
  } catch {
    return null;
  }
}

// Attach Authorization header from localStorage (JWT) for all requests
adminApi.interceptors.request.use((config) => {
  try {
    // Ensure absolute baseURL in browser (relative base URLs can trigger URL-constructor failures)
    const base0 = (config.baseURL || adminApi.defaults.baseURL || '').toString();
    if (base0.startsWith('/')) {
      try {
        if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
          config.baseURL = `${window.location.origin}${base0}`;
        }
      } catch {}
    }

    const token = getAuthToken();
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// Always log error responses in the requested format, then rethrow
// Throttled / deduplicated error logging to avoid console flood
adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || error?.response?.config?.url || '';
    const ct = error?.response?.headers?.['content-type'];
    // Clean 401 handling: clear token and redirect once to /admin/login
    if (status === 401) {
      // Skip auto-logout for Community Reporter Queue endpoint; let page show error banner
      const isCommunityQueue = typeof url === 'string' && url.includes('/community-reporter/queue');
      if (!isCommunityQueue) {
        try {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('np_admin_token');
          localStorage.removeItem('np_admin_access_token');
          localStorage.removeItem('newsPulseAdminAuth');
        } catch {}
        try { console.warn('[adminApi] Session expired (401) – logging out'); } catch {}
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:logout')); } catch {}
      }
    }
    // 403 → treat as Owner Key required for Safe Owner Zone actions.
    // (Do not redirect to Access Denied for Owner Key lock.)
    if (status === 403) {
      try { (error as any).isOwnerKeyRequired = true; } catch {}
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('np:ownerkey-required')); } catch {}
    }
    // Reduce spam: avoid logging route-not-found noise for monitor endpoints
    const suppress = (status === 404 && (/\/system\/monitor-hub$/.test(url) || /\/api\/admin\/me$/.test(url)));
    if (!suppress) {
      try { console.error('[adminApi:err]', status, url, ct); } catch {}
    }
    return Promise.reject(error);
  }
);

// Dev-only request/response success logging to aid debugging
if (import.meta.env.DEV) {
  adminApi.interceptors.request.use((cfg) => {
    try { console.debug('[adminApi:req]', cfg.method?.toUpperCase(), cfg.baseURL ? cfg.baseURL + (cfg.url || '') : cfg.url); } catch {}
    return cfg;
  });
  adminApi.interceptors.response.use((res) => {
    try { console.debug('[adminApi:res]', res.status, res.config.url, res.headers['content-type']); } catch {}
    return res;
  });
}

// Resolve an API path relative to the chosen base.
// Avoid duplicated '/api/api' and tolerate callers passing '/api/...'.
export function resolveAdminPath(p: string): string {
  const clean = p.startsWith('/') ? p : `/${p}`;
  const normalized = clean.replace(/^\/api\//, '/').replace(/^\/admin\//, '/');
  return `${adminRoot}${normalized}`;
}

// Diagnostic (dev + prod) to confirm chosen base.
try { console.info('[adminApi] base resolved =', adminRoot); } catch {}

// OTP Password Reset helpers (backend exposes /api/auth/otp/*)
// Helper to build OTP paths relative to chosen base.
function otpEndpoint(segment: string) {
  // If the direct origin includes '/api', avoid duplicating it
  if (/\/api$/.test(adminRoot)) return `/auth/otp/${segment}`;
  return `/api/auth/otp/${segment}`;
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
    const res = await adminApi.post(path, { email });
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
  return (await adminApi.post(path, { email, otp })).data;
}

export async function resetPasswordWithOtp(email: string, otp: string, password: string) {
  const path = otpEndpoint('reset');
  return (await adminApi.post(path, { email, code: otp, newPassword: password })).data;
}

export async function resetPasswordWithToken(email: string, resetToken: string, password: string) {
  const path = otpEndpoint('reset');
  return (await adminApi.post(path, { email, resetToken, newPassword: password })).data;
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
