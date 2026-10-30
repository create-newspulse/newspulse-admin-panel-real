import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { normalizeEffectiveAccessResponse, useAdminEffectiveAccess } from '@/hooks/useAdminEffectiveAccess';
import { normalizeRoleId, resolveAdminModuleAccess } from '@/lib/adminAccessControl';
import { adminApiClient } from '@/lib/adminApiClient';
import { localSpecialRightKey } from '@/lib/staffAccessSerializer';

type EffectiveAccess = Pick<ReturnType<typeof useAdminEffectiveAccess>, 'modulePolicy' | 'backendAccess'>;

function permissionsFor(user: Record<string, unknown> | null, effective: EffectiveAccess, ready: boolean) {
  const isFounder = ready && normalizeRoleId(user?.role) === 'founder';
  const canManageNews = ready && resolveAdminModuleAccess(user, 'manage_news', effective).allowed;
  const canReadOwnDrafts = ready && (['add_news', 'draft_desk'] as const).some(key =>
    resolveAdminModuleAccess(user, key, effective).allowed,
  );
  const rights: unknown[] = Array.isArray(user?.specialRights) ? user.specialRights : [];
  const hasPublishRight = rights.some(right => localSpecialRightKey(right) === 'can_publish_news');
  const hasEditRight = rights.some(right => localSpecialRightKey(right) === 'can_edit_news');
  const hasRestoreRight = rights.some(right => localSpecialRightKey(right) === 'can_restore_news');
  const permanent: unknown = user?.specialRightsOverride;
  const hasPermanentRestore = user?.specialRightsConfigured === true
    && Array.isArray(permanent) && permanent.every(right => typeof right === 'string')
    && permanent.some(right => localSpecialRightKey(right) === 'can_restore_news');
  const canEditNews = canManageNews && (isFounder || hasEditRight);
  return {
    isFounder,
    canManageNews,
    canEditNews,
    canReadOwnDrafts,
    canCreateNews: ready && (isFounder || canReadOwnDrafts || canEditNews),
    canRestoreNews: ready && (isFounder || (canManageNews && hasPermanentRestore && hasRestoreRight)),
    canPublish: ready && (isFounder || (
      (canEditNews || canReadOwnDrafts) && hasPublishRight && user?.newsPublishGrantRecorded === true
    )),
    canSchedule: ready && isFounder,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function permissionResponse(value: unknown): Record<string, unknown> {
  const body = record(value);
  const data = record(body?.data);
  if (!body || [body, data].some(part => part && (
    part.ok === false || part.success === false || (typeof part.status === 'number' && part.status >= 400)
  ))) throw new Error('Permission refresh did not return a verified response. Your edits are kept.');
  return body;
}

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
  const permissions = permissionsFor(auth.user, effective, ready);
  const actorId = auth.user?.id || auth.user?._id;
  const actorRole = normalizeRoleId(auth.user?.role);
  const scope = JSON.stringify([actorId, actorRole, ready, permissions]);
  const liveScope = useRef(scope);
  liveScope.current = scope;
  const mounted = useRef(false);
  const [refreshed, setRefreshed] = useState<{ scope: string; permissions: ReturnType<typeof permissionsFor> } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { setRefreshed(null); }, [scope]);

  const refreshPermissions = useCallback(async () => {
    if (!ready || typeof actorId !== 'string' || !actorId.trim()) {
      throw new Error('Current account access could not be verified. Preserve your edits before signing in again.');
    }
    const current = () => mounted.current && liveScope.current === scope;
    // Keep this receipt local: replacing session state or clearing module caches would remount unsaved editors.
    const config = { skipAuthRefresh: true, timeout: 10_000, headers: { 'Cache-Control': 'no-cache' } };
    try {
      const response = await adminApiClient.get<unknown>('admin/me', config);
      if (!current()) throw new Error('The active account or access changed. Refresh permissions again; your edits are kept.');
      const body = permissionResponse(response.data);
      const data = record(body.data);
      const profile = record(body.user ?? body.admin ?? data?.user ?? data?.admin ?? body.data ?? body);
      const id = profile?.id ?? profile?._id;
      if (!profile || id !== actorId || typeof profile.role !== 'string' || !profile.role.trim()
        || normalizeRoleId(profile.role) !== actorRole
        || (profile.id != null && profile._id != null && profile.id !== profile._id)) {
        throw new Error('Permission refresh could not verify the same account and role. Your edits are kept.');
      }
      const freshEffective = actorRole === 'founder'
        ? effective
        : normalizeEffectiveAccessResponse(
          permissionResponse((await adminApiClient.get<unknown>('access/me', config)).data), profile,
        );
      if (!current()) throw new Error('The active account or access changed. Refresh permissions again; your edits are kept.');
      const next = permissionsFor(profile, freshEffective, true);
      setRefreshed({ scope, permissions: next });
      return next;
    } catch (error: unknown) {
      if (current()) setRefreshed({ scope, permissions: permissionsFor(null, effective, false) });
      throw error;
    }
  }, [scope, ready, actorId, actorRole, effective]);

  return {
    ...(ready && refreshed?.scope === scope ? refreshed.permissions : permissions),
    loading,
    refreshPermissions,
    reason: effective.error
      ? 'Editorial access could not be verified. Reload before continuing.'
      : 'Access denied. Effective Manage News, Add News or Draft Desk access is required.',
  };
}
