import { Navigate } from 'react-router-dom';
import { PropsWithChildren } from 'react';
import { useAuthZ, Role } from '@/store/auth';

export function RequireAuth({ children }: PropsWithChildren) {
  const { user } = useAuthZ();
  return user ? <>{children}</> : <Navigate to="/admin/login" replace />;
}

export function RequireRole({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const { hasRole } = useAuthZ();
  return hasRole(allow) ? <>{children}</> : <Navigate to="/denied" replace />;
}
