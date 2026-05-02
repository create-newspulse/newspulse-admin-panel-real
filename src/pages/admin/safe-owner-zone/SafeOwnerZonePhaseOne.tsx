import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { OwnerZoneShellContext } from './SafeOwnerZoneShell';

export type SafeOwnerZonePhaseOneTab =
  | 'hub'
  | 'security'
  | 'emergency'
  | 'ai-safety'
  | 'backup'
  | 'compliance'
  | 'system-health'
  | 'audit-logs';

type Tone = 'ok' | 'warn' | 'neutral' | 'danger';

export const PHASE_ONE_SAFE_OWNER_TABS: Array<{ key: SafeOwnerZonePhaseOneTab; label: string; to: string; end?: boolean }> = [
  { key: 'hub', label: 'Hub', to: '/admin/safe-owner-zone', end: true },
  { key: 'security', label: 'Security', to: '/admin/safe-owner-zone/security' },
  { key: 'emergency', label: 'Emergency', to: '/admin/safe-owner-zone/emergency' },
  { key: 'ai-safety', label: 'AI Safety', to: '/admin/safe-owner-zone/ai-safety' },
  { key: 'backup', label: 'Backup', to: '/admin/safe-owner-zone/backup' },
  { key: 'compliance', label: 'Compliance', to: '/admin/safe-owner-zone/compliance' },
  { key: 'system-health', label: 'System Health', to: '/admin/safe-owner-zone/system-health' },
  { key: 'audit-logs', label: 'Audit Logs', to: '/admin/safe-owner-zone/audit-logs' },
];

const PHASE_ONE_PRIORITY = [
  'System Health',
  'Maintenance Mode ON/OFF',
  'Backup / Snapshot',
  'AI Safety translation status + error logs',
  'Audit Logs',
];

function formatWhen(value: string | null | undefined) {
  if (!value) return 'Not connected yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function toneClass(tone: Tone) {
  if (tone === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200';
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

function StatusCard({ label, value, tone = 'neutral', helper }: { label: string; value: string; tone?: Tone; helper?: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClass(tone)}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      {helper ? <div className="mt-1 text-sm opacity-80">{helper}</div> : null}
    </div>
  );
}

function SectionCard({ title, helper, children }: { title: string; helper?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
        {helper ? <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{helper}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PlaceholderButton({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled
      className={`rounded-xl border px-4 py-2 text-sm font-semibold opacity-75 ${
        danger
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
      }`}
      title="Phase 1 placeholder. Owner Key approval will be required in a later phase."
    >
      {children}
    </button>
  );
}

function DemoSwitch({ label, helper, danger = false }: { label: string; helper?: string; danger?: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-semibold text-slate-900 dark:text-white">{label}</div>
        {helper ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{helper}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => setChecked((value) => !value)}
        className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border-2 transition ${
          checked
            ? danger
              ? 'border-red-600 bg-red-600'
              : 'border-emerald-600 bg-emerald-600'
            : 'border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700'
        }`}
      >
        <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'translate-x-8' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function SimpleList({ items }: { items: Array<{ label: string; value: string; tone?: Tone; helper?: string }> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <StatusCard key={item.label} label={item.label} value={item.value} tone={item.tone} helper={item.helper} />
      ))}
    </div>
  );
}

function readHealthValue(health: any, keys: string[], fallback = 'Check needed') {
  for (const key of keys) {
    const parts = key.split('.');
    let cursor = health;
    for (const part of parts) cursor = cursor?.[part];
    if (cursor != null && cursor !== '') return String(cursor);
  }
  return fallback;
}

function auditKind(value: string | undefined) {
  const type = String(value || '').toLowerCase();
  if (type.includes('ai') || type.includes('translation')) return 'AI action';
  if (type.includes('lock') || type.includes('emergency')) return 'Emergency action';
  if (type.includes('security') || type.includes('auth') || type.includes('login')) return 'Security event';
  if (type.includes('settings') || type.includes('config')) return 'Setting change';
  if (type.includes('admin')) return 'Admin action';
  return 'Founder action';
}

function HeaderNote() {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
      <div className="font-semibold">Phase 1 cleanup</div>
      <div className="mt-1">Dangerous controls are placeholders in this phase. Real actions will require Owner Key approval in later phases.</div>
    </div>
  );
}

function HubTab({ ctx }: { ctx: OwnerZoneShellContext }) {
  return (
    <div className="space-y-5">
      <HeaderNote />
      <SimpleList
        items={[
          { label: 'Founder status', value: ctx.status, tone: ctx.status === 'UNLOCKED' ? 'ok' : ctx.status === 'LOCKDOWN' ? 'danger' : 'warn' },
          { label: 'Website status', value: ctx.backendConnected ? 'Online check available' : 'Not connected yet', tone: ctx.backendConnected ? 'ok' : 'warn' },
          { label: 'Owner Key status', value: ctx.canUseDangerActions ? 'Ready' : 'Locked for dangerous actions', tone: ctx.canUseDangerActions ? 'ok' : 'neutral' },
          { label: 'Last snapshot', value: formatWhen(ctx.lastSnapshotAt), tone: ctx.lastSnapshotAt ? 'ok' : 'neutral' },
          { label: 'Last audit event', value: formatWhen(ctx.lastAuditAt), tone: ctx.lastAuditAt ? 'ok' : 'neutral' },
        ]}
      />

      <SectionCard title="Quick actions" helper="Visual placeholders only for Phase 1. No new backend action is connected here.">
        <div className="flex flex-wrap gap-3">
          <PlaceholderButton>Take Snapshot</PlaceholderButton>
          <PlaceholderButton>Rollback Dry-run</PlaceholderButton>
          <PlaceholderButton danger>Emergency Lockdown</PlaceholderButton>
        </div>
      </SectionCard>

      <SectionCard title="First-priority order" helper="These are the first areas to harden before later phases add real owner actions.">
        <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
          {PHASE_ONE_PRIORITY.map((item, index) => (
            <li key={item} className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-300">{index + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}

function SecurityTab() {
  return (
    <SectionCard title="Security" helper="A simple founder view of access and unlock safety. Live wiring can be added after Owner Key rules are finalized.">
      <SimpleList
        items={[
          { label: 'Login records summary', value: 'Placeholder' },
          { label: 'Owner key / passkey', value: 'Check needed' },
          { label: 'Active sessions', value: 'Placeholder' },
          { label: 'Failed login attempts', value: 'Placeholder' },
          { label: 'Rate limit status', value: 'Check needed' },
          { label: 'Founder unlock history', value: 'Placeholder' },
        ]}
      />
    </SectionCard>
  );
}

function EmergencyTab() {
  return (
    <div className="space-y-5">
      <HeaderNote />
      <SectionCard title="Emergency" helper="These demo controls do not affect publishing, Add News, Draft Desk, Manage News, or live articles in Phase 1.">
        <div className="space-y-3">
          <DemoSwitch label="Maintenance Mode ON/OFF" helper="UI-only switch for the Phase 1 founder layout." />
          <DemoSwitch label="Read-only Mode ON/OFF" helper="UI-only switch. No publishing behavior is changed." />
          <DemoSwitch label="Pause External Fetch ON/OFF" helper="UI-only switch. No fetch workers are changed." />
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
            <div className="font-semibold text-red-800 dark:text-red-100">Emergency Lockdown</div>
            <div className="mt-1 text-sm text-red-700 dark:text-red-200">Placeholder only. Owner Key confirmation will be required before any real lockdown action is enabled.</div>
            <div className="mt-3"><PlaceholderButton danger>Emergency Lockdown</PlaceholderButton></div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function AiSafetyTab({ ctx }: { ctx: OwnerZoneShellContext }) {
  const showTranslation = ctx.settings?.features?.translationUi !== false;
  return (
    <SectionCard title="AI Safety" helper="Status and logs only. AI model rollback and complex model controls are intentionally not part of Phase 1.">
      <SimpleList
        items={[
          { label: 'AI automation status', value: 'Check needed' },
          { label: 'Translation queue status', value: showTranslation ? 'Visible in admin' : 'Not enabled', tone: showTranslation ? 'ok' : 'neutral' },
          { label: 'Google Translate status', value: 'Check needed' },
          { label: 'AI / translation error logs', value: 'Placeholder' },
          { label: 'Guardrails status', value: 'Phase 1 review needed', tone: 'warn' },
        ]}
      />
    </SectionCard>
  );
}

function BackupTab({ ctx }: { ctx: OwnerZoneShellContext }) {
  return (
    <div className="space-y-5">
      <HeaderNote />
      <SectionCard title="Backup" helper="Vault, snapshot, and rollback ideas are grouped here. Phase 1 does not run destructive restore actions.">
        <SimpleList
          items={[
            { label: 'Create snapshot', value: 'Placeholder' },
            { label: 'Backup history', value: ctx.lastSnapshotAt ? `Latest: ${formatWhen(ctx.lastSnapshotAt)}` : 'Placeholder' },
            { label: 'Download backup', value: 'Placeholder' },
            { label: 'Rollback dry-run', value: 'Placeholder' },
            { label: 'Restore', value: 'Placeholder', tone: 'warn', helper: 'No restore action is connected in Phase 1.' },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <PlaceholderButton>Create snapshot</PlaceholderButton>
          <PlaceholderButton>Download backup</PlaceholderButton>
          <PlaceholderButton>Rollback dry-run</PlaceholderButton>
          <PlaceholderButton danger>Restore</PlaceholderButton>
        </div>
      </SectionCard>
    </div>
  );
}

function ComplianceTab() {
  return (
    <SectionCard title="Compliance" helper="A calm checklist for policy, legal, and safety readiness.">
      <SimpleList
        items={[
          { label: 'PTI compliance checker status', value: 'Check needed' },
          { label: 'Legal pages status', value: 'Check needed' },
          { label: 'Content safety rules', value: 'Placeholder' },
          { label: 'Correction policy status', value: 'Check needed' },
          { label: 'Grievance / legal page status', value: 'Check needed' },
          { label: 'Compliance logs', value: 'Placeholder' },
        ]}
      />
    </SectionCard>
  );
}

function SystemHealthTab({ ctx }: { ctx: OwnerZoneShellContext }) {
  const health = ctx.health;
  const apiOk = health?.success === true || health?.ok === true;
  return (
    <SectionCard title="System Health" helper="Uses existing safe health information when available. Missing checks show a clear placeholder state.">
      <SimpleList
        items={[
          { label: 'Backend API status', value: ctx.backendConnected ? (apiOk ? 'OK' : 'Check needed') : 'Not connected yet', tone: ctx.backendConnected && apiOk ? 'ok' : 'warn' },
          { label: 'MongoDB status', value: readHealthValue(health, ['backend.db.status', 'backend.mongo.status', 'db.status', 'mongo.status']) },
          { label: 'Redis / cache status', value: readHealthValue(health, ['backend.redis.status', 'backend.cache.status', 'redis.status', 'cache.status'], 'Not connected yet') },
          { label: 'Translation worker status', value: readHealthValue(health, ['backend.translation.status', 'translation.status', 'workers.translation.status']) },
          { label: 'SMTP / email status', value: readHealthValue(health, ['backend.smtp.status', 'backend.email.status', 'smtp.status', 'email.status']) },
          { label: 'Render / Vercel environment status', value: readHealthValue(health, ['backend.environment.status', 'environment.status', 'vercel.status', 'render.status']) },
        ]}
      />
    </SectionCard>
  );
}

function AuditLogsTab({ ctx }: { ctx: OwnerZoneShellContext }) {
  const rows = useMemo(() => (Array.isArray(ctx.audit) ? ctx.audit.slice(0, 12) : []), [ctx.audit]);
  return (
    <div className="space-y-5">
      <SectionCard title="Audit Logs" helper="Founder, admin, AI, emergency, setting, and security events belong here. Export is a Phase 1 placeholder.">
        <SimpleList
          items={[
            { label: 'Founder actions', value: 'Shown in timeline when available' },
            { label: 'Admin actions', value: 'Shown in timeline when available' },
            { label: 'AI actions', value: 'Shown in timeline when available' },
            { label: 'Emergency actions', value: 'Shown in timeline when available' },
            { label: 'Setting changes', value: 'Shown in timeline when available' },
            { label: 'Security events', value: 'Shown in timeline when available' },
          ]}
        />
        <div className="mt-4"><PlaceholderButton>Export CSV</PlaceholderButton></div>
      </SectionCard>

      <SectionCard title="Recent activity" helper={rows.length ? 'Latest available audit events.' : 'No audit events connected yet.'}>
        {rows.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {rows.map((row, index) => (
                <div key={`${row.ts || 'event'}-${index}`} className="grid gap-2 bg-white p-4 text-sm dark:bg-slate-900 md:grid-cols-[180px_1fr_160px]">
                  <div className="text-slate-500 dark:text-slate-300">{formatWhen(row.ts)}</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{row.type || 'Audit event'}</div>
                  <div className="text-slate-600 dark:text-slate-300">{auditKind(row.type)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">Audit timeline placeholder</div>
        )}
      </SectionCard>
    </div>
  );
}

export function resolvePhaseOneTab(slug: string | undefined | null): SafeOwnerZonePhaseOneTab {
  const raw = String(slug || '').trim();
  const aliases: Record<string, SafeOwnerZonePhaseOneTab> = {
    '': 'hub',
    hub: 'hub',
    founder: 'emergency',
    security: 'security',
    'security-lockdown': 'security',
    emergency: 'emergency',
    'ai-safety': 'ai-safety',
    'ai-control': 'ai-safety',
    backup: 'backup',
    vaults: 'backup',
    compliance: 'compliance',
    'system-health': 'system-health',
    operations: 'system-health',
    ops: 'system-health',
    'audit-logs': 'audit-logs',
    'admin-oversight': 'audit-logs',
    oversight: 'audit-logs',
    revenue: 'hub',
  };
  return aliases[raw] || 'hub';
}

export default function SafeOwnerZonePhaseOne({ tab }: { tab: SafeOwnerZonePhaseOneTab }) {
  const ctx = useOutletContext<OwnerZoneShellContext>();

  if (tab === 'security') return <SecurityTab />;
  if (tab === 'emergency') return <EmergencyTab />;
  if (tab === 'ai-safety') return <AiSafetyTab ctx={ctx} />;
  if (tab === 'backup') return <BackupTab ctx={ctx} />;
  if (tab === 'compliance') return <ComplianceTab />;
  if (tab === 'system-health') return <SystemHealthTab ctx={ctx} />;
  if (tab === 'audit-logs') return <AuditLogsTab ctx={ctx} />;
  return <HubTab ctx={ctx} />;
}