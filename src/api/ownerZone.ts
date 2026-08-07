import { api, getOwnerUnlockToken } from '@/lib/http';
import {
  createVisibilityPayload,
  normalizeAdminFeatureVisibility,
  type AdminFeatureVisibilityState,
} from '@/lib/adminFeatureVisibility';
import {
  normalizeAdminModulePolicy,
  serializeModulePolicyPayload,
  type AdminModulePolicyMap,
  type SerializedModulePolicyPayload,
} from '@/lib/adminModulePolicy';

export const FOUNDER_MODULE_POLICY_VERSION_ERROR = 'Founder policy version could not be loaded. Refresh the latest policy.';

export const FOUNDER_MODULE_POLICY_API = {
  load: '/admin/safe-owner-zone/module-policy',
  preview: '/admin/safe-owner-zone/module-policy/preview',
  save: '/admin/safe-owner-zone/module-policy',
  audit: '/admin/safe-owner-zone/module-policy/audit',
} as const;

export type OwnerStatus = {
  mode?: 'NORMAL' | 'READ_ONLY' | 'LOCKDOWN' | string;
  maintenance?: boolean;
  ownerUnlocked?: boolean;
  ownerUnlockExpiresAt?: string | null;
  externalFetch?: boolean;
  aiAutoPublish?: boolean;
};

export type OwnerKeyStatus = {
  unlocked?: boolean;
  expiresAt?: string | null;
  ownerUnlocked?: boolean;
  ownerUnlockExpiresAt?: string | null;
  ttlMs?: number;
  ttlSec?: number;
  unlockToken?: string;
  [key: string]: any;
};

export type SystemState = {
  mode?: 'NORMAL' | 'READ_ONLY' | 'LOCKDOWN' | string;
  maintenance?: boolean;
  externalFetch?: boolean;
  aiAutoPublish?: boolean;
  [key: string]: any;
};

export type FounderModulePolicySnapshot = {
  policy: AdminModulePolicyMap;
  version: number;
};

// Owner key
export async function getOwnerKeyStatus(): Promise<OwnerKeyStatus> {
  return api<OwnerKeyStatus>('/owner/key/status');
}

export async function unlockOwnerKey(pin: string): Promise<OwnerKeyStatus> {
  return api<OwnerKeyStatus>('/owner/key/unlock', {
    method: 'POST',
    json: { pin },
  });
}

export async function lockOwnerKey(): Promise<{ ok?: boolean } & Record<string, any>> {
  return api('/owner/key/lock', {
    method: 'POST',
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

// Admin settings (dangerous: requires owner unlock)
export async function getAdminSettings(): Promise<any> {
  return api('/admin/settings');
}

export async function putAdminSettings(patch: any): Promise<any> {
  return api('/admin/settings', {
    method: 'PATCH',
    json: patch || {},
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function getSystemState(): Promise<SystemState> {
  return api<SystemState>('/admin/system/state');
}

export async function updateSystemState(payload: Partial<SystemState>): Promise<SystemState> {
  return api<SystemState>('/admin/system/state', {
    method: 'PUT',
    json: payload || {},
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function lockdown(): Promise<any> {
  return api('/admin/system/lockdown', {
    method: 'POST',
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function reactivate(): Promise<any> {
  return api('/admin/system/reactivate', {
    method: 'POST',
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function health(): Promise<any> {
  return api('/system/health');
}

export async function getRecentAudit(limit = 30): Promise<any> {
  return api(`/audit/recent?limit=${encodeURIComponent(String(limit))}`);
}

export type SnapshotItem = {
  id: string;
  createdAt?: string;
  label?: string;
  reason?: string;
  mode?: string;
  checksum?: string;
  actor?: string;
  [key: string]: any;
};

export type DeployEventItem = {
  id: string;
  happenedAt?: string;
  provider?: string;
  service?: string;
  environment?: string;
  status?: string;
  deployId?: string;
  url?: string;
  commitSha?: string;
  branch?: string;
  message?: string;
  author?: string;
  [key: string]: any;
};

export type VersionTimeline = {
  ok?: boolean;
  deploys: DeployEventItem[];
  snapshots: SnapshotItem[];
};

// Back-compat: older UI panels expect a version timeline feed.
// The real backend contract we are standardizing on is snapshots under:
//   GET /api/admin/system/snapshots?limit=..
// Deploy history is not currently surfaced here, so deploys remain empty.
export async function getVersionTimeline(limit = 50): Promise<VersionTimeline> {
  const r = await listSnapshots(limit);
  const items = Array.isArray((r as any)?.items) ? (r as any).items : Array.isArray(r) ? (r as any) : [];
  return { ok: true, deploys: [], snapshots: items as SnapshotItem[] };
}

export async function exportVersionTimeline(limit = 500): Promise<VersionTimeline> {
  return getVersionTimeline(limit);
}

export async function getSnapshot(id: string): Promise<SnapshotItem> {
  if (!id) return { id };
  const r = await listSnapshots(200);
  const items = Array.isArray((r as any)?.items) ? (r as any).items : Array.isArray(r) ? (r as any) : [];
  const found = (items as SnapshotItem[]).find((s) => s?.id === id);
  return found || { id };
}

export async function rollbackDryRun(_id: string): Promise<any> {
  const err: any = new Error('Rollback preview is not supported by this backend route');
  err.status = 501;
  err.response = { status: 501 };
  return Promise.reject(err);
}

function normalizeId(raw: any): string {
  const id = raw?.id ?? raw?._id ?? raw?.snapshotId ?? raw?.deployId;
  return typeof id === 'string' ? id : id ? String(id) : '';
}

function normalizeSnapshot(raw: any): SnapshotItem {
  return {
    id: normalizeId(raw),
    createdAt: raw?.createdAt ?? raw?.created_at ?? raw?.happenedAt ?? raw?.ts ?? raw?.time,
    label: raw?.label ?? raw?.note,
    reason: raw?.reason,
    mode: raw?.mode,
    checksum: raw?.checksum,
    actor: raw?.actor,
    ...raw,
  };
}

export async function createSnapshot(payload: { label?: string; reason?: string }): Promise<SnapshotItem> {
  const raw: any = await api('/admin/system/snapshots', {
    method: 'POST',
    json: { label: payload?.label, reason: payload?.reason },
    ownerUnlockToken: getOwnerUnlockToken(),
  });
  return normalizeSnapshot(raw?.snapshot ?? raw);
}

export async function listSnapshots(limit = 20): Promise<{ items: SnapshotItem[] } | SnapshotItem[]> {
  const raw: any = await api(`/admin/system/snapshots?limit=${encodeURIComponent(String(limit))}`);
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeSnapshot) : Array.isArray(raw) ? raw.map(normalizeSnapshot) : [];
  return { items };
}

export async function rollbackApply(snapshotId: string): Promise<any> {
  return api('/admin/system/rollback', {
    method: 'POST',
    json: { snapshotId },
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function getAdminFeatureVisibility(): Promise<AdminFeatureVisibilityState> {
  const response = await api('/admin/safe-owner-zone/feature-visibility');
  return normalizeAdminFeatureVisibility((response as any)?.visibility);
}

export async function putAdminFeatureVisibility(visibility: AdminFeatureVisibilityState): Promise<AdminFeatureVisibilityState> {
  const response = await api('/admin/safe-owner-zone/feature-visibility', {
    method: 'PUT',
    json: createVisibilityPayload(visibility),
  });
  return normalizeAdminFeatureVisibility((response as any)?.visibility);
}

let founderModulePolicyCache: FounderModulePolicySnapshot | null = null;
let founderModulePolicyInflight: Promise<FounderModulePolicySnapshot> | null = null;
let founderModulePolicyLoadError: any = null;

function normalizeModulePolicyResponse(response: unknown): AdminModulePolicyMap {
  return normalizeAdminModulePolicy(response, (response as any)?.visibility);
}

export function isValidFounderModulePolicyVersion(version: unknown): version is number {
  return Number.isInteger(version) && Number(version) >= 1;
}

function readFounderModulePolicySnapshot(response: unknown): FounderModulePolicySnapshot {
  const version = (response as any)?.version;
  if (!isValidFounderModulePolicyVersion(version)) {
    throw new Error(FOUNDER_MODULE_POLICY_VERSION_ERROR);
  }
  return {
    policy: normalizeModulePolicyResponse(response),
    version,
  };
}

export function isModulePolicyVersionConflict(err: unknown): boolean {
  const anyErr = err as any;
  return Number(anyErr?.status ?? anyErr?.response?.status ?? 0) === 409
    || anyErr?.body?.code === 'MODULE_POLICY_VERSION_CONFLICT'
    || anyErr?.response?.data?.code === 'MODULE_POLICY_VERSION_CONFLICT';
}

export function modulePolicyErrorMessage(err: unknown): string {
  const anyErr = err as any;
  const status = Number(anyErr?.status ?? anyErr?.response?.status ?? 0);
  const body = anyErr?.body ?? anyErr?.response?.data ?? {};
  const code = String(body?.code || '').trim();
  const message = String(anyErr?.message || body?.message || '').trim();

  if (isModulePolicyVersionConflict(err)) return 'Founder Access Control changed since this page was loaded. Refresh the latest policy.';
  if ((status === 400 || status === 422) && (code === 'INVALID_MODULE_POLICY_PAYLOAD' || code === 'MODULE_POLICY_VALIDATION_FAILED' || /invalid module policy payload/i.test(message))) {
    return 'The Founder policy data did not match the backend contract.';
  }
  if (status === 401) return 'Authentication required.';
  if (status === 403) return 'Founder authorization required.';
  return message || 'Failed to save Founder access policy.';
}

function assertModulePolicyPayloadVersion(payload: SerializedModulePolicyPayload) {
  if (!isValidFounderModulePolicyVersion(payload.expectedVersion)) throw new Error(FOUNDER_MODULE_POLICY_VERSION_ERROR);
}

function logModulePolicyRequest(endpoint: string, method: 'POST' | 'PUT', payload: SerializedModulePolicyPayload) {
  if (!import.meta.env.DEV) return;
  try {
    console.info('[FounderModulePolicy]', {
      endpoint,
      method,
      expectedVersion: payload.expectedVersion,
      moduleKeys: Object.keys(payload.modulePolicies),
      policyStates: payload.modulePolicies,
    });
  } catch {
    // ignore local debug logging failures
  }
}

export function clearFounderModulePolicyCache() {
  founderModulePolicyCache = null;
  founderModulePolicyInflight = null;
  founderModulePolicyLoadError = null;
}

export async function getFounderModulePolicySnapshot(options: { force?: boolean } = {}): Promise<FounderModulePolicySnapshot> {
  if (options.force) clearFounderModulePolicyCache();
  if (founderModulePolicyCache) return founderModulePolicyCache;
  if (Number(founderModulePolicyLoadError?.status ?? founderModulePolicyLoadError?.response?.status ?? 0) === 404) throw founderModulePolicyLoadError;
  if (!founderModulePolicyInflight) {
    founderModulePolicyInflight = api(FOUNDER_MODULE_POLICY_API.load)
      .then((response) => {
        const snapshot = readFounderModulePolicySnapshot(response);
        founderModulePolicyCache = snapshot;
        founderModulePolicyLoadError = null;
        return snapshot;
      })
      .catch((err) => {
        founderModulePolicyLoadError = err;
        throw err;
      })
      .finally(() => {
        founderModulePolicyInflight = null;
      });
  }
  return founderModulePolicyInflight;
}

export async function getFounderModulePolicy(): Promise<AdminModulePolicyMap> {
  const snapshot = await getFounderModulePolicySnapshot();
  return snapshot.policy;
}

export function createFounderModulePolicyPayload(policy: AdminModulePolicyMap, auditReason: string, expectedVersion: number, basePolicy?: AdminModulePolicyMap): SerializedModulePolicyPayload {
  if (!isValidFounderModulePolicyVersion(expectedVersion)) throw new Error(FOUNDER_MODULE_POLICY_VERSION_ERROR);
  return serializeModulePolicyPayload(policy, auditReason, expectedVersion, { basePolicy });
}

export async function previewFounderModulePolicy(payload: SerializedModulePolicyPayload): Promise<any> {
  assertModulePolicyPayloadVersion(payload);
  logModulePolicyRequest(FOUNDER_MODULE_POLICY_API.preview, 'POST', payload);
  return api(FOUNDER_MODULE_POLICY_API.preview, {
    method: 'POST',
    json: payload,
  });
}

export async function putFounderModulePolicy(payload: SerializedModulePolicyPayload): Promise<FounderModulePolicySnapshot> {
  assertModulePolicyPayloadVersion(payload);
  logModulePolicyRequest(FOUNDER_MODULE_POLICY_API.save, 'PUT', payload);
  const response = await api(FOUNDER_MODULE_POLICY_API.save, {
    method: 'PUT',
    json: payload,
  });
  const next = readFounderModulePolicySnapshot(response);
  founderModulePolicyCache = next;
  founderModulePolicyLoadError = null;
  return next;
}

export async function getFounderModulePolicyAudit(limit = 50): Promise<any> {
  return api(`${FOUNDER_MODULE_POLICY_API.audit}?limit=${encodeURIComponent(String(limit))}`);
}
