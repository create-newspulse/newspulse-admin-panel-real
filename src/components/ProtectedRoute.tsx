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
  const requestedRoleRestoreRef = useRef(false);

  // Attempt a one-time session restore if unauthenticated after hydration
  useEffect(() => {
    if (isReady && !isAuthenticated && !triedRestore.current) {
      triedRestore.current = true;
      restoreSession();
    }
  }, [isReady, isAuthenticated, restoreSession]);

  // If we need a role for this route and the user is authenticated but missing role, restore once.
  useEffect(() => {
    if (!role) return;
    if (!isReady || isRestoring || isLoading) return;
    if (isAuthenticated && user && !user.role && !requestedRoleRestoreRef.current) {
      requestedRoleRestoreRef.current = true;
      try {
        restoreSession();
      } catch {}
    }
  }, [role, isReady, isRestoring, isLoading, isAuthenticated, user, restoreSession]);

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

  // If a role is required, don't redirect while role is still missing and we haven't tried restore.
  if (role && !user.role) {
    if (requestedRoleRestoreRef.current) {
      return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }
    return <div className="text-center mt-10">🔐 Loading profile…</div>;
  }

  if (role) {
    const userRole = String(user.role || '').toLowerCase();
    const requiredRole = String(role).toLowerCase();
    if (userRole !== requiredRole) {
      return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }
  }

  return <>{children}</>;
}
