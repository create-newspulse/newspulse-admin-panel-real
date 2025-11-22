import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import apiClient, { setAuthToken } from '@/lib/api';
import { loginAdmin, adminApi } from '@/lib/adminApi';

type User = { id: string; email: string; name?: string; role?: string };

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
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // hydration flag
  const [isRestoring, setIsRestoring] = useState(false);

  const STORAGE_KEY = 'newsPulseAdminAuth';
  const AUTH_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
  const SESSION_ENDPOINT = '/admin/me';

  // Consider cookie-session success (no token) as authenticated if we have user
  // Auth considered valid if we have a token or a resolved user
  const isAuthenticated = !!token || !!user;
  const isFounder = (user?.role || '').toLowerCase() === 'founder';

  // PRODUCTION ADMIN LOGIN (Vercel):
  // POST /admin/login on https://newspulse-backend-real.onrender.com
  // Expects response: { ok: true, user: {...}, ... } (token may be absent)
  const LOGIN_PATH = '/admin/login';

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
      const res = await adminApi.post(LOGIN_PATH, { email: trimmedEmail, password });
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
        setAuthToken(tokenVal);
        setTokenState(String(tokenVal));
      } else {
        setAuthToken(null);
        setTokenState(null);
      }

      const u = data.user || data.data?.user || {
        id: data.id,
        email: data.email,
        role: data.role,
        name: data.name,
      };
      const normalizedUser: User = {
        id: String(u.id || u._id || ''),
        email: String(u.email || ''),
        name: String(u.name || ''),
        role: String(u.role || ''),
      };
      setUser(normalizedUser);

      // Persist minimal auth info
      try {
        const persistPayload = { token: tokenVal, email: normalizedUser.email, role: normalizedUser.role, ts: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistPayload));
        if (import.meta.env.DEV) console.debug('[Auth] persistence write', persistPayload);
      } catch { /* ignore quota errors */ }
      if (import.meta.env.DEV) console.log('[Auth] login success', data);
      return true;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || (status === 401 ? 'Invalid email or password' : 'Login failed. Please try again.');
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
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    if (import.meta.env.DEV) console.debug('[Auth] logout cleared storage');
  }, []);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    if (import.meta.env.DEV) console.debug('[Auth] hydration start');
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw || '{}');
        const ageOk = !parsed.ts || (Date.now() - parsed.ts < AUTH_MAX_AGE_MS);
        if (!ageOk) {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          if (import.meta.env.DEV) console.debug('[Auth] stored session expired');
        } else {
          if (parsed.token) {
            setTokenState(String(parsed.token));
            setAuthToken(String(parsed.token));
          }
          if (parsed.email || parsed.role) {
            setUser(prev => prev || { id: '', email: String(parsed.email||''), name: '', role: String(parsed.role||'') });
          }
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Auth] localStorage hydration failed', e);
    } finally {
      setIsReady(true);
      if (import.meta.env.DEV) console.debug('[Auth] hydration complete');
    }
  }, []);

  const restoreSession = useCallback(async () => {
    // Avoid duplicate restores
    if (token || user || isRestoring) return;
    setIsRestoring(true);
    if (import.meta.env.DEV) console.debug('[Auth] attempting session restore');
    try {
      const res = await adminApi.get(SESSION_ENDPOINT, { withCredentials: true });
      const raw = res.data || {};
      const u = raw.user || raw.data?.user || raw.data || raw;
      if (u && (u.email || u.role)) {
        const restored: User = {
          id: String(u.id || u._id || ''),
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
      } else {
        if (import.meta.env.DEV) console.debug('[Auth] session restore no user');
      }
    } catch (e:any) {
      if (import.meta.env.DEV) console.warn('[Auth] session restore failed', e?.response?.status, e?.message);
    } finally {
      setIsRestoring(false);
    }
  }, [token, user, isRestoring]);

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
