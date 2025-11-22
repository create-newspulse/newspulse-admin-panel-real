import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // hydration flag

  const STORAGE_KEY = 'newsPulseAdminAuth';

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
        const persistPayload = { token: tokenVal, email: normalizedUser.email, role: normalizedUser.role };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistPayload));
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
  }, []);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw || '{}');
        if (parsed.token) {
          setTokenState(String(parsed.token));
          setAuthToken(String(parsed.token));
        }
        if (parsed.email || parsed.role) {
          setUser(prev => prev || { id: '', email: String(parsed.email||''), name: '', role: String(parsed.role||'') });
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Auth] localStorage hydration failed', e);
    } finally {
      setIsReady(true);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated,
    isFounder,
    isLoading,
    isReady,
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
