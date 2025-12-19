import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import settingsApi from '@/lib/settingsApi';
import { useFounderActions } from '@/sections/SafeOwnerZone/hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';
import RollbackDialog from '@/sections/SafeOwnerZone/widgets/RollbackDialog';
import ConfirmDangerModal from '@/components/modals/ConfirmDangerModal';

type AuditRow = {
  ts?: string;
  type?: string;
  actorId?: string;
  role?: string;
  payload?: any;
};

const MODULE_CARDS = [
  { key: 'founder', title: 'Founder Command', desc: 'Snapshots, command palette, runbooks', to: '/admin/safe-owner-zone/founder' },
  { key: 'security-lockdown', title: 'Security & Lockdown', desc: 'Threat scan, alerts, lockdown controls', to: '/admin/safe-owner-zone/security-lockdown' },
  { key: 'compliance', title: 'Compliance', desc: 'Policies, audits, enforcement', to: '/admin/safe-owner-zone/compliance' },
  { key: 'ai-control', title: 'AI Control', desc: 'Guardrails, activity, tools', to: '/admin/safe-owner-zone/ai-control' },
  { key: 'vaults', title: 'Vaults', desc: 'API keys, secure files, backups', to: '/admin/safe-owner-zone/vaults' },
  { key: 'operations', title: 'Operations', desc: 'Uptime, health, monitoring', to: '/admin/safe-owner-zone/operations' },
  { key: 'revenue', title: 'Revenue', desc: 'Revenue + forecasts', to: '/admin/safe-owner-zone/revenue' },
  { key: 'admin-oversight', title: 'Admin Oversight', desc: 'Audit viewer and admin tooling', to: '/admin/safe-owner-zone/admin-oversight' },
] as const;

function StatusCard({ label, value }: { label: string; value: { state: 'on' | 'off' | 'unknown'; text?: string } }) {
  const pillClass =
    value.state === 'on'
      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700'
      : value.state === 'off'
        ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700';

  const text = value.text || (value.state === 'on' ? 'Enabled' : value.state === 'off' ? 'Disabled' : 'Unknown');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-2 inline-flex items-center rounded-full border px-2 py-1 text-xs ${pillClass}`}>{text}</div>
    </div>
  );
}

function HealthCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function SafeOwnerZoneHub() {
  const notify = useNotify();
  const { snapshot, lockdown } = useFounderActions();

  const [settings, setSettings] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);

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

    fetch('/api/audit/recent?limit=10', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => mounted && setAudit(Array.isArray(j?.items) ? j.items.slice(0, 10) : []))
      .catch(() => mounted && setAudit([]));

    return () => {
      mounted = false;
    };
  }, []);

  const status = useMemo(() => {
    const lockdownOn = typeof settings?.security?.lockdown === 'boolean' ? settings.security.lockdown : null;
    const autoPublishOn = typeof settings?.publishing?.autoPublishApproved === 'boolean' ? settings.publishing.autoPublishApproved : null;

    const readOnlyRaw = (settings as any)?.publishing?.readOnly ?? (settings as any)?.readOnly;
    const externalFetchRaw = (settings as any)?.integrations?.externalFetch ?? (settings as any)?.externalFetch;

    const toState = (v: any): 'on' | 'off' | 'unknown' =>
      typeof v === 'boolean' ? (v ? 'on' : 'off') : 'unknown';

    return {
      lockdown: { state: toState(lockdownOn), text: lockdownOn === true ? 'LOCKDOWN' : lockdownOn === false ? 'Normal' : undefined },
      readOnly: { state: toState(readOnlyRaw) },
      autoPublish: { state: toState(autoPublishOn), text: autoPublishOn === true ? 'AutoPublish ON' : autoPublishOn === false ? 'AutoPublish OFF' : undefined },
      externalFetch: { state: toState(externalFetchRaw) },
    };
  }, [settings]);

  const apiStatus = useMemo(() => {
    if (!health) return 'Unknown';
    if (health?.success === true) return 'OK';
    if (health?.ok === true) return 'OK';
    return 'Degraded';
  }, [health]);

  const dbStatus = useMemo(() => {
    const b = health?.backend;
    const candidates = [
      b?.db?.ok,
      b?.database?.ok,
      b?.mongo?.ok,
      b?.checks?.db,
      b?.checks?.database,
    ];
    for (const c of candidates) {
      if (typeof c === 'boolean') return c ? 'OK' : 'Fail';
      if (typeof c === 'string') return c;
    }
    return 'Unknown';
  }, [health]);

  const lastJobRun = useMemo(() => {
    const b = health?.backend;
    const job = b?.jobs || b?.cron || b?.lastJobRun || null;
    if (typeof job === 'string') return job;
    if (job?.lastRun) return String(job.lastRun);
    return 'Unknown';
  }, [health]);

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
      <div>
        <h1 className="text-2xl font-semibold">Safe Owner Zone</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Owner controls, health, and audit visibility.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatusCard label="LOCKDOWN" value={status.lockdown} />
        <StatusCard label="ReadOnly" value={status.readOnly} />
        <StatusCard label="AutoPublish" value={status.autoPublish} />
        <StatusCard label="ExternalFetch" value={status.externalFetch} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="text-sm font-semibold">Quick actions</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" onClick={doSnapshot}>
            Snapshot
          </button>
          <button className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700" onClick={() => setRollbackOpen(true)}>
            Rollback
          </button>
          <button className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700" onClick={() => setLockConfirmOpen(true)}>
            Emergency Lockdown
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HealthCard label="API status" value={apiStatus} />
        <HealthCard label="DB ping" value={dbStatus} />
        <HealthCard label="Last job run" value={lastJobRun} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Recent activity</div>
          <Link className="text-sm text-blue-600 hover:underline dark:text-blue-400" to="/admin/safe-owner-zone/admin-oversight">
            Open Admin Oversight
          </Link>
        </div>
        <div className="mt-3 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Actor</th>
                <th className="p-2 text-left">Payload</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((r, i) => (
                <tr key={i} className="border-t border-slate-200 align-top dark:border-slate-700">
                  <td className="p-2 whitespace-nowrap">{r.ts ? new Date(r.ts).toLocaleString() : ''}</td>
                  <td className="p-2">{r.type || ''}</td>
                  <td className="p-2">{r.actorId ? `${r.actorId}${r.role ? ` (${r.role})` : ''}` : ''}</td>
                  <td className="p-2">
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">{r.payload ? JSON.stringify(r.payload, null, 2) : ''}</pre>
                  </td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={4}>
                    No audit events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold">Modules</div>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {MODULE_CARDS.map((m) => (
            <Link
              key={m.key}
              to={m.to}
              className="rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <div className="text-sm font-semibold">{m.title}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{m.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <RollbackDialog open={rollbackOpen} onClose={() => setRollbackOpen(false)} />

      <ConfirmDangerModal
        open={lockConfirmOpen}
        title="Emergency Lockdown"
        description="This is a dangerous action. Type CONFIRM and enter your PIN to trigger lockdown."
        confirmLabel="CONFIRM"
        requirePin
        confirmButtonText="Trigger Lockdown"
        danger
        onClose={() => setLockConfirmOpen(false)}
        onConfirm={async ({ pin }) => {
          if (!pin) return;
          const r = await lockdown({ reason: 'Safe Owner Zone HUB emergency lockdown', scope: 'site', pin });
          (window as any).__LOCK_STATE__ = r.ok ? 'LOCKED' : (window as any).__LOCK_STATE__ || 'UNLOCKED';
          if (r.ok) notify.ok('Lockdown enabled');
          else notify.err('Lockdown failed', r.error);
        }}
      />
    </div>
  );
}
