// 📁 src/components/ProtectedRoute.tsx

import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '@context/AuthContext';
import { useEffect, useRef } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  role?: 'founder' | 'editor' | 'ai'; // Optional role-based access
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading, isReady, isRestoring, restoreSession } = useAuth();
  const triedRestore = useRef(false);
  const location = useLocation();

  // Attempt a one-time session restore if unauthenticated after hydration
  useEffect(() => {
    if (isReady && !isAuthenticated && !triedRestore.current) {
      triedRestore.current = true;
      restoreSession();
    }
  }, [isReady, isAuthenticated, restoreSession]);

  if (!isReady || isRestoring) {
    return <div className="text-center mt-10">🔐 Restoring session…</div>;
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
