import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRecentAudit } from '@/api/ownerZone';

export type SafeOwnerZonePhaseOneTab =
  | 'hub'
  | 'security'
  | 'emergency'
  | 'ai-safety'
  | 'backup'
  | 'compliance'
  | 'system-health'
  | 'audit-logs';

export function resolvePhaseOneTab(_slug?: string | null): SafeOwnerZonePhaseOneTab {
  return 'hub';
}

type EmergencyAuditEvent = {
  id: string;
  action: string;
  createdAt?: string;
  actor?: string;
  reason?: string;
};

const FUTURE_EMERGENCY_CONTROLS = [
  'Emergency Staff Lockdown',
  'Publishing Freeze',
  'Force Logout All Staff',
  'Emergency AI Disable',
  'Restore Normal Operations',
];

function auditItemsFromResponse(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.audit)) return response.audit;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.logs)) return response.logs;
  if (Array.isArray(response?.events)) return response.events;
  return [];
}

function isEmergencyAuditEvent(item: any) {
  const text = [item?.action, item?.event, item?.type, item?.message, item?.reason].filter(Boolean).join(' ').toLowerCase();
  return /emergency|lockdown|publishing freeze|force logout|ai disable|restore normal operations|recovery|backup/.test(text);
}

function normalizeEmergencyAuditEvent(item: any, index: number): EmergencyAuditEvent {
  return {
    id: String(item?.id || item?._id || item?.auditId || index),
    action: String(item?.action || item?.event || item?.type || 'Emergency action'),
    createdAt: item?.createdAt || item?.timestamp || item?.time || item?.happenedAt,
    actor: item?.actor || item?.adminEmail || item?.userEmail || item?.createdBy,
    reason: item?.reason || item?.message || item?.details?.reason,
  };
}

export default function SafeOwnerZonePhaseOne(_props: { tab?: SafeOwnerZonePhaseOneTab }) {
  const [auditEvents, setAuditEvents] = useState<EmergencyAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getRecentAudit(50)
      .then((response) => {
        if (!mounted) return;
        setAuditEvents(auditItemsFromResponse(response).filter(isEmergencyAuditEvent).map(normalizeEmergencyAuditEvent));
      })
      .catch(() => {
        if (mounted) setAuditEvents([]);
      })
      .finally(() => {
        if (mounted) setAuditLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const formattedAuditEvents = useMemo(() => auditEvents.map((event) => ({
    ...event,
    label: event.createdAt ? `${event.action} - ${new Date(event.createdAt).toLocaleString()}` : event.action,
  })), [auditEvents]);

  return (
    <div className="space-y-5">
      <SafeZoneCard title="System Protection Status">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          <span className="font-semibold">Current status:</span> Normal Operations
        </div>
      </SafeZoneCard>

      <SafeZoneCard title="Emergency Controls">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Emergency controls are not configured yet.</p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Future controls may include</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
            {FUTURE_EMERGENCY_CONTROLS.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </SafeZoneCard>

      <SafeZoneCard title="Backup & Recovery">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Backup and recovery status is not connected yet.</p>
      </SafeZoneCard>

      <SafeZoneCard title="Emergency Audit">
        {auditLoading ? (
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Loading emergency audit events...</p>
        ) : formattedAuditEvents.length ? (
          <div className="space-y-3">
            {formattedAuditEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <div className="font-semibold text-slate-950 dark:text-white">{event.label}</div>
                {event.actor ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Actor: {event.actor}</div> : null}
                {event.reason ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reason: {event.reason}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">No emergency actions recorded.</p>
        )}
      </SafeZoneCard>

      <SafeZoneCard title="Founder Access Control">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Normal Admin Panel module availability, staff locks and Founder-only module policy are managed separately under Founder Access Control.
          </p>
          <Link
            to="/admin/settings/admin-panel/founder-access-control"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Open Founder Access Control
          </Link>
        </div>
      </SafeZoneCard>
    </div>
  );
}

function SafeZoneCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
        {children}
      </div>
    </section>
  );
}
