import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@context/AuthContext';
import { isOwnerRole } from '@/lib/adminFeatureVisibility';
import { resolveAnyAdminModuleAccess, type AdminModuleKey } from '@/lib/adminAccessControl';
import { useAdminEffectiveAccess } from '@/hooks/useAdminEffectiveAccess';
import Denied from '@pages/Denied';
import AdminBootstrapLoader from '@components/AdminBootstrapLoader';

type AdminModuleRouteProps = {
  moduleKey: AdminModuleKey | AdminModuleKey[];
  children: ReactNode;
};

export default function AdminModuleRoute({ moduleKey, children }: AdminModuleRouteProps) {
  const location = useLocation();
  const { isAuthenticated, user, isLoading, isReady, isRestoring } = useAuth();
  const hasUserProfile = !!user && !!String(user?.role || '').trim();
  const ownerRole = isOwnerRole(user?.role);
  const { modulePolicy, backendAccess, isLoading: accessLoading } = useAdminEffectiveAccess({ user, enabled: isAuthenticated && hasUserProfile && !ownerRole });
  const moduleKeys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];

  if (!isReady || isRestoring) {
    return <AdminBootstrapLoader />;
  }

  if (isLoading || (isAuthenticated && !ownerRole && accessLoading)) {
    return <AdminBootstrapLoader />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasUserProfile) {
    return <AdminBootstrapLoader />;
  }

  const access = resolveAnyAdminModuleAccess(user, moduleKeys, { modulePolicy, backendAccess });
  return access.allowed ? <>{children}</> : <Denied message={access.reason} />;
}