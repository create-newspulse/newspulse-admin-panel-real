import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminApiError, adminJson } from '@/lib/http/adminFetch';

const HEALTH_ENDPOINT = '/news-pulse-engine/health';

type HealthStatus = 'healthy' | 'attention' | 'critical' | 'unknown';

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

function normalizeStatus(value: unknown): HealthStatus {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'healthy' || status === 'attention' || status === 'critical') return status;
  return 'unknown';
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

function formatLatency(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${Math.max(0, Math.round(value))}ms`;
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

export default function AIEngine(): JSX.Element {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const loadHealth = useCallback(async (refresh = false) => {
    if (inFlightRef.current) return;
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
    } catch (healthError) {
      setSnapshot(null);
      setError(errorMessage(healthError));
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadHealth(false);
  }, [loadHealth]);

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
          onClick={() => void loadHealth(true)}
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
        </>
      ) : null}

    </div>
  );
}
