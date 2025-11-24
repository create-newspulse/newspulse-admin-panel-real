import axios from 'axios';

// Single source of truth for admin API base URL.
// Prefer explicit env override, fallback to production backend origin.
const explicitEnv = (import.meta.env.VITE_ADMIN_API_URL || '').trim();
const FALLBACK_ADMIN_BASE = 'https://newspulse-backend-real.onrender.com';
export const adminRoot = explicitEnv || FALLBACK_ADMIN_BASE; // retain exported name for existing imports
export const adminApi = axios.create({ baseURL: adminRoot, withCredentials: true });

// Attach Authorization header from localStorage (JWT) for all requests
adminApi.interceptors.request.use((config) => {
  try {
    let token: string | null = null;
    if (typeof window !== 'undefined') {
      // 1. newsPulseAdminAuth.accessToken first
      try {
        const raw = localStorage.getItem('newsPulseAdminAuth');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.accessToken) token = String(parsed.accessToken);
        }
      } catch {}
      // 2. fallback to np_admin_access_token then np_admin_token
      if (!token) token = localStorage.getItem('np_admin_access_token');
      if (!token) token = localStorage.getItem('np_admin_token');
    }
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
    // Auto-redirect on 401 for protected admin API paths
    if (status === 401 && /\/api\/admin\//.test(url)) {
      try {
        localStorage.removeItem('newsPulseAdminAuth');
        localStorage.removeItem('np_admin_token');
        localStorage.removeItem('np_admin_access_token');
      } catch {}
      try { console.warn('[adminApi] 401 detected – redirecting to /admin/login'); } catch {}
      if (typeof window !== 'undefined') {
        // Avoid infinite loops if already on login
        if (!window.location.pathname.includes('/admin/login')) {
          window.location.href = '/admin/login';
        }
      }
    }
    // Suppress noisy 404 for /api/admin/me specifically
    if (!(status === 404 && url.endsWith('/api/admin/me'))) {
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
  // Always resolve relative to the chosen base URL
  return `${adminRoot}${clean}`;
}

// Diagnostic (dev + prod) to confirm chosen base.
try { console.info('[adminApi] base resolved =', adminRoot); } catch {}

// OTP Password Reset helpers (backend exposes /api/auth/otp/*)
// New unified OTP helpers using resolveAdminPath so proxy base works.
// Helper to build OTP paths relative to chosen base without duplicating '/admin-api'
function otpEndpoint(segment: string) {
  // When using proxy base '/admin-api' we call '/auth/otp/*' (legacy absolute mounted at root)
  // When using a direct origin (not exactly '/admin-api') we assume backend exposes '/api/auth/otp/*'
  if (adminRoot === '/admin-api') return `/auth/otp/${segment}`;
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
  const paths = [resolveAdminPath('/admin/login'), resolveAdminPath('/api/admin/login')];
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
