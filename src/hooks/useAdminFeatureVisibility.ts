import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminFeatureVisibility, putAdminFeatureVisibility } from '@/api/ownerZone';
import {
  DEFAULT_ADMIN_FEATURE_VISIBILITY,
  normalizeAdminFeatureVisibility,
  OWNER_VISIBILITY_EVENT,
  type AdminFeatureVisibilityState,
} from '@/lib/adminFeatureVisibility';

let cachedVisibility: AdminFeatureVisibilityState = { ...DEFAULT_ADMIN_FEATURE_VISIBILITY };
let hasFetchedVisibility = false;
let inflightVisibilityRequest: Promise<AdminFeatureVisibilityState> | null = null;

function emitVisibility(state: AdminFeatureVisibilityState) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OWNER_VISIBILITY_EVENT, { detail: state }));
}

function updateCache(state: AdminFeatureVisibilityState) {
  cachedVisibility = { ...state };
  hasFetchedVisibility = true;
  emitVisibility(cachedVisibility);
  return cachedVisibility;
}

async function loadVisibility(): Promise<AdminFeatureVisibilityState> {
  if (hasFetchedVisibility) return cachedVisibility;
  if (!inflightVisibilityRequest) {
    inflightVisibilityRequest = getAdminFeatureVisibility()
      .then((state) => updateCache(state))
      .finally(() => {
        inflightVisibilityRequest = null;
      });
  }
  return inflightVisibilityRequest;
}

export function useAdminFeatureVisibility(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [visibility, setVisibility] = useState<AdminFeatureVisibilityState>(cachedVisibility);
  const [isLoading, setIsLoading] = useState<boolean>(enabled && !hasFetchedVisibility);
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return cachedVisibility;
    setIsLoading(true);
    try {
      const next = await loadVisibility();
      setVisibility(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load feature visibility'));
      setVisibility(cachedVisibility);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  const save = useCallback(async (nextState: AdminFeatureVisibilityState) => {
    setIsSaving(true);
    try {
      await putAdminFeatureVisibility(nextState);
      hasFetchedVisibility = false;
      const refreshed = await getAdminFeatureVisibility();
      const normalized = updateCache(normalizeAdminFeatureVisibility(refreshed));
      setVisibility(normalized);
      setError(null);
      return normalized;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save feature visibility'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh().catch(() => undefined);
  }, [enabled, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisibility = (event: Event) => {
      const detail = (event as CustomEvent<AdminFeatureVisibilityState>).detail;
      if (!detail) return;
      setVisibility(normalizeAdminFeatureVisibility(detail));
      setIsLoading(false);
    };
    window.addEventListener(OWNER_VISIBILITY_EVENT, onVisibility as EventListener);
    return () => window.removeEventListener(OWNER_VISIBILITY_EVENT, onVisibility as EventListener);
  }, []);

  return useMemo(
    () => ({ visibility, isLoading, isSaving, error, refresh, save }),
    [visibility, isLoading, isSaving, error, refresh, save],
  );
}