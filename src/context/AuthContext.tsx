// 📁 src/context/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import api, { API_BASE_PATH, setAuthToken } from '../lib/api';
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
      } else if (allowAutoLogin) {
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
          const resp = await fetch(`${API_BASE_PATH}/admin-auth/session`, { credentials: 'include' });
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
    try {
      const res = await api.post('/admin/login', { email, password });

      if (res.data.success) {
        // Persist JWT token for authorized API calls
        if (res.data.token) {
          localStorage.setItem('adminToken', res.data.token);
          setAuthToken(res.data.token);
        }

        const userData: User = {
          _id: res.data.user?._id || '',
          name: res.data.user?.name || 'Admin',
          email: res.data.user?.email || email,
          role: res.data.user?.role || 'editor',
          avatar: res.data.user?.avatar || '',
          bio: res.data.user?.bio || '',
        };

        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');

        setUser(userData);
        setIsAuthenticated(true);
        setIsFounder(userData.role === 'founder');
        return true;
      }

      return false;
    } catch (err) {
      console.error('❌ Login Error:', err);
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
    fetch(`${API_BASE_PATH}/admin-auth/logout`, { credentials: 'include' }).catch(() => {});
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
