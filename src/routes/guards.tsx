import { Navigate } from 'react-router-dom';
import { PropsWithChildren } from 'react';
import { useAuth, Role } from '@/store/auth';

export function RequireAuth({ children }: PropsWithChildren) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/admin/login" replace />;
}

export function RequireRole({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const { hasRole } = useAuth();
  return hasRole(allow) ? <>{children}</> : <Navigate to="/denied" replace />;
}
