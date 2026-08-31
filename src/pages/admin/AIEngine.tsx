import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminApiError, adminJson } from '@/lib/http/adminFetch';

const HEALTH_ENDPOINT = '/news-pulse-engine/health';
const MONITORING_STATUS_ENDPOINT = '/news-pulse-engine/monitoring/status';
const INCIDENTS_ENDPOINT = '/news-pulse-engine/incidents';
const ALERTS_ENDPOINT = '/news-pulse-engine/alerts';

type HealthStatus = 'healthy' | 'attention' | 'critical' | 'unknown';
type IncidentState = 'open' | 'resolved' | 'unknown';
type AlertType = 'critical' | 'recovery' | 'unknown';
type AlertDeliveryStatus = 'sent' | 'recorded' | 'failed' | 'unknown';

type HealthSummary = {
  healthy: number;
  attention: number;
  critical: number;
};

type HealthCheck = {
  id: string;
  area: string;
  status: HealthStatus | string;
  message: string;
  technicalDetail?: string | null;
  recommendation?: string | null;
  checkedAt?: string | null;
  latencyMs?: number | null;
};

type HealthSnapshot = {
  ok: boolean;
  checkedAt?: string | null;
  overallStatus: HealthStatus | string;
  summary?: Partial<HealthSummary> | null;
  checks?: HealthCheck[] | null;
};

type MonitoringStatus = {
  ok?: boolean;
  enabled?: boolean | null;
  intervalMs?: number | null;
  checkIntervalMs?: number | null;
  intervalMinutes?: number | null;
  checkIntervalMinutes?: number | null;
  lastAutomaticCheckAt?: string | null;
  lastCheckedAt?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  status?: string | null;
};

type IncidentRecord = {
  id?: string | null;
  area?: string | null;
  status?: HealthStatus | string | null;
  state?: IncidentState | string | null;
  message?: string | null;
  startedAt?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  resolvedAt?: string | null;
  durationMs?: number | null;
  recommendation?: string | null;
};

type FounderAlert = {
  id?: string | null;
  incidentId?: string | null;
  type?: AlertType | string | null;
  area?: string | null;
  message?: string | null;
  createdAt?: string | null;
  deliveryStatus?: AlertDeliveryStatus | string | null;
  deliveryErrorCode?: string | null;
};

type StatusMeta = {
  label: string;
  cardClass: string;
  badgeClass: string;
};

const STATUS_META: Record<HealthStatus, StatusMeta> = {
  healthy: {
    label: 'Healthy',
    cardClass: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100',
    badgeClass: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100',
  },
  attention: {
    label: 'Needs Attention',
    cardClass: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
    badgeClass: 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100',
  },
  critical: {
    label: 'Critical',
    cardClass: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100',
    badgeClass: 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-100',
  },
  unknown: {
    label: 'Not Configured / Unknown',
    cardClass: 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
};

const SUMMARY_CARDS: Array<{ key: keyof HealthSummary; label: string; tone: HealthStatus }> = [
  { key: 'healthy', label: 'Healthy', tone: 'healthy' },
  { key: 'attention', label: 'Needs Attention', tone: 'attention' },
  { key: 'critical', label: 'Critical', tone: 'critical' },
];

const INCIDENT_STATE_META: Record<IncidentState, { label: string; badgeClass: string }> = {
  open: {
    label: 'Open',
    badgeClass: 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100',
  },
  resolved: {
    label: 'Resolved',
    badgeClass: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100',
  },
  unknown: {
    label: 'Unknown',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
};

const ALERT_TYPE_META: Record<AlertType, { label: string; badgeClass: string }> = {
  critical: {
    label: 'Critical Alert',
    badgeClass: STATUS_META.critical.badgeClass,
  },
  recovery: {
    label: 'Recovered',
    badgeClass: STATUS_META.healthy.badgeClass,
  },
  unknown: {
    label: 'Founder Alert',
    badgeClass: STATUS_META.unknown.badgeClass,
  },
};

const DELIVERY_STATUS_META: Record<AlertDeliveryStatus, { label: string; badgeClass: string; detail?: string }> = {
  sent: {
    label: 'Email Sent',
    badgeClass: STATUS_META.healthy.badgeClass,
  },
  recorded: {
    label: 'Stored Internally',
    badgeClass: STATUS_META.unknown.badgeClass,
    detail: 'External email delivery was not configured.',
  },
  failed: {
    label: 'Delivery Failed',
    badgeClass: STATUS_META.critical.badgeClass,
  },
  unknown: {
    label: 'Status Unknown',
    badgeClass: STATUS_META.unknown.badgeClass,
  },
};

function normalizeStatus(value: unknown): HealthStatus {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'healthy' || status === 'attention' || status === 'critical') return status;
  return 'unknown';
}

function normalizeAlertType(value: unknown): AlertType {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'critical' || type === 'recovery') return type;
  return 'unknown';
}

function normalizeDeliveryStatus(value: unknown): AlertDeliveryStatus {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'sent' || status === 'recorded' || status === 'failed') return status;
  return 'unknown';
}

function normalizeIncidentState(value: unknown, resolvedAt?: string | null): IncidentState {
  const state = String(value || '').trim().toLowerCase();
  if (state === 'open' || state === 'active') return 'open';
  if (state === 'resolved' || state === 'recovered' || state === 'closed') return 'resolved';
  return resolvedAt ? 'resolved' : 'open';
}

function overallMessage(status: HealthStatus): string {
  if (status === 'healthy') return 'News Pulse is operating normally.';
  if (status === 'attention') return 'Some areas need attention.';
  if (status === 'critical') return 'A core News Pulse service needs immediate attention.';
  return 'Current system status is not configured yet.';
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
}

function formatAlertTime(value?: string | null): string {
  const formatted = formatDateTime(value);
  return formatted === 'Not available' ? 'Time unavailable' : formatted;
}

function formatLatency(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${Math.max(0, Math.round(value))}ms`;
}

function formatDuration(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  if (totalSeconds < 60) return `${totalSeconds} ${totalSeconds === 1 ? 'second' : 'seconds'}`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

function formatInterval(status: MonitoringStatus | null): string | null {
  if (!status) return null;
  const intervalMs = typeof status.checkIntervalMs === 'number'
    ? status.checkIntervalMs
    : typeof status.intervalMs === 'number'
      ? status.intervalMs
      : null;
  if (intervalMs !== null) {
    const formatted = formatDuration(intervalMs);
    return formatted ? `Every ${formatted}` : null;
  }
  const intervalMinutes = typeof status.checkIntervalMinutes === 'number'
    ? status.checkIntervalMinutes
    : typeof status.intervalMinutes === 'number'
      ? status.intervalMinutes
      : null;
  if (typeof intervalMinutes === 'number' && Number.isFinite(intervalMinutes) && intervalMinutes > 0) {
    return `Every ${intervalMinutes} ${intervalMinutes === 1 ? 'minute' : 'minutes'}`;
  }
  return null;
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function monitoringStatusErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.status === 401) return 'Session expired. Please sign in again.';
    if (error.status === 403) return 'Founder access is required to view automatic monitoring.';
  }
  return 'Monitoring status could not be loaded.';
}

function incidentHistoryErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.status === 401) return 'Session expired. Please sign in again.';
    if (error.status === 403) return 'Founder access is required to view issue history.';
  }
  return 'Issue history could not be loaded.';
}

function founderAlertsErrorMessage(_error: unknown): string {
  return 'Founder alerts could not be loaded.';
}

function errorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.status === 401) return 'Session expired. Please sign in again.';
    if (error.status === 403) return 'Founder access is required to view News Pulse Engine health.';
  }
  return 'News Pulse Engine could not load the current system status.';
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

function IncidentStateBadge({ state }: { state: IncidentState }) {
  const meta = INCIDENT_STATE_META[state];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

function AlertTypeBadge({ type }: { type: AlertType }) {
  const meta = ALERT_TYPE_META[type];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

function DeliveryStatusBadge({ status }: { status: AlertDeliveryStatus }) {
  const meta = DELIVERY_STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

function SummaryCard({ label, value, status, loading }: { label: string; value: number; status: HealthStatus; loading: boolean }) {
  const meta = STATUS_META[status];
  return (
    <div className={`rounded-xl border p-4 ${meta.cardClass}`} aria-label={`${label}: ${value}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</div>
      {loading ? <div className="mt-3 h-8 w-16 animate-pulse rounded bg-current/10" /> : <div className="mt-2 text-3xl font-bold">{value}</div>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" role="status" aria-live="polite">
      <div className="h-5 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      <p className="sr-only">Loading current system status...</p>
    </div>
  );
}

function CheckCard({ check }: { check: HealthCheck }) {
  const status = normalizeStatus(check.status);
  const latency = formatLatency(check.latencyMs);
  const technicalDetail = safeText(check.technicalDetail);
  const recommendation = safeText(check.recommendation);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">{check.area || 'System Check'}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{check.message || 'No message provided.'}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {latency || recommendation || technicalDetail ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {latency ? <div>Latency: {latency}</div> : null}
          {recommendation ? <div><span className="font-semibold text-slate-800 dark:text-slate-100">Recommended:</span> {recommendation}</div> : null}
          {technicalDetail ? (
            <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/40">
              <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">Technical detail</summary>
              <div className="mt-2 break-words text-slate-600 dark:text-slate-300">{technicalDetail}</div>
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MonitoringStatusCard({ status, loading, error }: { status: MonitoringStatus | null; loading: boolean; error: string | null }) {
  const enabled = typeof status?.enabled === 'boolean' ? status.enabled : null;
  const statusLabel = enabled === true ? 'Active' : enabled === false ? 'Disabled' : 'Status unavailable';
  const interval = formatInterval(status);
  const lastAutomaticCheck = status?.lastAutomaticCheckAt || status?.lastCheckedAt || status?.lastRunAt || null;
  const lastRunStatusRaw = safeText(status?.lastRunStatus || status?.status);
  const lastRunStatus = lastRunStatusRaw ? STATUS_META[normalizeStatus(lastRunStatusRaw)].label : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Automatic Monitoring">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Automatic Monitoring</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {enabled === false ? 'Automatic monitoring is currently disabled.' : interval ? `News Pulse automatically checks system health ${interval.toLowerCase()}.` : 'Backend monitoring status is shown below.'}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${enabled === true ? STATUS_META.healthy.badgeClass : enabled === false ? STATUS_META.unknown.badgeClass : STATUS_META.attention.badgeClass}`}>
          {statusLabel}
        </span>
      </div>

      {loading ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" role="status" aria-label="Loading monitoring status" /> : null}
      {!loading && error ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{error}</div> : null}
      {!loading && !error ? (
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Status</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">{statusLabel}</dd>
          </div>
          {interval ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Check interval</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">{interval}</dd>
            </div>
          ) : null}
          {lastAutomaticCheck ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Last automatic check</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">{formatDateTime(lastAutomaticCheck)}</dd>
            </div>
          ) : null}
          {lastRunStatus ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <dt className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Last run status</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">{lastRunStatus}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

function IncidentCard({ incident }: { incident: IncidentRecord }) {
  const status = normalizeStatus(incident.status);
  const state = normalizeIncidentState(incident.state, incident.resolvedAt);
  const startedAt = incident.startedAt || incident.firstSeenAt || null;
  const recommendation = safeText(incident.recommendation);
  const duration = formatDuration(incident.durationMs);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">{safeText(incident.area) || 'System Check'}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{safeText(incident.message) || 'No message provided.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={status} />
          <IncidentStateBadge state={state} />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {startedAt ? <div><dt className="font-semibold text-slate-800 dark:text-slate-100">Started</dt><dd className="mt-1 text-slate-600 dark:text-slate-300">{formatDateTime(startedAt)}</dd></div> : null}
        {incident.lastSeenAt ? <div><dt className="font-semibold text-slate-800 dark:text-slate-100">Last Seen</dt><dd className="mt-1 text-slate-600 dark:text-slate-300">{formatDateTime(incident.lastSeenAt)}</dd></div> : null}
        <div><dt className="font-semibold text-slate-800 dark:text-slate-100">Resolved</dt><dd className="mt-1 text-slate-600 dark:text-slate-300">{incident.resolvedAt ? formatDateTime(incident.resolvedAt) : 'Still open'}</dd></div>
        {duration ? <div><dt className="font-semibold text-slate-800 dark:text-slate-100">Duration</dt><dd className="mt-1 text-slate-600 dark:text-slate-300">{duration}</dd></div> : null}
      </dl>
      {recommendation ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Recommendation:</span> {recommendation}</p> : null}
    </article>
  );
}

function safeDeliveryErrorCode(value: unknown): string {
  const code = safeText(value);
  if (!code || code.length > 80) return '';
  return /^[A-Za-z0-9_-]+$/.test(code) ? code : '';
}

function AlertCard({ alert }: { alert: FounderAlert }) {
  const type = normalizeAlertType(alert.type);
  const deliveryStatus = normalizeDeliveryStatus(alert.deliveryStatus);
  const typeMeta = ALERT_TYPE_META[type];
  const deliveryMeta = DELIVERY_STATUS_META[deliveryStatus];
  const deliveryErrorCode = deliveryStatus === 'failed' ? safeDeliveryErrorCode(alert.deliveryErrorCode) : '';

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <AlertTypeBadge type={type} />
            <DeliveryStatusBadge status={deliveryStatus} />
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-950 dark:text-slate-100">{safeText(alert.area) || 'News Pulse Engine'}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{safeText(alert.message) || `${typeMeta.label} recorded.`}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-800 dark:text-slate-100">Delivery</dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-300">{deliveryMeta.label}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800 dark:text-slate-100">Time</dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-300">{formatAlertTime(alert.createdAt)}</dd>
        </div>
      </dl>

      {deliveryMeta.detail ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{deliveryMeta.detail}</p> : null}
      {deliveryErrorCode ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
          Code: {deliveryErrorCode}
        </div>
      ) : null}
    </article>
  );
}

function extractIncidentList(payload: unknown): IncidentRecord[] {
  if (Array.isArray(payload)) return payload as IncidentRecord[];
  if (payload && typeof payload === 'object') {
    const body = payload as any;
    if (Array.isArray(body.incidents)) return body.incidents as IncidentRecord[];
    if (Array.isArray(body.items)) return body.items as IncidentRecord[];
    if (Array.isArray(body.data)) return body.data as IncidentRecord[];
  }
  return [];
}

function extractAlertList(payload: unknown): FounderAlert[] {
  if (Array.isArray(payload)) return payload as FounderAlert[];
  if (payload && typeof payload === 'object') {
    const body = payload as any;
    if (Array.isArray(body.alerts)) return body.alerts as FounderAlert[];
    if (Array.isArray(body.items)) return body.items as FounderAlert[];
    if (Array.isArray(body.data)) return body.data as FounderAlert[];
  }
  return [];
}

export default function AIEngine(): JSX.Element {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(true);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<FounderAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const monitoringInFlightRef = useRef(false);
  const incidentsInFlightRef = useRef(false);
  const alertsInFlightRef = useRef(false);

  const loadMonitoringStatus = useCallback(async (showLoading = true) => {
    if (monitoringInFlightRef.current) return false;
    monitoringInFlightRef.current = true;
    setMonitoringError(null);
    if (showLoading) setMonitoringLoading(true);

    try {
      const data = await adminJson<MonitoringStatus>(MONITORING_STATUS_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
      });
      setMonitoringStatus(data);
      return true;
    } catch (statusError) {
      setMonitoringStatus(null);
      setMonitoringError(monitoringStatusErrorMessage(statusError));
      return false;
    } finally {
      setMonitoringLoading(false);
      monitoringInFlightRef.current = false;
    }
  }, []);

  const loadIncidentHistory = useCallback(async (showLoading = true) => {
    if (incidentsInFlightRef.current) return false;
    incidentsInFlightRef.current = true;
    setIncidentsError(null);
    if (showLoading) setIncidentsLoading(true);

    try {
      const data = await adminJson<unknown>(INCIDENTS_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
      });
      setIncidents(extractIncidentList(data));
      return true;
    } catch (incidentError) {
      setIncidents([]);
      setIncidentsError(incidentHistoryErrorMessage(incidentError));
      return false;
    } finally {
      setIncidentsLoading(false);
      incidentsInFlightRef.current = false;
    }
  }, []);

  const loadFounderAlerts = useCallback(async (showLoading = true) => {
    if (alertsInFlightRef.current) return false;
    alertsInFlightRef.current = true;
    setAlertsError(null);
    if (showLoading) setAlertsLoading(true);

    try {
      const data = await adminJson<unknown>(ALERTS_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
      });
      setAlerts(extractAlertList(data));
      return true;
    } catch (alertsLoadError) {
      setAlerts([]);
      setAlertsError(founderAlertsErrorMessage(alertsLoadError));
      return false;
    } finally {
      setAlertsLoading(false);
      alertsInFlightRef.current = false;
    }
  }, []);

  const loadHealth = useCallback(async (refresh = false) => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    setError(null);
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await adminJson<HealthSnapshot>(HEALTH_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
      });
      setSnapshot(data);
      return true;
    } catch (healthError) {
      setSnapshot(null);
      setError(errorMessage(healthError));
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadHealth(false);
    void loadMonitoringStatus(true);
    void loadIncidentHistory(true);
    void loadFounderAlerts(true);
  }, [loadFounderAlerts, loadHealth, loadIncidentHistory, loadMonitoringStatus]);

  const runManualRefresh = useCallback(async () => {
    const ok = await loadHealth(true);
    if (ok) {
      void loadMonitoringStatus(false);
      void loadIncidentHistory(false);
      void loadFounderAlerts(false);
    }
  }, [loadFounderAlerts, loadHealth, loadIncidentHistory, loadMonitoringStatus]);

  const overallStatus = normalizeStatus(snapshot?.overallStatus);
  const summary = snapshot?.summary || {};
  const checks = Array.isArray(snapshot?.checks) ? snapshot.checks : [];
  const attentionItems = useMemo(() => {
    const priority: Record<HealthStatus, number> = { critical: 0, attention: 1, healthy: 2, unknown: 3 };
    return checks
      .filter((check) => {
        const status = normalizeStatus(check.status);
        return status === 'critical' || status === 'attention';
      })
      .slice()
      .sort((a, b) => priority[normalizeStatus(a.status)] - priority[normalizeStatus(b.status)]);
  }, [checks]);
  const sortedIncidents = useMemo(() => {
    const severityPriority: Record<HealthStatus, number> = { critical: 0, attention: 1, healthy: 2, unknown: 3 };
    return incidents.slice().sort((a, b) => {
      const severityDiff = severityPriority[normalizeStatus(a.status)] - severityPriority[normalizeStatus(b.status)];
      if (severityDiff !== 0) return severityDiff;
      const aTime = Date.parse(a.startedAt || a.firstSeenAt || a.lastSeenAt || '') || 0;
      const bTime = Date.parse(b.startedAt || b.firstSeenAt || b.lastSeenAt || '') || 0;
      return bTime - aTime;
    });
  }, [incidents]);
  const openIncidents = useMemo(() => sortedIncidents.filter((incident) => normalizeIncidentState(incident.state, incident.resolvedAt) === 'open'), [sortedIncidents]);
  const resolvedIncidents = useMemo(() => sortedIncidents.filter((incident) => normalizeIncidentState(incident.state, incident.resolvedAt) === 'resolved'), [sortedIncidents]);
  const sortedAlerts = useMemo(() => alerts.slice().sort((a, b) => {
    const aTime = Date.parse(a.createdAt || '') || 0;
    const bTime = Date.parse(b.createdAt || '') || 0;
    return bTime - aTime;
  }), [alerts]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-slate-100">News Pulse Engine</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Monitor the health of News Pulse, identify problems affecting the live website and newsroom systems, and see what needs attention.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runManualRefresh()}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {refreshing ? 'Refreshing...' : 'Run Check Again'}
        </button>
      </header>

      {loading ? <LoadingState /> : null}

      {!loading && error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-950 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100" aria-live="polite">
          <h2 className="text-lg font-semibold">News Pulse Engine could not load the current system status.</h2>
          <p className="mt-2 text-sm leading-6">{error}</p>
          <button
            type="button"
            onClick={() => void loadHealth(true)}
            disabled={refreshing}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Try again
          </button>
        </section>
      ) : null}

      {!loading && !error && snapshot ? (
        <>
          <section className={`rounded-2xl border p-5 shadow-sm ${STATUS_META[overallStatus].cardClass}`} aria-label="Overall System Status">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-75">Overall System Status</div>
                <h2 className="mt-2 text-2xl font-bold">{overallMessage(overallStatus)}</h2>
                <p className="mt-2 text-sm opacity-80">Last checked: {formatDateTime(snapshot.checkedAt)}</p>
              </div>
              <StatusBadge status={overallStatus} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Health Summary">
            {SUMMARY_CARDS.map((item) => (
              <SummaryCard
                key={item.key}
                label={item.label}
                value={typeof summary[item.key] === 'number' ? summary[item.key]! : 0}
                status={item.tone}
                loading={false}
              />
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Founder Attention</h2>
            <div className="mt-4 space-y-3">
              {attentionItems.length ? attentionItems.map((item) => {
                const status = normalizeStatus(item.status);
                const recommendation = safeText(item.recommendation);
                return (
                  <div key={item.id || item.area} className={`rounded-xl border p-4 ${STATUS_META[status].cardClass}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <StatusBadge status={status} />
                        <h3 className="mt-3 text-base font-semibold">{item.area || 'System Check'}</h3>
                        <p className="mt-1 text-sm leading-6">{item.message || 'No message provided.'}</p>
                        {recommendation ? <p className="mt-2 text-sm"><span className="font-semibold">Recommended:</span> {recommendation}</p> : null}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  No current issues require Founder attention.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">System Health</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Last checked: {formatDateTime(snapshot.checkedAt)}</p>
            </div>
            {checks.length ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {checks.map((check) => <CheckCard key={check.id || check.area} check={check} />)}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                No system checks were returned by the backend.
              </div>
            )}
          </section>

          <MonitoringStatusCard status={monitoringStatus} loading={monitoringLoading} error={monitoringError} />

          <section className="space-y-4" aria-label="Issue History">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Issue History</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Resolved monitoring issues are retained temporarily for recent history.</p>
            </div>
            {incidentsLoading ? <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" role="status" aria-label="Loading issue history" /> : null}
            {!incidentsLoading && incidentsError ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{incidentsError}</div> : null}
            {!incidentsLoading && !incidentsError ? (
              <>
                <section className="space-y-3" aria-label="Open Issues">
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Open Issues</h3>
                  {openIncidents.length ? openIncidents.map((incident, index) => <IncidentCard key={incident.id || `${incident.area || 'incident'}-${index}`} incident={incident} />) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">No open monitoring issues.</div>
                  )}
                </section>

                <section className="space-y-3" aria-label="Recently Resolved">
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Recently Resolved</h3>
                  {resolvedIncidents.length ? resolvedIncidents.map((incident, index) => <IncidentCard key={incident.id || `${incident.area || 'incident'}-resolved-${index}`} incident={incident} />) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">No recently resolved issues.</div>
                  )}
                </section>
              </>
            ) : null}
          </section>

          <section className="space-y-4" aria-label="Founder Alerts">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Founder Alerts</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Recorded critical and recovery alerts from backend monitoring.</p>
            </div>
            {alertsLoading ? <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" role="status" aria-label="Loading Founder alerts" /> : null}
            {!alertsLoading && alertsError ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{alertsError}</div> : null}
            {!alertsLoading && !alertsError ? (
              sortedAlerts.length ? (
                <div className="space-y-3">
                  {sortedAlerts.map((alert, index) => <AlertCard key={alert.id || alert.incidentId || `${alert.area || 'alert'}-${index}`} alert={alert} />)}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">No Founder alerts recorded yet.</div>
              )
            ) : null}
          </section>
        </>
      ) : null}

    </div>
  );
}
