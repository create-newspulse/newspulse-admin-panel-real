import { useAuth } from '@/context/AuthContext';
import { useAdminEffectiveAccess } from '@/hooks/useAdminEffectiveAccess';
import { getEffectiveSpecialRights, resolveAdminModuleAccess } from '@/lib/adminAccessControl';

export function useTrendingTopicsAccess() {
  const auth = useAuth();
  const founder = auth.isAuthenticated && auth.isFounder;
  const effective = useAdminEffectiveAccess({
    user: auth.user,
    enabled: auth.isAuthenticated && !!auth.user && !founder,
  });
  const access = resolveAdminModuleAccess(auth.user, 'manage_news', effective);
  const loading = Boolean(auth.isAuthenticated && (
    !auth.isReady || auth.isLoading || auth.isRestoring || !auth.user?.role || effective.isLoading
  ));
  const canRead = Boolean(auth.isAuthenticated && auth.user && !loading
    && (founder || (!effective.error && access.allowed)));
  const canEdit = canRead && (founder || getEffectiveSpecialRights(auth.user).includes('can_edit_news'));
  const reason = effective.error
    ? 'Manage News access could not be verified. Reload before managing Trending Topics.'
    : access.allowed ? 'Access Denied. Founder permission is required.' : access.reason;
  return { canRead, canEdit, isFounder: founder, loading, reason };
}
