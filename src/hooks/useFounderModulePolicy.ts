import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FOUNDER_MODULE_POLICY_VERSION_ERROR,
  createFounderModulePolicyPayload,
  getFounderModulePolicySnapshot,
  previewFounderModulePolicy,
  putFounderModulePolicy,
  isValidFounderModulePolicyVersion,
} from '@/api/ownerZone';
import {
  ADMIN_POLICY_MODULE_KEYS,
  DEFAULT_ADMIN_MODULE_POLICY,
  type AdminModulePolicyMap,
  type SerializedModulePolicyPayload,
} from '@/lib/adminModulePolicy';

export type FounderModulePolicyState = {
  savedPolicy: AdminModulePolicyMap;
  draftPolicy: AdminModulePolicyMap;
  loadedVersion: number | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
};

function hasPolicyChanges(savedPolicy: AdminModulePolicyMap, draftPolicy: AdminModulePolicyMap) {
  return ADMIN_POLICY_MODULE_KEYS.some((moduleKey) => {
    const savedState = savedPolicy[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only';
    const draftState = draftPolicy[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only';
    return savedState !== draftState;
  });
}

function toError(err: unknown) {
  return err instanceof Error ? err : new Error('Failed to load Founder access policy.');
}

function versionError() {
  return new Error(FOUNDER_MODULE_POLICY_VERSION_ERROR);
}

export function useFounderModulePolicy(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<FounderModulePolicyState>({
    savedPolicy: DEFAULT_ADMIN_MODULE_POLICY,
    draftPolicy: DEFAULT_ADMIN_MODULE_POLICY,
    loadedVersion: null,
    isLoading: enabled,
    isSaving: false,
    error: null,
  });

  const refresh = useCallback(async (options: { force?: boolean } = {}) => {
    setState((current) => ({ ...current, isLoading: true }));
    try {
      const snapshot = await getFounderModulePolicySnapshot({ force: options.force });
      setState((current) => ({
        ...current,
        savedPolicy: snapshot.policy,
        draftPolicy: snapshot.policy,
        loadedVersion: snapshot.version,
        isLoading: false,
        error: null,
      }));
      return snapshot;
    } catch (err) {
      const nextError = toError(err);
      setState((current) => ({ ...current, isLoading: false, error: nextError, loadedVersion: null }));
      throw nextError;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, isLoading: false }));
      return;
    }
    let mounted = true;
    setState((current) => ({ ...current, isLoading: true }));
    getFounderModulePolicySnapshot()
      .then((snapshot) => {
        if (!mounted) return;
        setState((current) => ({
          ...current,
          savedPolicy: snapshot.policy,
          draftPolicy: snapshot.policy,
          loadedVersion: snapshot.version,
          isLoading: false,
          error: null,
        }));
      })
      .catch((err) => {
        if (!mounted) return;
        setState((current) => ({ ...current, isLoading: false, error: toError(err), loadedVersion: null }));
      });
    return () => { mounted = false; };
  }, [enabled]);

  const setDraftPolicy = useCallback((nextPolicy: AdminModulePolicyMap) => {
    setState((current) => ({ ...current, draftPolicy: nextPolicy }));
  }, []);

  const resetChanges = useCallback(() => {
    setState((current) => ({ ...current, draftPolicy: current.savedPolicy }));
  }, []);

  const createPolicyPayload = useCallback((auditReason = '', policyOverride?: AdminModulePolicyMap) => {
    const version = state.loadedVersion;
    if (!isValidFounderModulePolicyVersion(version)) {
      const err = versionError();
      setState((current) => ({ ...current, error: err }));
      throw err;
    }
    return createFounderModulePolicyPayload(policyOverride || state.draftPolicy, auditReason, version, state.savedPolicy);
  }, [state.draftPolicy, state.loadedVersion, state.savedPolicy]);

  const previewPolicy = useCallback(async (auditReason = '', policyOverride?: AdminModulePolicyMap) => {
    const payload = createPolicyPayload(auditReason, policyOverride);
    const result = await previewFounderModulePolicy(payload);
    return { result, payload };
  }, [createPolicyPayload]);

  const savePolicy = useCallback(async (payload: SerializedModulePolicyPayload) => {
    if (!isValidFounderModulePolicyVersion(payload?.expectedVersion)) {
      const err = versionError();
      setState((current) => ({ ...current, error: err }));
      throw err;
    }
    setState((current) => ({ ...current, isSaving: true }));
    try {
      const snapshot = await putFounderModulePolicy(payload);
      setState((current) => ({
        ...current,
        savedPolicy: snapshot.policy,
        draftPolicy: snapshot.policy,
        loadedVersion: snapshot.version,
        isSaving: false,
        error: null,
      }));
      return snapshot;
    } catch (err) {
      const nextError = toError(err);
      setState((current) => ({ ...current, isSaving: false, error: nextError }));
      throw err;
    }
  }, []);

  const hasChanges = useMemo(() => hasPolicyChanges(state.savedPolicy, state.draftPolicy), [state.savedPolicy, state.draftPolicy]);

  return useMemo(() => ({
    ...state,
    hasChanges,
    policy: state.savedPolicy,
    versionIsValid: isValidFounderModulePolicyVersion(state.loadedVersion),
    refresh,
    setDraftPolicy,
    resetChanges,
    createPolicyPayload,
    previewPolicy,
    savePolicy,
  }), [createPolicyPayload, hasChanges, previewPolicy, refresh, resetChanges, savePolicy, setDraftPolicy, state]);
}
