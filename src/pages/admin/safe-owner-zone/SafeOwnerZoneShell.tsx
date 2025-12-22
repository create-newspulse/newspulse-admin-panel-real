import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import settingsApi from '@/lib/settingsApi';
import { useFounderActions } from '@/sections/SafeOwnerZone/hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';
import RollbackDialog from '@/sections/SafeOwnerZone/widgets/RollbackDialog';
import ConfirmDangerModal from '@/components/modals/ConfirmDangerModal';
import { isOwnerKeyUnlocked, useOwnerKeyStore } from '@/lib/ownerKeyStore';
import { createSnapshot, getRecentAudit, health as ownerZoneHealth, listSnapshots } from '@/api/ownerZone';

export type OwnerZoneStatus = 'UNLOCKED' | 'READ-ONLY' | 'LOCKDOWN' | 'Awaiting backend';

export type OwnerZoneShellContext = {
  backendConnected: boolean;
  settings: any | null;
  health: any | null;
  audit: Array<{ ts?: string; type?: string; actorId?: string; role?: string; payload?: any }>;
  lastSnapshotAt: string | null;
  lastAuditAt: string | null;

  status: OwnerZoneStatus;
  canUseDangerActions: boolean;
  busy: boolean;
  updateAdminSettings: (patch: any, auditAction?: string) => Promise<void>;
  doSnapshot: () => Promise<void>;
  openRollback: () => void;
  openEmergencyLockdown: () => void;
};

type ModuleTab = { key: string; label: string; to: string; end?: boolean };

const TABS: ModuleTab[] = [
  { key: 'hub', label: 'Hub', to: '/admin/safe-owner-zone', end: true },
  { key: 'founder', label: 'Founder', to: '/admin/safe-owner-zone/founder' },
  { key: 'security', label: 'Security Center', to: '/admin/safe-owner-zone/security-lockdown' },
  { key: 'compliance', label: 'Compliance', to: '/admin/safe-owner-zone/compliance' },
  { key: 'ai', label: 'AI', to: '/admin/safe-owner-zone/ai-control' },
  { key: 'vaults', label: 'Vaults', to: '/admin/safe-owner-zone/vaults' },
  { key: 'ops', label: 'Ops', to: '/admin/safe-owner-zone/operations' },
  { key: 'revenue', label: 'Revenue', to: '/admin/safe-owner-zone/revenue' },
  { key: 'oversight', label: 'Oversight', to: '/admin/safe-owner-zone/admin-oversight' },
];

function formatWhen(ts: string | null | undefined) {
  if (!ts) return 'Awaiting backend';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function statusPillClass(status: OwnerZoneStatus) {
  if (status === 'LOCKDOWN') {
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700';
  }
  if (status === 'READ-ONLY') {
    return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700';
  }
  if (status === 'UNLOCKED') {
    return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
}

export default function SafeOwnerZoneShell() {
  const notify = useNotify();
  const { lockdown } = useFounderActions();
  const setOwnerMode = useOwnerKeyStore((s) => s.setMode);
  const ownerUnlockedUntilMs = useOwnerKeyStore((s) => s.unlockedUntilMs);

  const [settings, setSettings] = useState<any | null>(null);
  const [health, setHealth] = useState<any | null>(null);
  const [audit, setAudit] = useState<Array<{ ts?: string; type?: string; actorId?: string; role?: string; payload?: any }>>([]);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<string | null>(null);

  const [backendConnected, setBackendConnected] = useState(true);
  const [busy, setBusy] = useState(false);

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const results = await Promise.allSettled([
        settingsApi.getAdminSettings(),
        ownerZoneHealth().catch(() => null as any),
        getRecentAudit(30).catch(() => null as any),
        listSnapshots(20).catch(() => null as any),
      ]);

      if (!mounted) return;

      const okAny = results.some((r) => r.status === 'fulfilled' && r.value != null);
      setBackendConnected(okAny);

      const s = results[0].status === 'fulfilled' ? results[0].value : null;
      setSettings(s);

      const h = results[1].status === 'fulfilled' ? results[1].value : null;
      setHealth(h);

      const a = results[2].status === 'fulfilled' ? results[2].value : null;
      setAudit(Array.isArray((a as any)?.items) ? (a as any).items.slice(0, 30) : []);

      const snaps = results[3].status === 'fulfilled' ? results[3].value : null;
      const items = Array.isArray((snaps as any)?.items) ? (snaps as any).items : Array.isArray(snaps) ? (snaps as any) : [];
      const latest = items[0] || null;
      const ts = latest?.ts || latest?.createdAt || latest?.created_at || latest?.time || latest?.at || null;
      setLastSnapshotAt(typeof ts === 'string' ? ts : null);
    })();

    return () => {
      mounted = false;
    };
  }, [listSnapshots]);

  const status: OwnerZoneStatus = useMemo(() => {
    if (!backendConnected || !settings) return 'Awaiting backend';
    const isLockdown = settings?.security?.lockdown === true;
    const isReadOnly = settings?.publishing?.readOnly === true;
    if (isLockdown) return 'LOCKDOWN';
    if (isReadOnly) return 'READ-ONLY';
    return 'UNLOCKED';
  }, [backendConnected, settings]);

  useEffect(() => {
    if (status === 'LOCKDOWN') setOwnerMode('LOCKDOWN');
    else if (status === 'READ-ONLY') setOwnerMode('READONLY');
    else if (status === 'UNLOCKED') setOwnerMode('NORMAL');
  }, [status, setOwnerMode]);

  const lastAuditAt = useMemo(() => (audit?.[0]?.ts ? audit[0].ts : null), [audit]);

  const canUseDangerActions = isOwnerKeyUnlocked(ownerUnlockedUntilMs) && backendConnected && status === 'UNLOCKED' && !busy;

  async function doSnapshot() {
    if (!canUseDangerActions) return;
    setBusy(true);
    try {
      const r: any = await createSnapshot({ label: 'Owner Control Center snapshot', reason: 'Safe Owner Zone manual snapshot' });
      const id = r?.id || r?._id || r?.snapshotId;
      if (id) notify.ok('Snapshot created', String(id));
      else notify.ok('Snapshot created');
    } catch (e: any) {
      notify.err('Snapshot failed', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function updateAdminSettings(patch: any, auditAction?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await settingsApi.putAdminSettings(patch || {}, auditAction ? { action: auditAction } : undefined);
      setSettings(next);
    } finally {
      setBusy(false);
    }
  }

  const outletCtx: OwnerZoneShellContext = {
    backendConnected,
    settings,
    health,
    audit,
    lastSnapshotAt,
    lastAuditAt,
    status,
    canUseDangerActions,
    busy,
    updateAdminSettings,
    doSnapshot,
    openRollback: () => setRollbackOpen(true),
    openEmergencyLockdown: () => setLockConfirmOpen(true),
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 md:-mx-6 md:px-6">
        {/* Owner Command Bar */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Owner Control Center</h1>
                <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusPillClass(status)}`}>
                  {status}
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Enterprise-grade controls, visibility, and governance.</div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-right sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Last snapshot</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{formatWhen(lastSnapshotAt)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Last audit event</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{formatWhen(lastAuditAt)}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                disabled={!canUseDangerActions}
                onClick={doSnapshot}
              >
                Snapshot
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
                disabled={!canUseDangerActions}
                onClick={() => setRollbackOpen(true)}
              >
                Rollback
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                disabled={!canUseDangerActions}
                onClick={() => setLockConfirmOpen(true)}
              >
                Emergency Lockdown
              </button>
            </div>
          </div>
        </div>

        {/* Module Switcher Tabs */}
        <div className="mt-4 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2">
            {TABS.map((t) => (
              <NavLink
                key={t.key}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `rounded-full border px-3 py-1.5 text-sm font-semibold transition whitespace-nowrap ${
                    isActive
                      ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <Outlet context={outletCtx} />

      <RollbackDialog open={rollbackOpen} onClose={() => setRollbackOpen(false)} />

      <ConfirmDangerModal
        open={lockConfirmOpen}
        title="Emergency Lockdown"
        description="This is a dangerous action. Type CONFIRM to trigger lockdown."
        confirmLabel="CONFIRM"
        requirePin={false}
        confirmButtonText="Trigger Lockdown"
        danger
        onClose={() => setLockConfirmOpen(false)}
        onConfirm={async () => {
          if (!canUseDangerActions) return;
          setBusy(true);
          try {
            const r: any = await lockdown({ reason: 'Owner Control Center emergency lockdown', scope: 'site' });
            (window as any).__LOCK_STATE__ = r?.ok ? 'LOCKED' : (window as any).__LOCK_STATE__ || 'UNLOCKED';
            if (r?.ok) notify.ok('Lockdown enabled');
            else notify.err('Lockdown failed', r?.error || 'Unknown error');
          } catch (e: any) {
            notify.err('Lockdown failed', e?.message || 'Unknown error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
