// 📁 src/components/ProtectedRoute.tsx

import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '@context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  role?: 'founder' | 'editor' | 'ai'; // Optional role-based access
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading, isReady } = useAuth();
  const location = useLocation();

  // Wait for localStorage hydration before deciding
  if (!isReady) {
    return <div className="text-center mt-10">🔐 Checking admin session…</div>;
  }
  if (isLoading) {
    return <div className="text-center mt-10">🔐 Signing in…</div>;
  }

  if (!isAuthenticated || !user) {
    // ✅ Fix: redirect to correct login for area (admin vs employee)
    const p = location.pathname || '';
    const dest = p.startsWith('/employee') ? '/employee/login' : '/admin/login';
    return <Navigate to={dest} state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
