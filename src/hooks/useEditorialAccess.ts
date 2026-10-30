import { useAuth } from '@/context/AuthContext';
import { useAdminEffectiveAccess } from '@/hooks/useAdminEffectiveAccess';
import { normalizeRoleId, resolveAdminModuleAccess } from '@/lib/adminAccessControl';
import { localSpecialRightKey } from '@/lib/staffAccessSerializer';

export function useEditorialAccess() {
  const auth = useAuth();
  const isFounder = auth.isAuthenticated && normalizeRoleId(auth.user?.role) === 'founder';
  const effective = useAdminEffectiveAccess({
    user: auth.user,
    enabled: auth.isAuthenticated && !!auth.user && !isFounder,
  });
  const loading = Boolean(auth.isAuthenticated && (
    !auth.isReady || auth.isLoading || auth.isRestoring || !auth.user?.role || effective.isLoading
  ));
  const ready = Boolean(auth.isAuthenticated && auth.user && !loading && (isFounder || !effective.error));
  const canManageNews = ready && resolveAdminModuleAccess(auth.user, 'manage_news', effective).allowed;
  const canReadOwnDrafts = ready && (['add_news', 'draft_desk'] as const).some((key) =>
    resolveAdminModuleAccess(auth.user, key, effective).allowed,
  );
  // The profile's computed rights are not the permanent selections or role preset.
  const rights: unknown[] = Array.isArray(auth.user?.specialRights) ? auth.user.specialRights : [];
  const hasPublishRight = rights.some((right) => localSpecialRightKey(right) === 'can_publish_news');
  const hasEditRight = rights.some((right) => localSpecialRightKey(right) === 'can_edit_news');
  const canEditNews = canManageNews && (isFounder || hasEditRight);
  const canPublish = ready && (isFounder || (
    ((canManageNews && hasEditRight) || canReadOwnDrafts) && hasPublishRight && auth.user?.newsPublishGrantRecorded === true
  ));

  return {
    loading,
    isFounder: Boolean(isFounder),
    canManageNews,
    canEditNews,
    canReadOwnDrafts,
    canPublish,
    canSchedule: ready && isFounder,
    reason: effective.error
      ? 'Editorial access could not be verified. Reload before continuing.'
      : 'Access denied. Effective Manage News, Add News or Draft Desk access is required.',
  };
}
