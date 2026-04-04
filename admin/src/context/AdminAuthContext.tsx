import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { clearAdminSessionStorage, persistResolvedAdminSession, resolveAdminSession, type AdminSessionSource } from '../lib/authSession';

export interface AdminAuthState {
  token: string | null;
  email?: string;
  role?: string;
  isFounder?: boolean;
  source?: AdminSessionSource;
  hasMismatch?: boolean;
}

export interface AdminAuthContextValue {
  auth: AdminAuthState;
  isReady: boolean; // false while bootstrapping from localStorage
  login: (data: { token: string; email?: string; role?: string }) => void;
  logout: () => void;
}

const LS_KEY = 'newsPulseAdminAuth';

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export const AdminAuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [auth, setAuth] = useState<AdminAuthState>({ token: null });
  const [isReady, setIsReady] = useState(false);

  // Hydrate once
  useEffect(() => {
    try {
      const resolved = resolveAdminSession();
      setAuth(resolved);
      if (resolved.token) persistResolvedAdminSession(resolved);
    } catch (e) {
      // Silently ignore hydration errors in legacy admin build
    } finally {
      setIsReady(true);
    }
  }, []);

  const login = useCallback((data: { token: string; email?: string; role?: string }) => {
    const next = resolveAdminSession().token === data.token
      ? resolveAdminSession()
      : { ...resolveAdminSession(), token: data.token, email: data.email, role: data.role, isFounder: (data.role || '').toLowerCase() === 'founder', source: 'newsPulseAdminAuth', hasMismatch: false };
    setAuth(next);
    persistResolvedAdminSession(next);
  }, []);

  const logout = useCallback(() => {
    setAuth({ token: null, source: 'none', isFounder: false, hasMismatch: false });
    clearAdminSessionStorage();
  }, []);

  const value: AdminAuthContextValue = { auth, isReady, login, logout };
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};
