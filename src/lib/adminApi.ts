import axios from 'axios';

// Decide API base: prefer proxy mode (relative /admin-api) in production unless forced.
const forceDirect = (import.meta.env.VITE_FORCE_DIRECT_BACKEND as string | undefined) === '1';
let rawBase = (import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined) || (import.meta.env.VITE_API_URL as string | undefined) || '';
if (!forceDirect) {
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const isProdHost = /vercel\.app$/i.test(host) || /admin\.newspulse\.co\.in$/i.test(host);
  if (isProdHost) rawBase = '/admin-api';
}
if (!rawBase) rawBase = '/admin-api';

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

// Resolve a path with awareness of proxy base. If using '/admin-api' remove leading '/api/'.
export function resolveAdminPath(p: string): string {
  if (adminRoot.startsWith('/admin-api') && p.startsWith('/api/')) return p.replace(/^\/api\//, '/');
  return p;
}

// Diagnostic (dev + prod) to confirm chosen base.
try { console.info('[adminApi] base resolved =', adminRoot, 'forceDirect=', forceDirect); } catch {}

// OTP Password Reset helpers (backend exposes /api/auth/otp/*)
// New unified OTP helpers using resolveAdminPath so proxy base works.
export async function requestPasswordResetOtp(email: string) {
  // Prefer legacy absolute path /auth/otp/request (backend exposes both relative & absolute)
  const path = resolveAdminPath('/api/auth/otp/request');
  const alt = resolveAdminPath('/auth/otp/request');
  try {
    const res = await adminApi.post(path, { email });
    return res.data;
  } catch (e: any) {
    // Fallback to absolute if first fails (e.g., route mount differences)
    try {
      const res2 = await adminApi.post(alt, { email });
      return res2.data;
    } catch {
      throw e;
    }
  }
}

export async function verifyPasswordOtp(email: string, otp: string) {
  const path = resolveAdminPath('/api/auth/otp/verify');
  return (await adminApi.post(path, { email, otp })).data;
}

export async function resetPasswordWithOtp(email: string, otp: string, password: string) {
  const path = resolveAdminPath('/api/auth/otp/reset');
  return (await adminApi.post(path, { email, code: otp, newPassword: password })).data;
}

export async function resetPasswordWithToken(email: string, resetToken: string, password: string) {
  const path = resolveAdminPath('/api/auth/otp/reset');
  return (await adminApi.post(path, { email, resetToken, newPassword: password })).data;
}
