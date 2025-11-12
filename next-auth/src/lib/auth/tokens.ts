import jwt, { SignOptions } from 'jsonwebtoken';
import { cookies } from 'next/headers';

const ACCESS_NAME = 'np_access';
const REFRESH_NAME = 'np_refresh';
const MFA_TICKET_NAME = 'np_mfa';

export function signAccess(payload: object) {
  const expMinutes = Number(process.env.ACCESS_TOKEN_TTL_MIN || 15);
  const opts: SignOptions = { expiresIn: expMinutes * 60 }; // seconds
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, opts);
}
export function signRefresh(payload: object) {
  const expDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14);
  const opts: SignOptions = { expiresIn: expDays * 24 * 60 * 60 }; // seconds
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, opts);
}
export function setAuthCookies({ access, refresh }: { access: string; refresh: string; }) {
  const domain = process.env.AUTH_COOKIE_DOMAIN;
  // Use secure cookies in production; allow opting in via env for other envs behind HTTPS proxies
  const isSecure = process.env.FORCE_SECURE_COOKIES === '1' || process.env.NODE_ENV === 'production';
  const c = cookies();
  const base = { httpOnly:true, secure:isSecure as boolean, sameSite:'strict' as const, path:'/' };
  if (domain) {
    c.set(ACCESS_NAME, access, { ...base, domain });
    c.set(REFRESH_NAME, refresh, { ...base, domain });
  } else {
    c.set(ACCESS_NAME, access, base);
    c.set(REFRESH_NAME, refresh, base);
  }
}
export function clearAuthCookies() {
  const domain = process.env.AUTH_COOKIE_DOMAIN;
  const isSecure = process.env.FORCE_SECURE_COOKIES === '1' || process.env.NODE_ENV === 'production';
  const c = cookies();
  const del = { httpOnly:true, secure:isSecure as boolean, sameSite:'strict' as const, path:'/', maxAge:0 };
  // Clear host-only cookies
  c.set(ACCESS_NAME, '', del);
  c.set(REFRESH_NAME, '', del);
  // Also try clearing domain-scoped cookies if configured
  if (domain) {
    c.set(ACCESS_NAME, '', { ...del, domain });
    c.set(REFRESH_NAME, '', { ...del, domain });
  }
}
export function decodeAccessFromCookies(cookieHeader: string) {
  const m = /(?:^|;\s*)np_access=([^;]+)/.exec(cookieHeader || '');
  const access = m?.[1] || '';
  try { const user = jwt.verify(access, process.env.JWT_ACCESS_SECRET!) as any; return { user }; }
  catch { return { user: null }; }
}
export function decodeRefreshFromCookies(cookieHeader: string) {
  const m = /(?:^|;\s*)np_refresh=([^;]+)/.exec(cookieHeader || '');
  const refresh = m?.[1] || '';
  try { const token = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET!) as any; return { token } }
  catch { return { token: null } }
}
export function signMfaTicket(payload: object) {
  const ttlMin = Number(process.env.MFA_TICKET_TTL_MIN || 5);
  const opts: SignOptions = { expiresIn: ttlMin * 60 };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, opts);
}
export function setMfaTicket(ticket: string) {
  const domain = process.env.AUTH_COOKIE_DOMAIN;
  const isSecure = process.env.FORCE_SECURE_COOKIES === '1' || process.env.NODE_ENV === 'production';
  const c = cookies();
  if (domain) c.set(MFA_TICKET_NAME, ticket, { httpOnly:true, secure:isSecure, sameSite:'strict', path:'/', domain });
  else c.set(MFA_TICKET_NAME, ticket, { httpOnly:true, secure:isSecure, sameSite:'strict', path:'/', });
}
export function clearMfaTicket() {
  const domain = process.env.AUTH_COOKIE_DOMAIN;
  const isSecure = process.env.FORCE_SECURE_COOKIES === '1' || process.env.NODE_ENV === 'production';
  const c = cookies();
  c.set(MFA_TICKET_NAME, '', { httpOnly:true, secure:isSecure, sameSite:'strict', path:'/', maxAge:0 });
  if (domain) c.set(MFA_TICKET_NAME, '', { httpOnly:true, secure:isSecure, sameSite:'strict', path:'/', domain, maxAge:0 });
}
export function decodeMfaTicket(cookieHeader: string) {
  const m = /(?:^|;\s*)np_mfa=([^;]+)/.exec(cookieHeader || '');
  const t = m?.[1] || '';
  try { const ticket = jwt.verify(t, process.env.JWT_ACCESS_SECRET!) as any; return { ticket } }
  catch { return { ticket: null } }
}
export const cookieNames = { ACCESS_NAME, REFRESH_NAME, MFA_TICKET_NAME };
