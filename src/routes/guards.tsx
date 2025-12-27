import { Navigate, useLocation } from 'react-router-dom';
import { PropsWithChildren, useEffect, useRef } from 'react';
import { useAuth } from '@context/AuthContext';
import type { Role } from '@/store/auth';

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const { isAuthenticated, user, isReady, isRestoring } = useAuth();

  // Per spec: only protect /admin/* routes.
  if (!(location.pathname || '').startsWith('/admin')) {
    return <>{children}</>;
  }

  if (!isReady || isRestoring) {
    return <div className="text-center mt-10">🔐 Restoring session…</div>;
  }

  return isAuthenticated && user
    ? <>{children}</>
    : <Navigate to="/login" replace state={{ from: location }} />;
}

export function RequireRole({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const location = useLocation();
  const { isAuthenticated, user, isReady, isRestoring, isLoading, restoreSession } = useAuth();
  const requestedRestoreRef = useRef(false);

  // Per spec: only protect /admin/* routes.
  const isAdminArea = (location.pathname || '').startsWith('/admin');

  // If authenticated but missing role (partial hydrate), try a restore once.
  useEffect(() => {
    if (!isAdminArea) return;
    if (!isReady || isRestoring || isLoading) return;
    if (isAuthenticated && user && !user.role && !requestedRestoreRef.current) {
      requestedRestoreRef.current = true;
      try {
        restoreSession();
      } catch {}
    }
  }, [isAdminArea, isAuthenticated, user, isReady, isRestoring, isLoading, restoreSession]);

  if (!isAdminArea) {
    return <>{children}</>;
  }

  if (!isReady || isRestoring) {
    return <div className="text-center mt-10">🔐 Restoring session…</div>;
  }

  if (isLoading) {
    return <div className="text-center mt-10">🔐 Checking access…</div>;
  }

  // Don't redirect while we are still trying to fetch the user's role.
  if (isAuthenticated && user && !user.role) {
    // If we already tried to restore and still have no role, treat as unauthorized.
    if (requestedRestoreRef.current) {
      return <Navigate to="/unauthorized" replace state={{ from: location }} />;
    }
    return <div className="text-center mt-10">🔐 Loading profile…</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = String(user.role || '').toLowerCase();
  const ok = allow.map((r) => String(r).toLowerCase()).includes(role);
  return ok ? <>{children}</> : <Navigate to="/unauthorized" replace state={{ from: location }} />;
}
