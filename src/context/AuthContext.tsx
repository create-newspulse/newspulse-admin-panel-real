import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setAuthToken } from '@/lib/api';
import { adminApi } from '@/lib/adminApi';

type User = { id: string; _id?: string; email: string; name?: string; role?: string; avatar?: string; bio?: string };

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean; // derived from token OR user
  isFounder: boolean;
  isLoading: boolean; // network/loading state for login actions
  isReady: boolean; // localStorage hydration complete
  isRestoring: boolean; // true while calling session restore endpoint
  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: (reason?: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // hydration flag
  const [isRestoring, setIsRestoring] = useState(false);

  const STORAGE_KEY = 'newsPulseAdminAuth';
  const AUTH_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
  // Resolve relative to admin base; avoid double /api/admin
  const SESSION_ENDPOINT = '/me';

  // Consider cookie-session success (no token) as authenticated if we have user
  // Auth considered valid if we have a token or a resolved user
  const isAuthenticated = !!token || !!user;
  const role = (user?.role || '').toLowerCase();
  const isFounder = role === 'founder';

  // Dev-only logging to debug role-gating issues
  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('auth user role:', user?.role);
    }
  }, [user?.role]);

  // Resolve relative to admin base; avoid double '/admin' in path
  // Direct/base: <origin>/api/admin/login ; Proxy: /admin-api/admin/login
  const LOGIN_PATH = '/login';

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    const trimmedEmail = email.trim();
    if (import.meta.env.DEV) {
      console.log('[Auth] login request', {
        baseURL: adminApi.defaults.baseURL,
        path: LOGIN_PATH,
        email: trimmedEmail,
      });
    }
    try {
      const res = await adminApi.request({
        url: LOGIN_PATH,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send explicit JSON string (backend expects JSON body)
        data: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = res.data ?? {};
      const successFlag =
        data.ok === true ||
        data.success === true ||
        !!data.user ||
        !!data.token ||
        !!data.accessToken;

      if (!successFlag) {
        if (import.meta.env.DEV) console.warn('[Auth] unexpected login response shape', data);
        return false;
      }

      const tokenVal = data.token || data.accessToken || null;
      if (tokenVal) {
        const normalized = String(tokenVal).replace(/^Bearer\s+/i, '');
        setAuthToken(normalized);
        setTokenState(normalized);
        // Persist under both new and legacy keys so interceptors always find it
        try { localStorage.setItem('np_token', normalized); } catch {}
        try { localStorage.setItem('np_admin_access_token', normalized); } catch {}
        try { localStorage.setItem('np_admin_token', normalized); } catch {}
      } else {
        setAuthToken(null);
        setTokenState(null);
        try { localStorage.removeItem('np_token'); } catch {}
        try { localStorage.removeItem('np_admin_token'); } catch {}
        try { localStorage.removeItem('np_admin_access_token'); } catch {}
      }

      const u = data.user || data.data?.user || {
        id: data.id,
        email: data.email,
        role: data.role,
        name: data.name,
      };
      const normalizedUser: User = {
        id: String(u.id || u._id || ''),
        _id: String(u._id || u.id || ''),
        email: String(u.email || ''),
        name: String(u.name || ''),
        role: String(u.role || ''),
      };
      setUser(normalizedUser);

      // Persist minimal auth info
      try {
        const persistPayload = { token: tokenVal ? String(tokenVal).replace(/^Bearer\s+/i, '') : null, email: normalizedUser.email, role: normalizedUser.role, ts: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistPayload));
        if (import.meta.env.DEV) console.debug('[Auth] persistence write', persistPayload);
      } catch { /* ignore quota errors */ }
      if (import.meta.env.DEV) console.log('[Auth] login success', data);
      return true;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message
        || err?.response?.data?.error
        || err?.response?.data?.details
        || (status === 401 ? 'Invalid email or password' : 'Login failed. Please try again.');
      if (import.meta.env.DEV) {
        console.error('[Auth] Login error', {
          status,
          data: err?.response?.data,
          message: err?.message,
          surfacedMessage: msg,
          baseURL: adminApi.defaults.baseURL,
          path: LOGIN_PATH,
        });
      }

      // Invalid credentials -> keep UX calm and let login page show a friendly message.
      if (status === 401) return false;

      // Server errors should surface the real backend message to the UI.
      if (typeof status === 'number' && status >= 500) {
        const e = new Error(msg || 'Server error. Check backend logs.');
        (e as any).status = status;
        throw e;
      }

      // Network / unexpected errors: allow UI to show a clearer message.
      const e = new Error(msg || 'Network error - could not reach login API');
      (e as any).status = status;
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback((reason?: string) => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem('np_admin_token'); } catch {}
    try { localStorage.removeItem('np_admin_access_token'); } catch {}
    try { localStorage.removeItem('np_token'); } catch {}
    if (import.meta.env.DEV) console.debug('[Auth] logout cleared storage', { reason: reason || 'manual' });
    // Per spec: no hard reload redirects; keep /login public and don't redirect to itself.
    if (location.pathname !== '/login') {
      try { navigate('/login', { replace: true }); } catch {}
    }
  }, [location.pathname, navigate]);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    if (import.meta.env.DEV) console.debug('[Auth] hydration start');
    try {
      // Per spec: np_token is the canonical token key.
      try {
        const t = localStorage.getItem('np_token');
        if (t && String(t).trim()) {
          const normalized = String(t).replace(/^Bearer\s+/i, '');
          setTokenState(normalized);
          setAuthToken(normalized);
        }
      } catch {}

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw || '{}');
        const ageOk = !parsed.ts || (Date.now() - parsed.ts < AUTH_MAX_AGE_MS);
        if (!ageOk) {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          if (import.meta.env.DEV) console.debug('[Auth] stored session expired');
        } else {
          // Only use stored token if np_token was not present.
          if (!localStorage.getItem('np_token') && parsed.token) {
            const normalized = String(parsed.token).replace(/^Bearer\s+/i, '');
            setTokenState(normalized);
            setAuthToken(normalized);
            try { localStorage.setItem('np_token', normalized); } catch {}
            try { localStorage.setItem('np_admin_access_token', normalized); } catch {}
            try { localStorage.setItem('np_admin_token', normalized); } catch {}
          }
          if (parsed.email || parsed.role) {
            setUser(prev => prev || { id: '', email: String(parsed.email||''), name: '', role: String(parsed.role||'') });
          }
        }
      }
      // Fallback: if no structured storage found, try legacy token keys
      if (!localStorage.getItem(STORAGE_KEY)) {
        try {
          const legacy = localStorage.getItem('np_token') || localStorage.getItem('np_admin_access_token') || localStorage.getItem('np_admin_token');
          if (legacy && String(legacy).trim()) {
            const normalized = String(legacy).replace(/^Bearer\s+/i, '');
            setTokenState(normalized);
            setAuthToken(normalized);
          }
        } catch {}
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Auth] localStorage hydration failed', e);
    } finally {
      setIsReady(true);
      if (import.meta.env.DEV) console.debug('[Auth] hydration complete');
    }
  }, []);

  // Keep np_token in sync with in-memory token.
  useEffect(() => {
    if (!isReady) return;
    try {
      if (token && String(token).trim()) {
        const normalized = String(token).replace(/^Bearer\s+/i, '');
        try { localStorage.setItem('np_token', normalized); } catch {}
        // Back-compat keys still used in some legacy modules.
        try { localStorage.setItem('np_admin_access_token', normalized); } catch {}
        try { localStorage.setItem('np_admin_token', normalized); } catch {}
        setAuthToken(normalized);
      } else {
        try { localStorage.removeItem('np_token'); } catch {}
      }
    } catch {}
  }, [isReady, token]);

  // React to global logout/forbidden events emitted by interceptors
  useEffect(() => {
    function onLogout() {
      // Clear local state + storage; then route to /login (unless already there)
      logout('401');
    }
    function onForbidden() {
      // Only route if currently authenticated; otherwise let ProtectedRoute handle
      if (isAuthenticated) {
        try { navigate('/unauthorized', { replace: true }); } catch {}
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('np:logout', onLogout as any);
      window.addEventListener('np:forbidden', onForbidden as any);
      return () => {
        window.removeEventListener('np:logout', onLogout as any);
        window.removeEventListener('np:forbidden', onForbidden as any);
      };
    }
    return () => {};
  }, [isAuthenticated, navigate, logout]);

  // Track attempted restore to prevent loops
  const restoreAttemptedRef = useRef(false);

  const restoreSession = useCallback(async () => {
    // Skip if already restoring or already attempted with a fully hydrated user profile.
    // NOTE: A token alone is NOT enough for role-gated routes; we must fetch /me to get role.
    const hasFullAuth = !!(user && String(user.role || '').trim());
    if (isRestoring || restoreAttemptedRef.current || hasFullAuth) return;
    restoreAttemptedRef.current = true;
    setIsRestoring(true);
    if (import.meta.env.DEV) console.debug('[Auth] attempting session restore (no full auth)');
    try {
      const res = await adminApi.get(SESSION_ENDPOINT, { withCredentials: true });
      const raw = res.data || {};
      const u = raw.user || raw.data?.user || raw.data || raw;
      if (u && (u.email || u.role)) {
        const restored: User = {
          id: String(u.id || u._id || ''),
          _id: String(u._id || u.id || ''),
          email: String(u.email || ''),
          name: String(u.name || ''),
          role: String(u.role || ''),
        };
        setUser(restored);
        try {
          const persistPayload = { token: token, email: restored.email, role: restored.role, ts: Date.now() };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(persistPayload));
          if (import.meta.env.DEV) console.debug('[Auth] restore persistence write', persistPayload);
        } catch {}
        if (import.meta.env.DEV) console.debug('[Auth] session restore success');
      } else if (import.meta.env.DEV) {
        console.debug('[Auth] session restore no user returned');
      }
    } catch (e:any) {
      const st = e?.response?.status;
      // Treat 404 as non-fatal (no profile) and avoid noisy warning
      if (st === 401) {
        // 401 should redirect to login via interceptors (no scary logs)
      } else if (import.meta.env.DEV && st !== 404) {
        console.warn('[Auth] session restore failed', st, e?.message);
      }
    } finally {
      setIsRestoring(false);
    }
  }, [token, user, isRestoring]);

  // Trigger restore after hydration if we are missing profile/role (token alone is not enough for role-gated routes)
  useEffect(() => {
    if (!isReady) return;
    const missingProfileOrRole = !user || !String(user.role || '').trim();
    if (missingProfileOrRole) {
      restoreSession();
    }
  }, [isReady, user, restoreSession]);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated,
    isFounder,
    isLoading,
    isReady,
    isRestoring,
    restoreSession,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export default AuthProvider;
