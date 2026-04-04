export type AdminSessionSource = 'cookie' | 'newsPulseAdminAuth' | 'legacy-localStorage' | 'none';

export interface ResolvedAdminSession {
  token: string | null;
  email?: string;
  role?: string;
  isFounder: boolean;
  source: AdminSessionSource;
  hasMismatch: boolean;
}

function decodeJwtPayload(token?: string | null): Record<string, unknown> | null {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readCookieToken(): string | null {
  try {
    const cookie = typeof document !== 'undefined' ? String(document.cookie || '') : '';
    const match = cookie.match(/(?:^|;\s*)np_admin=([^;]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]).replace(/^Bearer\s+/i, '');
    }
  } catch {}
  return null;
}

function readNewsPulseAdminAuth() {
  try {
    const raw = localStorage.getItem('newsPulseAdminAuth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const token = parsed?.token ? String(parsed.token).replace(/^Bearer\s+/i, '') : null;
    if (!token) return null;
    return {
      token,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      role: typeof parsed.role === 'string' ? parsed.role : undefined,
      source: 'newsPulseAdminAuth' as const,
    };
  } catch {
    return null;
  }
}

function readLegacyLocalStorage() {
  try {
    const legacyKeys = ['admin_token', 'np_token', 'np_admin_token', 'adminToken'];
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key);
      if (value && String(value).trim()) {
        return {
          token: String(value).replace(/^Bearer\s+/i, ''),
          source: 'legacy-localStorage' as const,
        };
      }
    }
  } catch {}
  return null;
}

function deriveRole(payload: Record<string, unknown> | null, fallbackRole?: string): string | undefined {
  const direct = typeof payload?.role === 'string' ? payload.role : undefined;
  if (direct) return direct;

  const roles = payload?.roles;
  if (Array.isArray(roles)) {
    const founderRole = roles.find((value) => typeof value === 'string' && String(value).trim().toLowerCase() === 'founder');
    if (typeof founderRole === 'string') return founderRole;
    const firstString = roles.find((value) => typeof value === 'string');
    if (typeof firstString === 'string') return firstString;
  }

  return fallbackRole;
}

function deriveEmail(payload: Record<string, unknown> | null, fallbackEmail?: string): string | undefined {
  const direct = typeof payload?.email === 'string'
    ? payload.email
    : typeof payload?.userEmail === 'string'
      ? payload.userEmail
      : typeof payload?.preferred_username === 'string'
        ? payload.preferred_username
        : undefined;
  return direct || fallbackEmail;
}

function isExpired(payload: Record<string, unknown> | null): boolean {
  const exp = payload?.exp;
  if (typeof exp !== 'number') return false;
  return (exp * 1000) <= Date.now();
}

function buildResolvedSession(candidate: { token: string | null; email?: string; role?: string; source: AdminSessionSource } | null, hasMismatch: boolean): ResolvedAdminSession {
  const token = candidate?.token ? String(candidate.token) : null;
  const payload = decodeJwtPayload(token);
  const role = deriveRole(payload, candidate?.role);
  const email = deriveEmail(payload, candidate?.email);
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : undefined;

  return {
    token,
    email,
    role: normalizedRole,
    isFounder: normalizedRole === 'founder',
    source: candidate?.source || 'none',
    hasMismatch,
  };
}

export function resolveAdminSession(): ResolvedAdminSession {
  const cookieToken = readCookieToken();
  const cookiePayload = decodeJwtPayload(cookieToken);

  const stored = readNewsPulseAdminAuth();
  const storedPayload = decodeJwtPayload(stored?.token || null);

  const legacy = readLegacyLocalStorage();
  const legacyPayload = decodeJwtPayload(legacy?.token || null);

  const hasMismatch = !!(
    cookieToken
    && stored?.token
    && cookieToken !== stored.token
  );

  if (cookieToken && !isExpired(cookiePayload)) {
    return buildResolvedSession({ token: cookieToken, source: 'cookie' }, hasMismatch);
  }

  if (stored?.token && !isExpired(storedPayload)) {
    return buildResolvedSession(stored, hasMismatch);
  }

  if (legacy?.token && !isExpired(legacyPayload)) {
    return buildResolvedSession(legacy, hasMismatch);
  }

  if (cookieToken) return buildResolvedSession({ token: cookieToken, source: 'cookie' }, hasMismatch);
  if (stored?.token) return buildResolvedSession(stored, hasMismatch);
  if (legacy?.token) return buildResolvedSession(legacy, hasMismatch);

  return buildResolvedSession(null, false);
}

export function persistResolvedAdminSession(session: ResolvedAdminSession) {
  try {
    if (!session.token) {
      localStorage.removeItem('newsPulseAdminAuth');
      return;
    }
    localStorage.setItem('newsPulseAdminAuth', JSON.stringify({
      token: session.token,
      email: session.email,
      role: session.role,
      source: session.source,
    }));
  } catch {}
}

export function clearAdminSessionStorage() {
  try {
    localStorage.removeItem('newsPulseAdminAuth');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('np_token');
    localStorage.removeItem('np_admin_token');
    localStorage.removeItem('adminToken');
  } catch {}
}