import axios from 'axios';

// OPTION A (Direct): Set VITE_ADMIN_API_BASE_URL to full backend origin (no trailing /api).
// OPTION B (Rewrite): Set VITE_ADMIN_API_BASE_URL=/admin-api and configure vercel.json rewrite.
// We now strictly honor the explicit env variable when present; no automatic host sniffing.
let rawBase = (import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined)?.trim() || '';
if (!rawBase) rawBase = '/admin-api'; // fallback to proxy path when not provided
// Canonicalize accidental duplication
rawBase = rawBase.replace(/\/admin-api\/api$/,'/admin-api');
rawBase = rawBase.replace(/\/admin-api\/$/,'/admin-api');

// Remove any trailing slashes without using a regex
function stripTrailingSlashes(url: string): string {
  let out = (url || "").trim();
  while (out.endsWith("/")) {
    out = out.slice(0, -1);
  }
  return out;
}

// Clean backend host (no path suffix)
export const adminRoot = stripTrailingSlashes(rawBase);

// Shared axios client for admin APIs
export const adminApi = axios.create({ baseURL: adminRoot, withCredentials: true });

// Dev-only request/response logging (minimal in prod)
if (import.meta.env.DEV) {
  adminApi.interceptors.request.use((cfg) => {
    try {
      console.debug('[adminApi:req]', cfg.method?.toUpperCase(), cfg.baseURL ? cfg.baseURL + (cfg.url || '') : cfg.url, cfg.headers);
    } catch {}
    return cfg;
  });
  adminApi.interceptors.response.use(
    (res) => {
      try {
        console.debug('[adminApi:res]', res.status, res.config.url, res.headers['content-type']);
        const ct = (res.headers['content-type'] || '').toString();
        if (!/application\/json/i.test(ct)) {
          console.error('⚠ Non-JSON response detected. Likely misconfigured base URL or rewrite.', ct);
        }
      } catch {}
      return res;
    },
    (err) => {
      const res = err?.response;
      try {
        console.error('[adminApi:err]', res?.status, res?.config?.url, res?.headers?.['content-type']);
        const ct = (res?.headers?.['content-type'] || '').toString();
        if (/text\/html/i.test(ct)) {
          console.error('❌ HTML received instead of JSON. Check VITE_ADMIN_API_BASE_URL or Vercel rewrite.');
        }
      } catch {}
      return Promise.reject(err);
    }
  );
}

// Resolve a path with awareness of proxy base. If using '/admin-api' remove leading '/api/'.
// Resolve an API path relative to the chosen base.
// For proxy base '/admin-api' we strip a leading '/api/' segment so rewrite matches.
// For direct base we prepend the full origin.
export function resolveAdminPath(p: string): string {
  const clean = p.startsWith('/') ? p : `/${p}`;
  if (adminRoot === '/admin-api') {
    if (clean.startsWith('/api/')) return `/admin-api${clean.replace(/^\/api\//, '/')}`; // /admin-api/system/health
    return `/admin-api${clean}`;
  }
  // direct host
  if (clean.startsWith('/api/')) return `${adminRoot}${clean}`; // origin + /api/... path
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

export async function requestPasswordResetOtp(email: string) {
  const path = otpEndpoint('request');
  const res = await adminApi.post(path, { email });
  return res.data;
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
