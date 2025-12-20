import { api, getOwnerUnlockToken } from '@/lib/http';

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

// Owner key
export async function getOwnerKeyStatus(): Promise<OwnerKeyStatus> {
  return api<OwnerKeyStatus>('/api/owner/key/status');
}

export async function unlockOwnerKey(pin: string): Promise<OwnerKeyStatus> {
  return api<OwnerKeyStatus>('/api/owner/key/unlock', {
    method: 'POST',
    json: { pin },
  });
}

export async function lockOwnerKey(): Promise<{ ok?: boolean } & Record<string, any>> {
  return api('/api/owner/key/lock', {
    method: 'POST',
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

// Admin settings (dangerous: requires owner unlock)
export async function getAdminSettings(): Promise<any> {
  return api('/api/admin/settings');
}

export async function putAdminSettings(patch: any): Promise<any> {
  return api('/api/admin/settings', {
    method: 'PATCH',
    json: patch || {},
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function getSystemState(): Promise<SystemState> {
  return api<SystemState>('/api/admin/system/state');
}

export async function updateSystemState(payload: Partial<SystemState>): Promise<SystemState> {
  return api<SystemState>('/api/admin/system/state', {
    method: 'PUT',
    json: payload || {},
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function lockdown(): Promise<any> {
  return api('/api/admin/system/lockdown', {
    method: 'POST',
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function reactivate(): Promise<any> {
  return api('/api/admin/system/reactivate', {
    method: 'POST',
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}

export async function health(): Promise<any> {
  return api('/api/system/health');
}

export async function getRecentAudit(limit = 30): Promise<any> {
  return api(`/api/audit/recent?limit=${encodeURIComponent(String(limit))}`);
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

function normalizeDeploy(raw: any): DeployEventItem {
  return {
    id: normalizeId(raw),
    happenedAt: raw?.happenedAt ?? raw?.createdAt,
    provider: raw?.provider,
    service: raw?.service,
    environment: raw?.environment,
    status: raw?.status,
    deployId: raw?.deployId,
    url: raw?.url,
    commitSha: raw?.commitSha,
    branch: raw?.branch,
    message: raw?.message,
    author: raw?.author,
    ...raw,
  };
}

export async function createSnapshot(payload: { label?: string; reason?: string }): Promise<SnapshotItem> {
  const raw: any = await api('/api/admin/system/snapshots', {
    method: 'POST',
    json: { label: payload?.label, reason: payload?.reason },
    ownerUnlockToken: getOwnerUnlockToken(),
  });
  return normalizeSnapshot(raw?.snapshot ?? raw);
}

export async function listSnapshots(limit = 20): Promise<{ items: SnapshotItem[] } | SnapshotItem[]> {
  const raw: any = await api(`/api/admin/system/snapshots?limit=${encodeURIComponent(String(limit))}`);
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeSnapshot) : Array.isArray(raw) ? raw.map(normalizeSnapshot) : [];
  return { items };
}

export async function rollbackApply(snapshotId: string): Promise<any> {
  return api('/api/admin/system/rollback', {
    method: 'POST',
    json: { snapshotId },
    ownerUnlockToken: getOwnerUnlockToken(),
  });
}
