import axios from 'axios';

// Standardize base URL: prefer VITE_ADMIN_API_BASE_URL or proxy '/admin-api', then append '/api/admin'.
const envAny = import.meta.env as any;
const rawHost = (
  envAny.VITE_ADMIN_API_BASE_URL ||
  envAny.VITE_ADMIN_API_URL ||
  ''
).toString().trim();
const baseHost = rawHost || 'http://localhost:5000';
export const adminRoot = `${baseHost.replace(/\/+$/, '')}/api/admin`;

export const ADMIN_API_BASE = adminRoot;
export const adminApi = axios.create({ baseURL: adminRoot, withCredentials: true });

// Unified token retrieval for reuse across components/utilities.
// Order of precedence:
// 1. newsPulseAdminAuth.accessToken (stored auth object)
// 2. np_admin_access_token
// 3. np_admin_token
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Spec requires using 'adminToken' from localStorage
  try {
    const token = localStorage.getItem('adminToken');
    return token ? String(token) : null;
  } catch {
    return null;
  }
}

// Attach Authorization header from localStorage (JWT) for all requests
adminApi.interceptors.request.use((config) => {
  try {
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
        try { localStorage.removeItem('adminToken'); } catch {}
        try { console.warn('[adminApi] Session expired (401). Redirecting to /admin/login'); } catch {}
        if (typeof window !== 'undefined') {
          const alreadyOnLogin = window.location.pathname.includes('/admin/login') || window.location.pathname.includes('/login');
          if (!alreadyOnLogin) window.location.href = '/admin/login';
        }
      }
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

// Resolve a path with awareness of proxy base. If using '/admin-api' remove leading '/api/'.
// Resolve an API path relative to the chosen base.
// For proxy base '/admin-api' we strip a leading '/api/' segment so rewrite matches.
// For direct base we prepend the full origin.
export function resolveAdminPath(p: string): string {
  const clean = p.startsWith('/') ? p : `/${p}`;
  const normalized = clean.replace(/^\/api\//, '/').replace(/^\/admin\//, '/');
  return `${adminRoot}${normalized}`;
}

// Diagnostic (dev + prod) to confirm chosen base.
try { console.info('[adminApi] base resolved =', adminRoot); } catch {}

// OTP Password Reset helpers (backend exposes /api/auth/otp/*)
// New unified OTP helpers using resolveAdminPath so proxy base works.
// Helper to build OTP paths relative to chosen base without duplicating '/admin-api'
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
