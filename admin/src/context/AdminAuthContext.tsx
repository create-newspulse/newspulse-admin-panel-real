import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface AdminAuthState {
  token: string | null;
  email?: string;
}

export interface AdminAuthContextValue {
  auth: AdminAuthState;
  isReady: boolean; // false while bootstrapping from localStorage
  login: (data: { token: string; email?: string }) => void;
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
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setAuth({ token: parsed.token || null, email: parsed.email });
        }
      }
    } catch (e) {
      // Silently ignore hydration errors in legacy admin build
    } finally {
      setIsReady(true);
    }
  }, []);

  const login = useCallback((data: { token: string; email?: string }) => {
    const next: AdminAuthState = { token: data.token, email: data.email };
    setAuth(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const logout = useCallback(() => {
    setAuth({ token: null });
    try { localStorage.removeItem(LS_KEY); } catch {}
  }, []);

  const value: AdminAuthContextValue = { auth, isReady, login, logout };
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};
