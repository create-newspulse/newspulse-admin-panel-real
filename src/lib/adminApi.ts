import axios from "axios";

// Decide API base: prefer proxy mode (relative /admin-api) in production unless forced.
const forceDirect = (import.meta.env.VITE_FORCE_DIRECT_BACKEND as string | undefined) === '1';
let rawBase = (import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined) || (import.meta.env.VITE_API_URL as string | undefined) || '';
if (!forceDirect) {
  // If running on Vercel/admin domain and not explicitly forcing direct, use relative path so CORS avoided via rewrite.
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const isProdHost = /vercel\.app$/i.test(host) || /admin\.newspulse\.co\.in$/i.test(host);
  if (isProdHost) {
    rawBase = '/admin-api';
  }
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

// OTP Password Reset helpers (backend exposes /api/auth/otp/*)
export async function requestPasswordOtp(email: string) {
  const res = await adminApi.post('/api/auth/otp/request', { email });
  return res.data;
}

export async function verifyPasswordOtp(email: string, otp: string) {
  const res = await adminApi.post('/api/auth/otp/verify', { email, otp });
  return res.data;
}

export async function resetPasswordWithOtp(email: string, otp: string, password: string) {
  // Backend expects { email, code, newPassword } OR { email, resetToken, newPassword }
  // We currently pass the original OTP code path. Rename keys to match backend contract.
  const res = await adminApi.post('/api/auth/otp/reset', { email, code: otp, newPassword: password });
  return res.data;
}

export async function resetPasswordWithToken(email: string, resetToken: string, password: string) {
  const res = await adminApi.post('/api/auth/otp/reset', { email, resetToken, newPassword: password });
  return res.data;
}
