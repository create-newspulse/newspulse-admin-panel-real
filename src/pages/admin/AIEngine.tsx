import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminApiError, adminJson } from '@/lib/http/adminFetch';

const HEALTH_ENDPOINT = '/news-pulse-engine/health';
const CONTENT_CHECK_ENDPOINT = '/news-pulse-engine/content-check';
const MAX_CONTENT_CHECK_SOURCES = 10;

type HealthStatus = 'healthy' | 'attention' | 'critical' | 'unknown';
type EngineView = 'health' | 'checker';
type ContentCheckLanguage = 'en' | 'hi' | 'gu';
type ContentCheckOverallStatus = 'clear' | 'review' | 'high-risk' | 'unknown';
type ContentCheckStatus = 'pass' | 'review' | 'high-risk' | 'unknown';

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

type ContentCheckEvidence = {
  excerpt?: string | null;
};

type ContentCheckItem = {
  id: string;
  label: string;
  status: ContentCheckStatus | string;
  message: string;
  recommendation?: string | null;
  evidence?: ContentCheckEvidence[] | null;
};

type ContentCheckResult = {
  ok: boolean;
  checkedAt?: string | null;
  overallStatus: ContentCheckOverallStatus | string;
  summary?: {
    passed?: number | null;
    review?: number | null;
    highRisk?: number | null;
  } | null;
  checks?: ContentCheckItem[] | null;
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

const CHECKER_SUMMARY_CARDS: Array<{ key: 'passed' | 'review' | 'highRisk'; label: string; status: ContentCheckStatus }> = [
  { key: 'passed', label: 'Passed', status: 'pass' },
  { key: 'review', label: 'Needs Review', status: 'review' },
  { key: 'highRisk', label: 'High Priority', status: 'high-risk' },
];

const CONTENT_CHECK_LANGUAGES: Array<{ value: ContentCheckLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
];

const CONTENT_STATUS_META: Record<ContentCheckStatus, StatusMeta & { description: string }> = {
  pass: {
    label: 'Passed',
    description: 'No major editorial indicators were found by the current checks.',
    cardClass: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100',
    badgeClass: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100',
  },
  review: {
    label: 'Needs Review',
    description: 'Some items should be reviewed before publication.',
    cardClass: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
    badgeClass: 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100',
  },
  'high-risk': {
    label: 'High Priority Review',
    description: 'One or more issues should be resolved or verified before publication.',
    cardClass: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100',
    badgeClass: 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-100',
  },
  unknown: {
    label: 'Needs Review',
    description: 'Some items should be reviewed before publication.',
    cardClass: 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
};

const CONTENT_OVERALL_STATUS_META: Record<ContentCheckOverallStatus, StatusMeta & { description: string }> = {
  clear: {
    ...CONTENT_STATUS_META.pass,
    label: 'Clear',
  },
  review: CONTENT_STATUS_META.review,
  'high-risk': CONTENT_STATUS_META['high-risk'],
  unknown: CONTENT_STATUS_META.unknown,
};

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-800';
const labelClass = 'text-sm font-semibold text-slate-800 dark:text-slate-100';

function normalizeStatus(value: unknown): HealthStatus {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'healthy' || status === 'attention' || status === 'critical') return status;
  return 'unknown';
}

function normalizeContentStatus(value: unknown): ContentCheckStatus {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'pass' || status === 'review' || status === 'high-risk') return status;
  return 'unknown';
}

function normalizeOverallContentStatus(value: unknown): ContentCheckOverallStatus {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'clear' || status === 'review' || status === 'high-risk') return status;
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

function hasMeaningfulContent(value: string): boolean {
  return value.replace(/\s+/g, ' ').trim().length > 0;
}

function readSafeApiMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.status === 401) return 'Session expired. Please sign in again.';
    if (error.status === 403) return 'Founder access is required to use the content checker.';
    if (error.status === 400 || error.status === 422) {
      const message = safeText(error.message).replace(/(?:\r?\n|\r)[\s\S]*$/g, '').slice(0, 180);
      if (message && !/stack|trace|at\s+/i.test(message)) return message;
    }
  }
  return 'Content check could not be completed.';
}

function prepareSources(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((source) => source.trim())
    .filter(Boolean)
    .slice(0, MAX_CONTENT_CHECK_SOURCES);
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

function ContentStatusBadge({ status }: { status: ContentCheckStatus }) {
  const meta = CONTENT_STATUS_META[status];
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

function ContentCheckResultCard({ result }: { result: ContentCheckResult }) {
  const overallStatus = normalizeOverallContentStatus(result.overallStatus);
  const overallMeta = CONTENT_OVERALL_STATUS_META[overallStatus];
  const checks = Array.isArray(result.checks) ? result.checks : [];
  const summary = result.summary || {};

  return (
    <section className="space-y-4" aria-label="Content Check Result">
      <div className={`rounded-2xl border p-5 shadow-sm ${overallMeta.cardClass}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-75">Overall Result</div>
            <h2 className="mt-2 text-2xl font-bold">{overallMeta.label}</h2>
            <p className="mt-2 text-sm opacity-80">{overallMeta.description}</p>
            {result.checkedAt ? <p className="mt-2 text-sm opacity-80">Checked: {formatDateTime(result.checkedAt)}</p> : null}
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${overallMeta.badgeClass}`}>
            {overallMeta.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Content Check Summary">
        {CHECKER_SUMMARY_CARDS.map((item) => {
          const value = typeof summary[item.key] === 'number' ? summary[item.key] || 0 : 0;
          const meta = CONTENT_STATUS_META[item.status];
          return (
            <div key={item.key} className={`rounded-xl border p-4 ${meta.cardClass}`} aria-label={`${item.label}: ${value}`}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-75">{item.label}</div>
              <div className="mt-2 text-3xl font-bold">{value}</div>
            </div>
          );
        })}
      </div>

      <section className="space-y-3" aria-label="Content Check Details">
        <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-100">Check Results</h3>
        {checks.length ? checks.map((check) => {
          const status = normalizeContentStatus(check.status);
          const recommendation = safeText(check.recommendation);
          const excerpts = Array.isArray(check.evidence)
            ? check.evidence.map((item) => safeText(item?.excerpt)).filter(Boolean)
            : [];

          return (
            <article key={check.id || check.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-slate-950 dark:text-slate-100">{check.label || 'Editorial Check'}</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{check.message || 'No message provided.'}</p>
                </div>
                <ContentStatusBadge status={status} />
              </div>

              {recommendation || excerpts.length ? (
                <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  {recommendation ? <div><span className="font-semibold text-slate-800 dark:text-slate-100">Recommended review:</span> {recommendation}</div> : null}
                  {excerpts.length ? (
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">Review excerpt</div>
                      <div className="mt-2 space-y-2">
                        {excerpts.map((excerpt, index) => (
                          <blockquote key={`${check.id || check.label}-excerpt-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 dark:border-slate-800 dark:bg-slate-950/40">
                            {excerpt}
                          </blockquote>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        }) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            No check details were returned by the backend.
          </div>
        )}
      </section>
    </section>
  );
}

export default function AIEngine(): JSX.Element {
  const [activeView, setActiveView] = useState<EngineView>('health');
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkerTitle, setCheckerTitle] = useState('');
  const [checkerSummary, setCheckerSummary] = useState('');
  const [checkerContent, setCheckerContent] = useState('');
  const [checkerLanguage, setCheckerLanguage] = useState<ContentCheckLanguage>('en');
  const [checkerSources, setCheckerSources] = useState('');
  const [checkerResult, setCheckerResult] = useState<ContentCheckResult | null>(null);
  const [checkerError, setCheckerError] = useState<string | null>(null);
  const [checkingContent, setCheckingContent] = useState(false);
  const inFlightRef = useRef(false);
  const contentCheckInFlightRef = useRef(false);

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

  const submitContentCheck = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (contentCheckInFlightRef.current) return;

    if (!hasMeaningfulContent(checkerContent)) {
      setCheckerError('Enter article content before running the check.');
      return;
    }

    contentCheckInFlightRef.current = true;
    setCheckingContent(true);
    setCheckerError(null);

    try {
      const result = await adminJson<ContentCheckResult>(CONTENT_CHECK_ENDPOINT, {
        method: 'POST',
        json: {
          title: checkerTitle.trim(),
          summary: checkerSummary.trim(),
          content: checkerContent.trim(),
          language: checkerLanguage,
          sources: prepareSources(checkerSources),
        },
      });
      setCheckerResult(result);
    } catch (contentCheckError) {
      setCheckerError(readSafeApiMessage(contentCheckError));
    } finally {
      setCheckingContent(false);
      contentCheckInFlightRef.current = false;
    }
  }, [checkerContent, checkerLanguage, checkerSources, checkerSummary, checkerTitle]);

  const clearContentCheck = useCallback(() => {
    if (contentCheckInFlightRef.current) return;
    setCheckerTitle('');
    setCheckerSummary('');
    setCheckerContent('');
    setCheckerLanguage('en');
    setCheckerSources('');
    setCheckerResult(null);
    setCheckerError(null);
  }, []);

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
        {activeView === 'health' ? (
          <button
            type="button"
            onClick={() => void loadHealth(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {refreshing ? 'Refreshing...' : 'Run Check Again'}
          </button>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="News Pulse Engine sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'health'}
          onClick={() => setActiveView('health')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${activeView === 'health' ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}
        >
          System Health
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'checker'}
          onClick={() => setActiveView('checker')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${activeView === 'checker' ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}
        >
          Content Checker
        </button>
      </div>

      {activeView === 'health' && loading ? <LoadingState /> : null}

      {activeView === 'health' && !loading && error ? (
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

      {activeView === 'health' && !loading && !error && snapshot ? (
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

      {activeView === 'checker' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="News Pulse Content Checker">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-slate-100">News Pulse Content Checker</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Review a news draft for editorial issues that may require verification before publication.
            </p>
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
              This checker provides editorial indicators only. It does not determine whether a claim is true or false.
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={submitContentCheck} noValidate>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className={labelClass}>
                Title <span className="font-normal text-slate-500">(optional)</span>
                <input
                  type="text"
                  value={checkerTitle}
                  onChange={(event) => setCheckerTitle(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Language
                <select
                  value={checkerLanguage}
                  onChange={(event) => setCheckerLanguage(event.target.value as ContentCheckLanguage)}
                  className={inputClass}
                >
                  {CONTENT_CHECK_LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>{language.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className={labelClass}>
              Summary <span className="font-normal text-slate-500">(optional)</span>
              <textarea
                value={checkerSummary}
                onChange={(event) => setCheckerSummary(event.target.value)}
                className={`${inputClass} min-h-24 resize-y`}
              />
            </label>

            <label className={labelClass}>
              Article Content <span className="font-normal text-rose-600">(required)</span>
              <textarea
                value={checkerContent}
                onChange={(event) => setCheckerContent(event.target.value)}
                className={`${inputClass} min-h-56 resize-y`}
                aria-describedby="content-checker-error"
                required
              />
            </label>

            <label className={labelClass}>
              Sources / References <span className="font-normal text-slate-500">(optional)</span>
              <textarea
                value={checkerSources}
                onChange={(event) => setCheckerSources(event.target.value)}
                className={`${inputClass} min-h-28 resize-y`}
                placeholder="One source per line"
              />
            </label>

            {checkerError ? (
              <div id="content-checker-error" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
                {checkerError}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={checkingContent}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
              >
                {checkingContent ? 'Checking content...' : 'Check Content'}
              </button>
              <button
                type="button"
                onClick={clearContentCheck}
                disabled={checkingContent}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Clear
              </button>
            </div>
          </form>

          {checkingContent ? <div className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300" role="status">Checking content...</div> : null}
          {checkerResult ? <div className="mt-6"><ContentCheckResultCard result={checkerResult} /></div> : null}
        </section>
      ) : null}
    </div>
  );
}
