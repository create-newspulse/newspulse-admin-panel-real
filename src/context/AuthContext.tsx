// 📁 src/context/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import api from '../lib/api';
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

  // 🛡️ SECURE: Only enable demo mode with explicit environment variable
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const isVercelPreview = window.location.hostname.includes('vercel.app');
  const allowAutoLogin = isDemoMode && isVercelPreview;

  useEffect(() => {
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
    }
    setIsLoading(false);
  }, [allowAutoLogin]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await api.post('/admin/login', { email, password });

      if (res.data.success) {
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
    setUser(null);
    setIsAuthenticated(false);
    setIsFounder(false);
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
