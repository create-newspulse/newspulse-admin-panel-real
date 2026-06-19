import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@context/AuthContext';
import { useAdminFeatureVisibility } from '@/hooks/useAdminFeatureVisibility';
import { DEFAULT_ADMIN_FEATURE_VISIBILITY, isOwnerRole } from '@/lib/adminFeatureVisibility';
import { canAccessAnyAdminModule, type AdminModuleKey } from '@/lib/adminAccessControl';
import Denied from '@pages/Denied';

type AdminModuleRouteProps = {
  moduleKey: AdminModuleKey | AdminModuleKey[];
  children: ReactNode;
};

export default function AdminModuleRoute({ moduleKey, children }: AdminModuleRouteProps) {
  const location = useLocation();
  const { isAuthenticated, user, isLoading, isReady, isRestoring } = useAuth();
  const ownerRole = isOwnerRole(user?.role);
  const { visibility, isLoading: visibilityLoading } = useAdminFeatureVisibility({ enabled: isAuthenticated && !ownerRole });
  const moduleKeys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];

  if (!isReady || isRestoring) {
    return <div className="text-center mt-10">🔐 Restoring session…</div>;
  }

  if (isLoading || (isAuthenticated && !ownerRole && visibilityLoading)) {
    return <div className="text-center mt-10">🔐 Checking access…</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const effectiveVisibility = ownerRole ? DEFAULT_ADMIN_FEATURE_VISIBILITY : visibility;
  return canAccessAnyAdminModule(user, moduleKeys, effectiveVisibility) ? <>{children}</> : <Denied />;
}