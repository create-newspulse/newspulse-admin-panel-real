import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { translationUiEnabled } from '@/config/featureFlags';
import { useNotify } from '@/components/ui/toast-bridge';
import type { OwnerZoneShellContext } from './SafeOwnerZoneShell';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import ownerPasskeyApi from '@/lib/ownerPasskeyApi';
import { useOwnerKeyStore } from '@/lib/ownerKeyStore';

type AuditRow = {
  ts?: string;
  type?: string;
  actorId?: string;
  role?: string;
  payload?: any;
};

type ToggleState = { value: boolean | undefined; label: string; statusText: string; disabled: boolean };

function formatWhen(ts: string | null | undefined) {
  if (!ts) return '—';
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
  const unlockForMs = useOwnerKeyStore((s) => s.unlockForMs);
  const showTranslationUi = translationUiEnabled();
  const {
    backendConnected,
    settings,
    health,
    audit,
    canUseDangerActions,
    busy,
    doSnapshot,
    openRollback,
  } = useOutletContext<OwnerZoneShellContext>();

  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyKnown, setPasskeyKnown] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState<'none' | 'setup' | 'unlock'>('none');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await ownerPasskeyApi.status();
        const v = Boolean((r as any)?.hasPasskey);
        if (!mounted) return;
        setHasPasskey(v);
        setPasskeyKnown(true);
      } catch {
        if (!mounted) return;
        // If status endpoint isn't available yet, assume no passkey so setup is visible.
        setHasPasskey(false);
        setPasskeyKnown(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSetupPasskey() {
    if (passkeyBusy !== 'none') return;
    setPasskeyBusy('setup');
    try {
      const options = await ownerPasskeyApi.registerOptions();
      const attestation = await startRegistration(options as any);
      await ownerPasskeyApi.registerVerify(attestation);
      setHasPasskey(true);
      setPasskeyKnown(true);
      notify.ok('Passkey setup complete');
    } catch (e: any) {
      notify.err('Passkey setup failed', e?.message || 'Unknown error');
    } finally {
      setPasskeyBusy('none');
    }
  }

  async function onUnlockOwnerKey() {
    if (passkeyBusy !== 'none') return;
    setPasskeyBusy('unlock');
    try {
      const options = await ownerPasskeyApi.authOptions();
      const assertion = await startAuthentication(options as any);
      const verifyRes: any = await ownerPasskeyApi.authVerify(assertion);
      const ttlMs =
        typeof verifyRes?.ttlMs === 'number'
          ? verifyRes.ttlMs
          : typeof verifyRes?.ttlSec === 'number'
            ? verifyRes.ttlSec * 1000
            : 10 * 60 * 1000;
      unlockForMs(ttlMs);
      notify.ok('Owner Key unlocked');
    } catch (e: any) {
      notify.err('Unlock failed', e?.message || 'Unknown error');
    } finally {
      setPasskeyBusy('none');
    }
  }

  const readOnlyToggle: ToggleState = useMemo(() => {
    if (!settings) return { value: undefined, label: 'ReadOnly', statusText: '—', disabled: true };
    const v = settings?.publishing?.readOnly;
    return { value: typeof v === 'boolean' ? v : undefined, label: 'ReadOnly', statusText: typeof v === 'boolean' ? (v ? 'Enabled' : 'Disabled') : 'Not configured', disabled: !canUseDangerActions || busy };
  }, [settings, canUseDangerActions, busy]);

  const autoPublishToggle: ToggleState = useMemo(() => {
    if (!settings) return { value: undefined, label: 'AutoPublish', statusText: '—', disabled: true };
    const v = settings?.publishing?.autoPublishApproved;
    return { value: typeof v === 'boolean' ? v : undefined, label: 'AutoPublish', statusText: typeof v === 'boolean' ? (v ? 'Enabled' : 'Disabled') : 'Not configured', disabled: !canUseDangerActions || busy };
  }, [settings, canUseDangerActions, busy]);

  const externalFetchToggle: ToggleState = useMemo(() => {
    if (!settings) return { value: undefined, label: 'ExternalFetch', statusText: '—', disabled: true };
    const v = settings?.integrations?.externalFetch;
    return { value: typeof v === 'boolean' ? v : undefined, label: 'ExternalFetch', statusText: typeof v === 'boolean' ? (v ? 'Enabled' : 'Disabled') : 'Not configured', disabled: !canUseDangerActions || busy };
  }, [settings, canUseDangerActions, busy]);

  const healthState = useMemo(() => {
    if (!health) {
      return {
        api: '—',
        dbPing: '—',
        lastJob: '—',
        uptime: '—',
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
      dbPing: typeof dbPingMs === 'number' ? `${dbPingMs} ms` : typeof dbPingMs === 'string' ? dbPingMs : '—',
      lastJob: typeof lastJob === 'string' ? lastJob : lastJob ? String(lastJob) : '—',
      uptime: typeof uptime === 'number' ? `${Math.round(uptime)} s` : typeof uptime === 'string' ? uptime : '—',
    };
  }, [health]);

  const filteredTimeline = useMemo(() => {
    const items = Array.isArray(audit) ? audit : [];
    if (timelineFilter === 'All') return items;
    return items.filter((r) => classifyAudit(r) === timelineFilter);
  }, [audit, timelineFilter]);

  async function toggleSetting(kind: 'readOnly' | 'autoPublish' | 'externalFetch', next: boolean) {
    if (!settings) return;
    try {
      if (kind === 'readOnly') {
        await updateAdminSettings({ publishing: { readOnly: next } } as any, 'owner.zone.toggle.readonly');
        notify.ok('Updated', `ReadOnly ${next ? 'enabled' : 'disabled'}`);
      } else if (kind === 'autoPublish') {
        await updateAdminSettings({ publishing: { autoPublishApproved: next } } as any, 'owner.zone.toggle.autopublish');
        notify.ok('Updated', `AutoPublish ${next ? 'enabled' : 'disabled'}`);
      } else {
        await updateAdminSettings({ integrations: { externalFetch: next } } as any, 'owner.zone.toggle.externalfetch');
        notify.ok('Updated', `ExternalFetch ${next ? 'enabled' : 'disabled'}`);
      }
    } catch (e: any) {
      notify.err('Update failed', e?.message || 'Unknown error');
    }
  }

  return (
    <div className="space-y-6">
      {/* A) Backend banner (ONLY once; no per-line repetition) */}
      {!backendConnected ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          Backend not connected — showing placeholders
        </div>
      ) : null}

      {/* Owner Key (Passkey/WebAuthn) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold">Owner Key</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Passkey-based unlock for high-risk actions.</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!hasPasskey ? (
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                onClick={onSetupPasskey}
                disabled={passkeyBusy !== 'none'}
              >
                {passkeyBusy === 'setup' ? 'Setting up…' : 'Setup Passkey'}
              </button>
            ) : null}

            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              onClick={onUnlockOwnerKey}
              disabled={passkeyBusy !== 'none'}
            >
              {passkeyBusy === 'unlock' ? 'Unlocking…' : 'Unlock Owner Key'}
            </button>
          </div>
        </div>

        {!passkeyKnown ? (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Passkey status unavailable — showing setup by default.
          </div>
        ) : null}
      </div>

      {/* B) Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Advanced Controls */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div className="text-lg font-semibold">Advanced Controls</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Specialized admin tooling.</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            {showTranslationUi ? (
              <Link
                to="/admin/review-queue"
                className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Review Queue</div>
                    <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Approvals • PTI • Legal • Founder</div>
                  </div>
                  <div className="shrink-0 text-lg leading-none">🧭</div>
                </div>
              </Link>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Translation review tools are disabled.
              </div>
            )}
          </div>
        </div>

        {/* Live Controls */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Live Controls</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Operational switches and emergency actions.</div>
            </div>
            {!canUseDangerActions ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Danger locked
              </span>
            ) : null}
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
              disabled={!canUseDangerActions || busy}
            >
              Snapshot
            </button>
            <button
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              onClick={openRollback}
              disabled={!canUseDangerActions || busy}
            >
              Rollback
            </button>
            <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              onClick={openEmergencyLockdown}
              disabled={!canUseDangerActions || busy}
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
              : 'Health is derived from /system/health.'}
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
            <ul className="space-y-2">
              {filteredTimeline.map((r, i) => {
                const bucket = classifyAudit(r);
                const icon = bucket === 'Security' ? '🛡️' : bucket === 'AI' ? '🤖' : bucket === 'Settings' ? '⚙️' : bucket === 'Revenue' ? '💰' : '🧾';
                const actor = r.actorId ? `${r.actorId}${r.role ? ` (${r.role})` : ''}` : 'system';
                return (
                  <li key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="text-lg leading-none">{icon}</div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{r.type || 'event'}</div>
                          <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Actor: {actor}</div>
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-slate-600 dark:text-slate-300">{formatWhen(r.ts)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">Showing {filteredTimeline.length} event(s)</div>
      </div>
    </div>
  );
}
