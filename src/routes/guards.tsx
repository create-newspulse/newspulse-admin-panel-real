import { Navigate, useLocation } from 'react-router-dom';
import { PropsWithChildren } from 'react';
import { useAuth } from '@context/AuthContext';
import type { Role } from '@/store/auth';

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const { isAuthenticated, user, isReady, isRestoring } = useAuth();

  if (!isReady || isRestoring) {
    return <div className="text-center mt-10">🔐 Restoring session…</div>;
  }

  return isAuthenticated && user
    ? <>{children}</>
    : <Navigate to="/admin/login" replace state={{ from: location }} />;
}

export function RequireRole({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const location = useLocation();
  const { isAuthenticated, user, isReady, isRestoring, restoreSession } = useAuth();

  if (!isReady || isRestoring) {
    return <div className="text-center mt-10">🔐 Restoring session…</div>;
  }

  // If authenticated but missing role (partial hydrate), try a restore once.
  if (isAuthenticated && user && !user.role) {
    try { restoreSession(); } catch {}
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  const role = String(user.role || '').toLowerCase();
  const ok = allow.map((r) => String(r).toLowerCase()).includes(role);
  return ok ? <>{children}</> : <Navigate to="/unauthorized" replace state={{ from: location }} />;
}
