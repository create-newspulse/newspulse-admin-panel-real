import axios from "axios";

const rawBase =
  (import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://newspulse-backend-real.onrender.com";

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
export const adminApi = axios.create({
  baseURL: adminRoot,
  withCredentials: true,
});

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
