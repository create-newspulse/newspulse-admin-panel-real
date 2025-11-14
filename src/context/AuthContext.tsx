// 📁 src/context/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { API_BASE_PATH, setAuthToken, AuthAPI, ADMIN_BACKEND_FALLBACK } from '../lib/api';
import { User } from '../types/User';

// ✅ Auth context type
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isFounder: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 🛡️ SECURE: Environment-controlled demo access
  const demoModeEnv = import.meta.env.VITE_DEMO_MODE;
  const isVercelPreview = window.location.hostname.includes('vercel.app');
  
  // 🔒 Auto-login logic: Only on Vercel when NOT explicitly disabled
  const allowAutoLogin = demoModeEnv !== 'false' && isVercelPreview;
  
  // Debug logging
  console.log('🔧 AuthContext Debug:', {
    demoModeEnv,
    isVercelPreview,
    allowAutoLogin,
    hostname: window.location.hostname
  });

  useEffect(() => {
    const init = async () => {
      // Hydrate auth token into API client if present
      const existingToken = localStorage.getItem('adminToken');
      if (existingToken) setAuthToken(existingToken);
      // If user just logged out, temporarily suppress auto re-auth from cookie
  const recentLogoutAt = Number(sessionStorage.getItem('np_recent_logout') || '0');
  const justLoggedOut = recentLogoutAt && (Date.now() - recentLogoutAt < 20000);
  // ✅ Fix: do NOT persist force flag across sessions; use sessionStorage only
  const forceLogout = sessionStorage.getItem('np_force_logout') === '1';

      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const parsedUser: User = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
          setIsFounder(parsedUser.role === 'founder');
        } catch (err) {
          console.error('❌ Invalid session data:', err);
          localStorage.removeItem('currentUser');
        }
  } else if (allowAutoLogin && !forceLogout) {
        // 🎯 CONTROLLED: Only auto-login when explicitly enabled for demos
        console.log('🚀 Demo mode enabled - Auto-authenticating for preview');
        const demoUser: User = {
          _id: 'demo-founder',
          name: 'Demo User',
          email: 'demo@newspulse.ai',
          role: 'founder',
          avatar: '',
          bio: 'Demo account - Preview mode only'
        };
        setUser(demoUser);
        setIsAuthenticated(true);
        setIsFounder(true);
        localStorage.setItem('currentUser', JSON.stringify(demoUser));
        localStorage.setItem('isFounder', 'true');
      } else {
        // 🔐 Check server session cookie (magic-link auth)
        try {
          if (justLoggedOut || forceLogout) {
            // ✅ Fix: still allow cookie check when user is on login/auth pages
            const p = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
            const onAuthPage = p.includes('/login') || p.startsWith('/auth');
            if (!onAuthPage) {
              // Skip cookie check right after logout to avoid flicker
              throw new Error('skip-session-check-after-logout');
            }
          }
          // Fallback-aware fetch: try proxied /admin-api first, then direct Render admin-backend if 404/HTML
          const FALLBACK_ADMIN_API = ADMIN_BACKEND_FALLBACK;
          const useFallback = API_BASE_PATH.startsWith('/admin-api');
          const doFetch = async (base: string) => fetch(`${base}/admin-auth/session`, { credentials: 'include' });
          let resp = await doFetch(API_BASE_PATH);
          const ct = resp.headers.get('content-type') || '';
          const looksHtml = ct.includes('text/html');
          if (useFallback && (!resp.ok || looksHtml || resp.status === 404)) {
            try { resp = await doFetch(FALLBACK_ADMIN_API); } catch {}
          }
          if (resp.ok) {
            const data = await resp.json();
            if (data?.authenticated) {
              const sessionUser: User = {
                _id: data.email || 'admin-user',
                name: data.email?.split('@')[0] || 'Admin',
                email: data.email,
                role: 'founder', // Treat authenticated admins as founders for panel access
                avatar: '',
                bio: ''
              };
              setUser(sessionUser);
              setIsAuthenticated(true);
              setIsFounder(true);
              // Persist minimal user to avoid blank reloads
              localStorage.setItem('currentUser', JSON.stringify(sessionUser));
              localStorage.setItem('isFounder', 'true');
            }
          }
        } catch (e) {
          // Ignore and keep unauthenticated state
        }
      }
      setIsLoading(false);
    };
    init();
  }, [allowAutoLogin]);

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('🚀 Submitting login request...');
    console.log('API URL (base):', API_BASE_PATH);
    console.log('Payload:', { email }); // do not log password for security
    try {
      const res = await AuthAPI.login({ email, password });
      console.log('✅ Login response token/user:', { hasToken: !!res.token, user: res.user?.email });
      if (res?.token && res?.user) {
        // Clear any force-logout flags if present
        try {
          sessionStorage.removeItem('np_force_logout');
          localStorage.removeItem('np_force_logout');
        } catch {}
        if (res.token) {
          localStorage.setItem('adminToken', res.token);
          setAuthToken(res.token);
        }
        const userData: User = {
          _id: (res.user as any)?.id || (res.user as any)?._id || '',
          name: res.user?.name || 'Admin',
          email: res.user?.email || email,
          role: (res.user?.role as any) || 'editor',
          avatar: (res.user as any)?.avatar || '',
          bio: (res.user as any)?.bio || '',
        };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');
        setUser(userData);
        setIsAuthenticated(true);
        setIsFounder(userData.role === 'founder');
        return true;
      } else {
        console.warn('⚠️ Login unsuccessful (missing token/user)');
        return false;
      }
    } catch (err: any) {
      console.error('❌ Login error (network/server):', err);
      if (err?.response) {
        console.error('Server responded:', err.response.status, err.response.data);
        if (err.response.status === 401) {
          console.error('Invalid email or password');
        } else if (err.response.status === 405) {
          console.error('Login 405: Check HTTP method or URL mismatch', err.response);
        }
      }
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('adminToken');
    setAuthToken(undefined);
    setUser(null);
    setIsAuthenticated(false);
    setIsFounder(false);
  // Best-effort cookie clear on server
  // Try proxied logout; if it fails with 404/HTML, hit Render admin-backend directly
  (async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/admin-auth/logout`, { method: 'POST', credentials: 'include' });
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || ct.includes('text/html')) {
  const FALLBACK_ADMIN_API = ADMIN_BACKEND_FALLBACK;
        await fetch(`${FALLBACK_ADMIN_API}/admin-auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
      }
    } catch {}
  })();
    // ✅ Fixed: logout now clears session and routes to /login instead of missing /auth.
    // Use hard navigation to ensure state is reset and protected routes re-evaluate.
    try {
      sessionStorage.setItem('np_recent_logout', String(Date.now()));
      // Block any auto-login (demo) and any cookie-based session hydration
      sessionStorage.setItem('np_force_logout', '1');
  // Do not persist force flag in localStorage (prevents being locked out on next session)
      // Proactively attempt to drop visible cookies (HttpOnly won't be affected, but harmless)
      try {
        const hosts = [window.location.hostname];
        const parts = window.location.hostname.split('.');
        if (parts.length > 2) hosts.push(`.${parts.slice(-2).join('.')}`);
        const attrs = ['path=/', 'SameSite=Lax', 'SameSite=None; Secure'];
        for (const h of hosts) {
          for (const a of attrs) {
            document.cookie = `np_admin=; Max-Age=0; ${a}; domain=${h}`;
          }
        }
        // Also attempt host-only delete (no domain attribute)
        document.cookie = 'np_admin=; Max-Age=0; path=/';
      } catch {}
  // ✅ Fix: proper logout + redirect per area (Admin -> /admin/login, Employee -> /employee/login)
  const p = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
  const dest = p.startsWith('/employee') ? '/employee/login' : '/admin/login';
  window.location.replace(dest);
    } catch {
      // Fallback if window is not available (unlikely in client context)
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isFounder,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
