import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import settingsApi from '@/lib/settingsApi';
import { useFounderActions } from '@/sections/SafeOwnerZone/hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';
import RollbackDialog from '@/sections/SafeOwnerZone/widgets/RollbackDialog';
import ConfirmDangerModal from '@/components/modals/ConfirmDangerModal';
import { useAuth } from '@/context/AuthContext';

type AuditRow = {
  ts?: string;
  type?: string;
  actorId?: string;
  role?: string;
  payload?: any;
};

type ToggleState = { value: boolean | undefined; label: string; statusText: string; disabled: boolean };

function formatWhen(ts: string | null | undefined) {
  if (!ts) return 'Awaiting backend';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function toCsv(rows: AuditRow[]) {
  const header = ['ts', 'type', 'actorId', 'role', 'payload'];
  const esc = (v: any) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
    return `"${String(s).replaceAll('"', '""')}"`;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([esc(r.ts), esc(r.type), esc(r.actorId), esc(r.role), esc(r.payload)].join(','));
  }
  return lines.join('\n');
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function classifyAudit(r: AuditRow): 'Security' | 'AI' | 'Settings' | 'Revenue' | 'All' {
  const t = String(r.type || '').toLowerCase();
  if (!t) return 'All';
  if (t.includes('security') || t.includes('lock') || t.includes('auth')) return 'Security';
  if (t.includes('ai') || t.includes('model')) return 'AI';
  if (t.includes('settings') || t.includes('config') || t.includes('admin.settings')) return 'Settings';
  if (t.includes('revenue') || t.includes('ads') || t.includes('monet')) return 'Revenue';
  return 'All';
}

export default function SafeOwnerZoneHub() {
  const notify = useNotify();
  const { user } = useAuth();
  const { snapshot, lockdown, listSnapshots } = useFounderActions();

  const [settings, setSettings] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [dangerUnlocked, setDangerUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'All' | 'Security' | 'AI' | 'Settings' | 'Revenue'>('All');

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    settingsApi
      .getAdminSettings()
      .then((s) => mounted && setSettings(s))
      .catch(() => mounted && setSettings(null));

    fetch('/api/system/health', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => mounted && setHealth(j))
      .catch(() => mounted && setHealth(null));

    fetch('/api/audit/recent?limit=20', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => mounted && setAudit(Array.isArray(j?.items) ? j.items.slice(0, 20) : []))
      .catch(() => mounted && setAudit([]));

    // Best-effort snapshot timestamp (for header)
    listSnapshots()
      .then((r: any) => {
        if (!mounted) return;
        const items = Array.isArray(r?.items) ? r.items : [];
        const latest = items[0] || null;
        const ts =
          latest?.ts ||
          latest?.createdAt ||
          latest?.created_at ||
          latest?.time ||
          latest?.at ||
          null;
        setLastSnapshotAt(typeof ts === 'string' ? ts : null);
      })
      .catch(() => mounted && setLastSnapshotAt(null));

    return () => {
      mounted = false;
    };
  }, [listSnapshots]);

  const lockState = useMemo(() => {
    const lockdown = settings?.security?.lockdown === true;
    const readOnly = settings?.publishing?.readOnly === true;
    if (lockdown) return { label: 'LOCKDOWN' as const, tone: 'danger' as const };
    if (readOnly) return { label: 'READ-ONLY' as const, tone: 'warn' as const };
    return { label: 'UNLOCKED' as const, tone: 'ok' as const };
  }, [settings]);

  const headerPillClass =
    lockState.tone === 'danger'
      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
      : lockState.tone === 'warn'
        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700'
        : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700';

  const accessBadge = useMemo(() => {
    const role = String((user as any)?.role || '').toLowerCase();
    if (role === 'founder') return { label: 'FOUNDER ACCESS', tone: 'founder' as const };
    if (role === 'admin') return { label: 'ADMIN ACCESS', tone: 'admin' as const };
    return { label: 'ACCESS', tone: 'admin' as const };
  }, [user]);

  const accessBadgeClass =
    accessBadge.tone === 'founder'
      ? 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700'
      : 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700';

  const lastAuditAt = useMemo(() => (audit?.[0]?.ts ? audit[0].ts : null), [audit]);

  const canUseDangerActions = dangerUnlocked && Boolean(pin);

  const readOnlyToggle: ToggleState = useMemo(() => {
    if (!settings) return { value: undefined, label: 'ReadOnly', statusText: 'Awaiting backend', disabled: true };
    const v = settings?.publishing?.readOnly;
    return { value: typeof v === 'boolean' ? v : undefined, label: 'ReadOnly', statusText: typeof v === 'boolean' ? (v ? 'Enabled' : 'Disabled') : 'Not configured', disabled: !canUseDangerActions || busy };
  }, [settings, canUseDangerActions, busy]);

  const autoPublishToggle: ToggleState = useMemo(() => {
    if (!settings) return { value: undefined, label: 'AutoPublish', statusText: 'Awaiting backend', disabled: true };
    const v = settings?.publishing?.autoPublishApproved;
    return { value: typeof v === 'boolean' ? v : undefined, label: 'AutoPublish', statusText: typeof v === 'boolean' ? (v ? 'Enabled' : 'Disabled') : 'Not configured', disabled: !canUseDangerActions || busy };
  }, [settings, canUseDangerActions, busy]);

  const externalFetchToggle: ToggleState = useMemo(() => {
    if (!settings) return { value: undefined, label: 'ExternalFetch', statusText: 'Awaiting backend', disabled: true };
    const v = settings?.integrations?.externalFetch;
    return { value: typeof v === 'boolean' ? v : undefined, label: 'ExternalFetch', statusText: typeof v === 'boolean' ? (v ? 'Enabled' : 'Disabled') : 'Not configured', disabled: !canUseDangerActions || busy };
  }, [settings, canUseDangerActions, busy]);

  const healthState = useMemo(() => {
    if (!health) {
      return {
        api: 'Awaiting backend',
        dbPing: 'Awaiting backend',
        lastJob: 'Awaiting backend',
        uptime: 'Awaiting backend',
      };
    }
    if (health?.proxied === false) {
      return {
        api: 'Not configured',
        dbPing: 'Not configured',
        lastJob: 'Not configured',
        uptime: 'Not configured',
      };
    }
    const ok = health?.success === true || health?.ok === true;

    const backend = health?.backend || {};
    const dbPingMs =
      backend?.db?.pingMs ??
      backend?.db?.ping_ms ??
      backend?.database?.pingMs ??
      backend?.mongo?.pingMs ??
      backend?.checks?.dbPingMs ??
      null;

    const lastJob =
      backend?.jobs?.lastRun ??
      backend?.cron?.lastRun ??
      backend?.lastJobRun ??
      backend?.jobs?.last_run ??
      null;

    const uptime = backend?.uptime ?? backend?.uptimeSec ?? backend?.uptimeSeconds ?? null;

    return {
      api: ok ? 'OK' : 'Degraded',
      dbPing: typeof dbPingMs === 'number' ? `${dbPingMs} ms` : typeof dbPingMs === 'string' ? dbPingMs : 'Awaiting backend',
      lastJob: typeof lastJob === 'string' ? lastJob : lastJob ? String(lastJob) : 'Awaiting backend',
      uptime: typeof uptime === 'number' ? `${Math.round(uptime)} s` : typeof uptime === 'string' ? uptime : 'Awaiting backend',
    };
  }, [health]);

  const filteredTimeline = useMemo(() => {
    const items = Array.isArray(audit) ? audit : [];
    if (timelineFilter === 'All') return items;
    return items.filter((r) => classifyAudit(r) === timelineFilter);
  }, [audit, timelineFilter]);

  async function toggleSetting(kind: 'readOnly' | 'autoPublish' | 'externalFetch', next: boolean) {
    if (!settings) return;
    setBusy(true);
    try {
      if (kind === 'readOnly') {
        const s = await settingsApi.putAdminSettings({ publishing: { readOnly: next } } as any, { action: 'owner.zone.toggle.readonly' });
        setSettings(s);
        notify.ok('Updated', `ReadOnly ${next ? 'enabled' : 'disabled'}`);
      } else if (kind === 'autoPublish') {
        const s = await settingsApi.putAdminSettings({ publishing: { autoPublishApproved: next } } as any, { action: 'owner.zone.toggle.autopublish' });
        setSettings(s);
        notify.ok('Updated', `AutoPublish ${next ? 'enabled' : 'disabled'}`);
      } else {
        const s = await settingsApi.putAdminSettings({ integrations: { externalFetch: next } } as any, { action: 'owner.zone.toggle.externalfetch' });
        setSettings(s);
        notify.ok('Updated', `ExternalFetch ${next ? 'enabled' : 'disabled'}`);
      }
    } catch (e: any) {
      notify.err('Update failed', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function doSnapshot() {
    try {
      const r = await snapshot('Safe Owner Zone HUB snapshot');
      if (r.ok) notify.ok('Snapshot created', r.id);
      else notify.err('Snapshot failed', r.error);
    } catch (e: any) {
      notify.err('Snapshot failed', e?.message || 'Unknown error');
    }
  }

  return (
    <div className="space-y-6">
      {/* A) Command Center Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Owner Control Center</h1>
              <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${headerPillClass}`}>
                {lockState.label}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${accessBadgeClass}`}>
                {accessBadge.label}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Safe Owner Zone — system controls, health, and audit visibility.</div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">Last snapshot</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatWhen(lastSnapshotAt)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">Last audit event</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatWhen(lastAuditAt)}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <input
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="Founder PIN"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                // If pin is cleared, relock actions.
                if (!e.target.value) setDangerUnlocked(false);
              }}
              type="password"
              inputMode="numeric"
            />
            <button
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              disabled={!pin || dangerUnlocked}
              onClick={() => setDangerUnlocked(true)}
              title={dangerUnlocked ? 'Danger actions unlocked for this session' : 'Unlock dangerous actions'}
            >
              {dangerUnlocked ? 'Unlocked' : 'Unlock Danger Actions'}
            </button>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300">
            Dangerous actions are disabled until you unlock.
          </div>
        </div>
      </div>

      {/* D) Pinned links row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" to="/admin/safe-owner-zone/founder">
          🎛️ Founder Command
        </Link>
        <Link className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" to="/admin/safe-owner-zone/security-lockdown">
          🛡️ Security &amp; Lockdown
        </Link>
        <Link className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" to="/admin/settings/audit-logs">
          🧾 Audit Logs
        </Link>
        <Link className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" to="/admin/settings">
          ⚙️ Settings
        </Link>
      </div>

      {/* B) Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Live Controls */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Live Controls</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Operational switches and emergency actions.</div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{canUseDangerActions ? 'Danger unlocked' : 'Danger locked'}</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            {/* Toggles */}
            {[readOnlyToggle, autoPublishToggle, externalFetchToggle].map((t) => {
              const pressed = t.value === true;
              const neutral = t.value !== true && t.value !== false;
              return (
                <div key={t.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{t.label}</div>
                    <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{t.statusText}</div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    disabled={t.disabled}
                    onClick={() => {
                      if (t.label === 'ReadOnly') toggleSetting('readOnly', !(t.value === true));
                      else if (t.label === 'AutoPublish') toggleSetting('autoPublish', !(t.value === true));
                      else toggleSetting('externalFetch', !(t.value === true));
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      neutral
                        ? 'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'
                        : pressed
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
                    }`}
                  >
                    {neutral ? 'Enable' : pressed ? 'On' : 'Off'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              onClick={doSnapshot}
              disabled={busy}
            >
              Snapshot
            </button>
            <button
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              onClick={() => setRollbackOpen(true)}
              disabled={!canUseDangerActions || busy}
              title={!canUseDangerActions ? 'Unlock danger actions to use rollback' : ''}
            >
              Rollback
            </button>
            <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              onClick={() => setLockConfirmOpen(true)}
              disabled={!canUseDangerActions || busy}
              title={!canUseDangerActions ? 'Unlock danger actions to use emergency lockdown' : ''}
            >
              Emergency Lockdown
            </button>
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div className="text-lg font-semibold">System Health</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Live backend reachability and telemetry.</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            {[
              { k: 'API status', v: healthState.api },
              { k: 'DB ping', v: healthState.dbPing },
              { k: 'Last job run', v: healthState.lastJob },
              { k: 'Uptime', v: healthState.uptime },
            ].map((x) => (
              <div key={x.k} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{x.k}</div>
                <div className="text-sm text-slate-700 dark:text-slate-200">{x.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {health?.proxied === false
              ? 'ADMIN_BACKEND_URL not configured for proxy health.'
              : 'Health is derived from /api/system/health.'}
          </div>
        </div>
      </div>

      {/* C) Activity Timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold">Activity Timeline</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Last 20 audit events.</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['All', 'Security', 'AI', 'Settings', 'Revenue'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  timelineFilter === t
                    ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
                onClick={() => setTimelineFilter(t)}
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              onClick={() => {
                const csv = toCsv(filteredTimeline);
                const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
                downloadText(`safe-owner-zone-audit-${stamp}.csv`, csv);
              }}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4">
          {filteredTimeline.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              No audit events.
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 h-full w-px bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-3">
                {filteredTimeline.map((r, i) => {
                  const when = r.ts ? new Date(r.ts).toLocaleString() : 'Awaiting backend';
                  const actor = r.actorId ? `${r.actorId}${r.role ? ` (${r.role})` : ''}` : 'system';
                  return (
                    <div key={i} className="relative pl-9">
                      <div className="absolute left-2 top-3 h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{r.type || 'event'}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-300">{when}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Actor: {actor}</div>
                        {r.payload ? (
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            {JSON.stringify(r.payload, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Link className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400" to="/admin/safe-owner-zone/admin-oversight">
            Open Admin Oversight
          </Link>
          <div className="text-xs text-slate-500 dark:text-slate-400">Showing {filteredTimeline.length} event(s)</div>
        </div>
      </div>

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
          const r = await lockdown({ reason: 'Owner Control Center emergency lockdown', scope: 'site', pin });
          (window as any).__LOCK_STATE__ = r.ok ? 'LOCKED' : (window as any).__LOCK_STATE__ || 'UNLOCKED';
          if (r.ok) notify.ok('Lockdown enabled');
          else notify.err('Lockdown failed', r.error);
        }}
      />
    </div>
  );
}
