import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/http';
import {
  ADMIN_MODULES,
  getEffectiveModuleAccess,
  normalizeRoleId,
  resolveAdminModuleAccess,
  type AdminModuleKey,
} from '@/lib/adminAccessControl';
import {
  ADMIN_MODULE_POLICY_EVENT,
  BACKEND_MODULE_POLICY_KEY_BY_LOCAL,
  DEFAULT_ADMIN_MODULE_POLICY,
  denialMessageForReason,
  normalizeAdminModulePolicy,
  normalizePolicyState,
  type AdminAccessReasonCode,
  type AdminEffectiveModuleAccess,
  type AdminModulePolicyMap,
} from '@/lib/adminModulePolicy';

export const ADMIN_EFFECTIVE_ACCESS_EVENT = 'np:admin-effective-access';

type EffectiveAccessState = {
  modulePolicy: AdminModulePolicyMap;
  backendAccess: Partial<Record<AdminModuleKey, AdminEffectiveModuleAccess>>;
};

const EMPTY_STATE: EffectiveAccessState = {
  modulePolicy: DEFAULT_ADMIN_MODULE_POLICY,
  backendAccess: {},
};

let cachedAccountKey = '';
let cachedState: EffectiveAccessState = EMPTY_STATE;
let settledAccountKey = '';
let inflightRequest: { accountKey: string; promise: Promise<EffectiveAccessState> } | null = null;

const LOCAL_MODULE_KEY_BY_BACKEND = Object.entries(BACKEND_MODULE_POLICY_KEY_BY_LOCAL).reduce((acc, [localKey, backendKey]) => {
  acc[backendKey] = localKey as AdminModuleKey;
  return acc;
}, {} as Record<string, AdminModuleKey>);

function accountKeyFor(user: any) {
  return [user?.id || user?._id || user?.email || 'anonymous', normalizeRoleId(user?.role)].join(':');
}

function emitAccess(state: EffectiveAccessState) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EFFECTIVE_ACCESS_EVENT, { detail: state }));
}

export function clearAdminEffectiveAccessCache() {
  cachedAccountKey = '';
  cachedState = EMPTY_STATE;
  settledAccountKey = '';
  inflightRequest = null;
  emitAccess(cachedState);
}

function normalizeReasonCode(value: unknown): AdminAccessReasonCode | undefined {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized === 'MODULE_HIDDEN') return 'HIDDEN';
  if (['ALLOWED', 'STAFF_ACCESS_DISABLED', 'GLOBAL_STAFF_LOCK', 'FOUNDER_ONLY', 'HIDDEN', 'TEMPORARY_ACCESS_EXPIRED', 'ACCOUNT_EXPIRED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_LOCKED'].includes(normalized)) {
    return normalized as AdminAccessReasonCode;
  }
  return undefined;
}

function normalizeIndividualAccess(value: unknown): AdminEffectiveModuleAccess['individualAccess'] | undefined {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['enabled', 'disabled', 'temporary', 'not_configurable'].includes(normalized)) return normalized as AdminEffectiveModuleAccess['individualAccess'];
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
  return undefined;
}

function extractModules(raw: any): any[] | Record<string, any> | undefined {
  const effectiveAccess = raw?.effectiveAccess ?? raw?.data?.effectiveAccess ?? raw?.access?.effectiveAccess;
  return effectiveAccess?.canonicalModules
    ?? raw?.canonicalModules
    ?? raw?.data?.canonicalModules
    ?? raw?.access?.canonicalModules
    ?? raw?.access?.effectiveModuleAccess
    ?? raw?.data?.effectiveModuleAccess
    ?? raw?.effectiveModuleAccess
    ?? effectiveAccess?.modules
    ?? raw?.modules
    ?? raw?.effectiveModules
    ?? raw?.access?.modules
    ?? raw?.data?.modules;
}

function localModuleKey(value: unknown): AdminModuleKey | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  if (ADMIN_MODULES.some((item) => item.key === raw)) return raw as AdminModuleKey;
  return LOCAL_MODULE_KEY_BY_BACKEND[raw];
}

function normalizeBackendAccess(raw: unknown, user: any, modulePolicy: AdminModulePolicyMap): Partial<Record<AdminModuleKey, AdminEffectiveModuleAccess>> {
  const modules = extractModules(raw as any);
  const next: Partial<Record<AdminModuleKey, AdminEffectiveModuleAccess>> = {};
  const explicitAccess = new Set(getEffectiveModuleAccess(user));
  const addEntry = (moduleKey: AdminModuleKey, entry: any) => {
    if (!ADMIN_MODULES.some((item) => item.key === moduleKey)) return;
    const policyState = normalizePolicyState(entry?.policyState ?? entry?.globalPolicy ?? entry?.globalState ?? entry?.policy) || modulePolicy[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only';
    const reasonCode = normalizeReasonCode(entry?.reasonCode ?? entry?.reason) || (entry?.allowed === false ? resolveAdminModuleAccess(user, moduleKey, { modulePolicy }).reasonCode : 'ALLOWED');
    const allowed = entry?.allowed === true || reasonCode === 'ALLOWED';
    const visible = entry?.visible !== false && policyState !== 'hidden';
    next[moduleKey] = {
      moduleKey,
      visible,
      allowed,
      locked: !allowed && visible,
      policyState,
      reasonCode,
      reason: typeof entry?.reason === 'string' && entry.reason.trim() ? entry.reason : denialMessageForReason(reasonCode),
      individualAccess: normalizeIndividualAccess(entry?.individualAccess ?? entry?.individualState) || (moduleKey === 'safe_zone' ? 'not_configurable' : allowed ? 'enabled' : explicitAccess.has(moduleKey) ? 'enabled' : 'disabled'),
      temporary: entry?.temporary === true || entry?.individualState === 'temporary',
    };
  };

  if (Array.isArray(modules)) {
    modules.forEach((entry: any) => {
      const moduleKey = localModuleKey(entry?.moduleKey ?? entry?.key ?? entry?.canonicalKey ?? entry?.module);
      if (moduleKey) addEntry(moduleKey, entry);
    });
  } else if (modules && typeof modules === 'object') {
    Object.entries(modules as Record<string, any>).forEach(([key, value]) => {
      const moduleKey = localModuleKey(key);
      if (moduleKey) addEntry(moduleKey, value && typeof value === 'object' ? value : { allowed: value });
    });
  }

  return next;
}

function normalizeEffectiveAccessResponse(raw: unknown, user: any): EffectiveAccessState {
  const modulePolicy = normalizeAdminModulePolicy(raw, (raw as any)?.visibility ?? (raw as any)?.data?.visibility);
  const backendAccess = normalizeBackendAccess(raw, user, modulePolicy);
  const policyWithBackendStates = Object.entries(backendAccess).reduce((acc, [moduleKey, access]) => {
    acc[moduleKey as AdminModuleKey] = {
      moduleKey: moduleKey as AdminModuleKey,
      state: access?.policyState || modulePolicy[moduleKey as AdminModuleKey]?.state || 'founder_only',
    };
    return acc;
  }, { ...modulePolicy } as AdminModulePolicyMap);
  return {
    modulePolicy: policyWithBackendStates,
    backendAccess,
  };
}

async function fetchEffectiveAccess(user: any): Promise<EffectiveAccessState> {
  if (normalizeRoleId(user?.role) === 'founder') return EMPTY_STATE;
  const raw = await api('/access/me');
  return normalizeEffectiveAccessResponse(raw, user);
}

async function loadEffectiveAccess(user: any): Promise<EffectiveAccessState> {
  const key = accountKeyFor(user);
  if (cachedAccountKey === key && cachedState !== EMPTY_STATE) return cachedState;
  if (!inflightRequest || inflightRequest.accountKey !== key) {
    inflightRequest = {
      accountKey: key,
      promise: fetchEffectiveAccess(user)
      .then((state) => {
        cachedAccountKey = key;
        cachedState = state;
        settledAccountKey = key;
        emitAccess(state);
        return state;
      })
      .catch((error) => {
        settledAccountKey = key;
        throw error;
      })
      .finally(() => {
        inflightRequest = null;
      }),
    };
  }
  return inflightRequest.promise;
}

export function useAdminEffectiveAccess(options: { user: any; enabled?: boolean }) {
  const enabled = options.enabled ?? true;
  const user = options.user;
  const currentAccountKey = user ? accountKeyFor(user) : '';
  const [state, setState] = useState<EffectiveAccessState>(() => (currentAccountKey && cachedAccountKey === currentAccountKey ? cachedState : EMPTY_STATE));
  const [isLoading, setIsLoading] = useState(() => Boolean(enabled && user && normalizeRoleId(user?.role) !== 'founder' && cachedAccountKey !== currentAccountKey));
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !user || normalizeRoleId(user?.role) === 'founder') {
      setState(EMPTY_STATE);
      setIsLoading(false);
      return EMPTY_STATE;
    }
    if ((cachedAccountKey === currentAccountKey && cachedState !== EMPTY_STATE) || settledAccountKey === currentAccountKey) {
      setState(cachedState);
      setError(null);
      setIsLoading(false);
      return cachedState;
    }
    setIsLoading(true);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    try {
      const next = await loadEffectiveAccess(user);
      setState(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load effective access'));
      setState(EMPTY_STATE);
      throw err;
    } finally {
      setIsLoading(false);
      if (import.meta.env.DEV) console.debug('[Auth] effective access resolved', {
        role: normalizeRoleId(user?.role),
        durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - startedAt),
      });
    }
  }, [currentAccountKey, enabled, user]);

  useEffect(() => {
    if (!enabled || !user) {
      setState(EMPTY_STATE);
      setIsLoading(false);
      return;
    }
    if (cachedAccountKey !== currentAccountKey) {
      setState(EMPTY_STATE);
      setIsLoading(normalizeRoleId(user?.role) !== 'founder');
    }
    void refresh().catch(() => undefined);
  }, [currentAccountKey, enabled, user, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAccess = (event: Event) => {
      const detail = (event as CustomEvent<EffectiveAccessState>).detail;
      setState(detail || EMPTY_STATE);
      setIsLoading(false);
    };
    const onPolicy = (event: Event) => {
      const policy = (event as CustomEvent<AdminModulePolicyMap>).detail;
      if (!policy) return;
      cachedState = { modulePolicy: policy, backendAccess: {} };
      cachedAccountKey = '';
      settledAccountKey = '';
      inflightRequest = null;
      setState(cachedState);
      void refresh().catch(() => undefined);
    };
    window.addEventListener(ADMIN_EFFECTIVE_ACCESS_EVENT, onAccess as EventListener);
    window.addEventListener(ADMIN_MODULE_POLICY_EVENT, onPolicy as EventListener);
    return () => {
      window.removeEventListener(ADMIN_EFFECTIVE_ACCESS_EVENT, onAccess as EventListener);
      window.removeEventListener(ADMIN_MODULE_POLICY_EVENT, onPolicy as EventListener);
    };
  }, [refresh]);

  const accountAccessPending = Boolean(
    enabled
    && user
    && normalizeRoleId(user?.role) !== 'founder'
    && cachedAccountKey !== currentAccountKey
    && settledAccountKey !== currentAccountKey,
  );

  return useMemo(() => ({ ...state, isLoading: isLoading || accountAccessPending, error, refresh }), [state, isLoading, accountAccessPending, error, refresh]);
}