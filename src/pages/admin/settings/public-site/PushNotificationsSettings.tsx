import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import { AdminApiError, adminJson } from '@/lib/http/adminFetch';
import { formatPushAudience, formatPushDeliverySummary, formatPushIstTimestamp, formatPushStatusLabel, formatRecentPushStatus, loadPushHistory, type PushHistoryRecord } from '@/lib/pushHistory';

type FcmStatusLabel = 'Configured' | 'Not Configured' | 'Error';

type PushDiagnostics = {
  fcmStatus: FcmStatusLabel;
  messagingAvailable: boolean;
  backendReachable: boolean;
  totalRegistrations: number | null;
  deliverablePushDevices: number | null;
  fidOnlyNonDeliverableRecords: number | null;
  breakingNewsSubscribers: number | null;
  articleAlertSubscribers: number | null;
  disabledDevices: number | null;
  lastRegistration: string | null;
  lastSuccessfulSend: string | null;
  lastFailedAttempt: string | null;
  lastFailureCode: string | null;
};

type PushCleanupPreview = {
  eligibleCount: number;
  deletedCount: 0;
  retentionDays: number;
};

type PushCleanupCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'success'; result: PushCleanupPreview }
  | { status: 'error' };

const PUSH_CLEANUP_PREVIEW_PATH = '/admin/push/registrations/cleanup-preview';
const PUSH_CLEANUP_RETENTION_DAYS = 30;
const PUSH_CLEANUP_UNAVAILABLE_MESSAGE = 'Push cleanup check is temporarily unavailable. Please try again later.';

const EMPTY_DIAGNOSTICS: PushDiagnostics = {
  fcmStatus: 'Not Configured',
  messagingAvailable: false,
  backendReachable: false,
  totalRegistrations: null,
  deliverablePushDevices: null,
  fidOnlyNonDeliverableRecords: null,
  breakingNewsSubscribers: null,
  articleAlertSubscribers: null,
  disabledDevices: null,
  lastRegistration: null,
  lastSuccessfulSend: null,
  lastFailedAttempt: null,
  lastFailureCode: null,
};

const NOTIFICATION_TYPES = [
  { key: 'breakingNewsAlerts', label: 'Breaking News Alerts' },
  { key: 'topStories', label: 'Top Stories' },
  { key: 'newArticleAlerts', label: 'New Article Alerts' },
  { key: 'categoryAlerts', label: 'Category Alerts' },
  { key: 'allArticles', label: 'All Articles' },
] as const;

function readStatusText(input: any): string {
  return String(input?.status || input?.state || input?.firebaseStatus || input?.fcmStatus || '').trim().toLowerCase();
}

function readMessagingAvailable(input: any): boolean {
  const value = input?.messagingAvailable ?? input?.available ?? input?.fcmAvailable ?? input?.canSend ?? input?.messaging?.available;
  return typeof value === 'boolean' ? value : false;
}

function readConfigured(input: any): boolean | undefined {
  const value = input?.configured ?? input?.firebaseConfigured ?? input?.fcmConfigured;
  return typeof value === 'boolean' ? value : undefined;
}

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function readTimestamp(...values: unknown[]): string | null {
  for (const value of values) {
    const timestamp = formatPushIstTimestamp(value);
    if (timestamp !== 'None') return timestamp;
  }
  return null;
}

function sanitizeDiagnosticText(value: string): string | null {
  const text = value
    .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/gi, '[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\b(?:token|fid|registration[_ -]?id|private[_ -]?key|client[_ -]?email)\b\s*[:=]\s*["']?[^"',\s}]+/gi, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{64,}\b/g, '[redacted]')
    .trim();
  return text ? text.slice(0, 160) : null;
}

function readSafeFailureCode(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number') {
      const safe = sanitizeDiagnosticText(String(value));
      if (safe) return safe;
    }
    if (value && typeof value === 'object') {
      const raw = value as any;
      const safe = sanitizeDiagnosticText(String(raw.code || raw.errorCode || raw.firebaseCode || raw.fcmCode || raw.status || ''));
      if (safe) return safe;
    }
  }
  return null;
}

function normalizeFcmStatus(input: unknown): Pick<PushDiagnostics, 'fcmStatus' | 'messagingAvailable'> {
  const raw = input && typeof input === 'object' ? (input as any) : {};
  const source = raw.firebase || raw.fcm || (raw.status && typeof raw.status === 'object' ? raw.status : undefined) || raw.messaging || raw;
  const statusText = readStatusText(source) || readStatusText(raw);
  const configured = readConfigured(source) ?? readConfigured(raw);
  const messagingAvailable = readMessagingAvailable(source) || readMessagingAvailable(raw);

  if (statusText.includes('error') || source?.error === true || raw?.error === true) {
    return { fcmStatus: 'Error', messagingAvailable: false };
  }

  if (statusText.includes('not') || statusText.includes('missing') || configured === false || source?.initialized === false) {
    return { fcmStatus: 'Not Configured', messagingAvailable: false };
  }

  if (statusText.includes('configured') || statusText.includes('ready') || configured === true || source?.initialized === true) {
    return { fcmStatus: 'Configured', messagingAvailable };
  }

  return { fcmStatus: 'Not Configured', messagingAvailable };
}

function normalizePushDiagnostics(input: unknown, backendReachable: boolean): PushDiagnostics {
  const raw = input && typeof input === 'object' ? (input as any) : {};
  const registrationStats = raw.registrationStats || {};
  const registrations = raw.registrations || raw.devices || raw.subscriptions || raw.mongodb || raw.mongo || {};
  const sends = raw.sends || raw.send || raw.delivery || raw.notifications || {};
  const fcm = normalizeFcmStatus(raw);

  return {
    ...EMPTY_DIAGNOSTICS,
    ...fcm,
    backendReachable: typeof raw.backendReachable === 'boolean' ? raw.backendReachable : backendReachable,
    totalRegistrations: readNumber(raw.totalRegistrations, raw.mongoRegistrations, raw.mongodbRegistrations, raw.registrationCount, registrations.totalRegistrations, registrations.total, registrations.count),
    deliverablePushDevices: readNumber(raw.enabledFcmTokenRegistrations, raw.deliverablePushDevices, raw.enabledDevices, raw.enabledCount, registrations.enabledFcmTokenRegistrations, registrations.deliverablePushDevices, registrations.enabled, registrations.enabledCount),
    fidOnlyNonDeliverableRecords: readNumber(raw.enabledFidOnlyRegistrations, raw.fidOnlyRegistrations, raw.fidOnlyNonDeliverableRecords, registrations.enabledFidOnlyRegistrations, registrations.fidOnlyRegistrations, registrations.fidOnlyCount),
    breakingNewsSubscribers: readNumber(raw.breakingNewsSubscribers, registrations.breakingNewsSubscribers, raw.subscribers?.breakingNewsSubscribers, raw.subscribers?.breakingNews),
    articleAlertSubscribers: readNumber(raw.articleAlertSubscribers, registrations.articleAlertSubscribers, raw.subscribers?.articleAlertSubscribers, raw.subscribers?.articleAlerts),
    disabledDevices: readNumber(raw.disabledRegistrations, registrationStats.disabledRegistrations, raw.disabledDevices, raw.disabledCount, registrations.disabledRegistrations, registrations.disabled, registrations.disabledCount) ?? 0,
    lastRegistration: readTimestamp(raw.lastRegistration, raw.lastRegistrationAt, registrations.lastRegistration, registrations.lastRegistrationAt),
    lastSuccessfulSend: readTimestamp(raw.lastSuccessfulSend, raw.lastSuccessfulSendAt, sends.lastSuccessfulSend, sends.lastSuccessfulSendAt),
    lastFailedAttempt: readTimestamp(raw.lastFailureAt, raw.lastFailedAttemptAt, sends.lastFailureAt, sends.lastFailedAttemptAt),
    lastFailureCode: readSafeFailureCode(raw.lastFailureCode, sends.lastFailureCode, raw.lastFailure, sends.lastFailure, sends.lastError, raw.error),
  };
}

function formatCount(value: number | null): string {
  return value === null ? 'Unknown' : value.toLocaleString();
}

function formatValue(value: string | null): string {
  return value || 'None';
}

function normalizePushCleanupPreview(input: unknown): PushCleanupPreview {
  const raw = input && typeof input === 'object' ? (input as any) : {};
  const source = raw.preview && typeof raw.preview === 'object' ? raw.preview : raw;
  const eligibleCount = readNumber(source.eligibleCount, source.eligibleRecords, source.count, raw.eligibleCount) ?? 0;
  const retentionDays = readNumber(source.retentionDays, source.retention, raw.retentionDays) ?? PUSH_CLEANUP_RETENTION_DAYS;

  return {
    eligibleCount: Math.max(0, eligibleCount),
    deletedCount: 0,
    retentionDays: retentionDays > 0 ? retentionDays : PUSH_CLEANUP_RETENTION_DAYS,
  };
}

async function loadPushCleanupPreview(): Promise<PushCleanupPreview> {
  try {
    const data = await adminJson(PUSH_CLEANUP_PREVIEW_PATH, { method: 'GET', cache: 'no-store' });
    return normalizePushCleanupPreview(data);
  } catch (error) {
    if (error instanceof AdminApiError && (error.status === 404 || error.status === 405)) {
      const data = await adminJson(PUSH_CLEANUP_PREVIEW_PATH, { method: 'POST' });
      return normalizePushCleanupPreview(data);
    }
    throw error;
  }
}

function typeChipClass(type: string): string {
  return type.toLowerCase() === 'breaking'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-blue-200 bg-blue-50 text-blue-700';
}

function statusChipClass(status: string): string {
  if (status === 'Clicked') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Shown' || status === 'Notification Shown') return 'border-teal-200 bg-teal-50 text-teal-700';
  if (status === 'Browser Received') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'FCM Accepted') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (status === 'Partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Failed') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

async function loadPushDiagnostics(): Promise<PushDiagnostics> {
  try {
    const data = await adminJson('/admin/push/status', { cache: 'no-store' });
    return normalizePushDiagnostics(data, true);
  } catch {
    return { ...EMPTY_DIAGNOSTICS, fcmStatus: 'Error' };
  }
}

export default function PushNotificationsSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics>(EMPTY_DIAGNOSTICS);
  const [history, setHistory] = useState<PushHistoryRecord[]>([]);
  const [cleanupCheck, setCleanupCheck] = useState<PushCleanupCheckState>({ status: 'idle' });

  const pushSettings = useMemo(() => {
    const raw = (draft as any)?.pushNotifications || {};
    const rawTypes = raw.types || {};
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      types: {
        breakingNewsAlerts: typeof rawTypes.breakingNewsAlerts === 'boolean' ? rawTypes.breakingNewsAlerts : true,
        topStories: typeof rawTypes.topStories === 'boolean' ? rawTypes.topStories : true,
        newArticleAlerts: typeof rawTypes.newArticleAlerts === 'boolean' ? rawTypes.newArticleAlerts : true,
        categoryAlerts: typeof rawTypes.categoryAlerts === 'boolean' ? rawTypes.categoryAlerts : true,
        allArticles: typeof rawTypes.allArticles === 'boolean' ? rawTypes.allArticles : false,
      },
    };
  }, [draft]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [nextDiagnostics, nextHistory] = await Promise.all([loadPushDiagnostics(), loadPushHistory(5)]);
      if (mounted) setDiagnostics(nextDiagnostics);
      if (mounted) setHistory(nextHistory);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const checkPushCleanup = async () => {
    setCleanupCheck({ status: 'checking' });
    try {
      const result = await loadPushCleanupPreview();
      setCleanupCheck({ status: 'success', result });
    } catch {
      setCleanupCheck({ status: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Push Notifications</div>
        <div className="mt-1 text-sm text-slate-600">
          Control whether News Pulse offers push notifications to website visitors and configure the types of news alerts that are available.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="text-base font-semibold text-slate-950">Website Push Notifications</div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Enable Push Notifications on Website</div>
            <div className="text-xs text-slate-600">Controls whether the News Pulse public website offers push notification functionality to visitors.</div>
          </div>
          <Switch
            checked={pushSettings.enabled}
            onCheckedChange={(v) => patchDraft({ pushNotifications: { enabled: v } } as any)}
            label="Enable Push Notifications on Website"
          />
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
          Website notification availability is controlled here. Individual visitors still choose whether to allow notifications in their browser and may manage their own notification preferences.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <div className="text-base font-semibold text-slate-950">Available Notification Types</div>
          <div className="mt-1 text-sm text-slate-600">Choose which News Pulse alert types are available to visitors.</div>
        </div>

        {NOTIFICATION_TYPES.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold">{item.label}</div>
            <Switch
              checked={pushSettings.types[item.key]}
              onCheckedChange={(v) => patchDraft({ pushNotifications: { types: { [item.key]: v } } } as any)}
              label={item.label}
            />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <div className="text-base font-semibold text-slate-950">Push System Health</div>
          <div className="mt-1 text-sm text-slate-600">Read-only delivery diagnostics from the admin backend.</div>
          <div className="mt-1 text-xs text-slate-500">Deliverable Push Devices are browsers/devices with valid FCM tokens. FID-only records are old or non-deliverable and cannot receive push.</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Firebase Cloud Messaging</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{diagnostics.fcmStatus}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Messaging Available</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{diagnostics.messagingAvailable ? 'Yes' : 'No'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Backend Reachable</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{diagnostics.backendReachable ? 'Yes' : 'No'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Total Registrations</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatCount(diagnostics.totalRegistrations)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Deliverable Push Devices</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatCount(diagnostics.deliverablePushDevices)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">FID-only / Non-deliverable Records</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatCount(diagnostics.fidOnlyNonDeliverableRecords)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Breaking News Subscribers</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatCount(diagnostics.breakingNewsSubscribers)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Article Alert Subscribers</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatCount(diagnostics.articleAlertSubscribers)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Disabled Devices</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatCount(diagnostics.disabledDevices)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Last Registration</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatValue(diagnostics.lastRegistration)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Last Successful Send</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatValue(diagnostics.lastSuccessfulSend)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Last Failed Attempt</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatValue(diagnostics.lastFailedAttempt)}</div>
            {diagnostics.lastFailureCode ? <div className="mt-1 max-w-56 break-words text-xs text-slate-500">Code: {diagnostics.lastFailureCode}</div> : null}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">Push Cleanup Check</div>
              <div className="mt-1 text-sm text-slate-600">Checks old non-deliverable push records using safe dry-run mode. This does not delete active devices or push history.</div>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={cleanupCheck.status === 'checking'}
              onClick={checkPushCleanup}
            >
              {cleanupCheck.status === 'checking' ? 'Checking...' : 'Check Push Cleanup'}
            </button>
          </div>

          {cleanupCheck.status === 'success' ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <div className="font-semibold text-slate-950">{cleanupCheck.result.eligibleCount > 0 ? 'Review Needed' : 'Clean'}</div>
              <div className="mt-1">
                {cleanupCheck.result.eligibleCount > 0
                  ? `${cleanupCheck.result.eligibleCount.toLocaleString()} old non-deliverable push records found. Real cleanup should be done only after Founder verification.`
                  : 'No cleanup needed. Your push registrations are clean.'}
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="font-semibold uppercase text-slate-500">Retention</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{cleanupCheck.result.retentionDays.toLocaleString()} days</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase text-slate-500">Eligible records</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{cleanupCheck.result.eligibleCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase text-slate-500">Deleted records</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{cleanupCheck.result.deletedCount}</dd>
                </div>
              </dl>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">This check is dry-run only. It does not delete records.</div>
            </div>
          ) : null}

          {cleanupCheck.status === 'error' ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{PUSH_CLEANUP_UNAVAILABLE_MESSAGE}</div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-base font-semibold text-slate-950">Recent Push History</div>
            <div className="mt-1 text-sm text-slate-600">Latest 5 push notification delivery records.</div>
          </div>
          <Link
            to="history"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View All History
          </Link>
        </div>
        {history.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">No push notifications sent yet.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200" aria-label="Latest 5 push history">
            <div className="hidden grid-cols-[7rem_minmax(12rem,1.6fr)_12rem_8rem_13rem_8rem_7rem] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <div>Type</div>
              <div>Title</div>
              <div>Sent At</div>
              <div>Audience</div>
              <div>Delivery</div>
              <div>Status</div>
              <div className="text-right">Details</div>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {history.map((item) => {
                const statusLabel = formatRecentPushStatus(item);
                const statusDisplayLabel = formatPushStatusLabel(statusLabel);
                return (
                  <article key={item.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[7rem_minmax(12rem,1.6fr)_12rem_8rem_13rem_8rem_7rem] lg:items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 lg:hidden">Type</span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${typeChipClass(item.type)}`}>{item.type}</span>
                    </div>
                    <div className="min-w-0">
                      <div title={item.title} className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-950">{item.title}</div>
                    </div>
                    <div className="text-xs font-medium leading-5 text-slate-700">{item.sentAt}</div>
                    <div className="font-semibold tabular-nums text-slate-800">{formatPushAudience(item)}</div>
                    <div className="text-xs font-medium leading-5 text-slate-700">{formatPushDeliverySummary(item)}</div>
                    <div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusChipClass(statusLabel)}`}>{statusDisplayLabel}</span>
                    </div>
                    <Link to="history" className="text-right text-sm font-semibold text-blue-700 hover:text-blue-800">View Details</Link>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}