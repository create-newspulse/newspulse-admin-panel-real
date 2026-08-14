import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import { adminJson } from '@/lib/http/adminFetch';
import { formatPushDeliveryProof, formatPushIstTimestamp, loadPushHistory, type PushHistoryRecord } from '@/lib/pushHistory';

type FcmStatusLabel = 'Configured' | 'Not Configured' | 'Error';

type PushDiagnostics = {
  fcmStatus: FcmStatusLabel;
  messagingAvailable: boolean;
  backendReachable: boolean;
  mongoRegistrations: number | null;
  enabledDevices: number | null;
  disabledDevices: number | null;
  lastRegistration: string | null;
  lastSuccessfulSend: string | null;
  lastFailure: string | null;
};

const EMPTY_DIAGNOSTICS: PushDiagnostics = {
  fcmStatus: 'Not Configured',
  messagingAvailable: false,
  backendReachable: false,
  mongoRegistrations: null,
  enabledDevices: null,
  disabledDevices: null,
  lastRegistration: null,
  lastSuccessfulSend: null,
  lastFailure: null,
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

function readSafeFailure(input: unknown): string | null {
  if (!input || typeof input !== 'object') return typeof input === 'string' ? sanitizeDiagnosticText(input) : null;

  const raw = input as any;
  const code = typeof raw.code === 'string' || typeof raw.code === 'number' ? String(raw.code).trim() : '';
  const message = typeof raw.safeMessage === 'string'
    ? raw.safeMessage.trim()
    : typeof raw.message === 'string'
      ? raw.message.trim()
      : typeof raw.error === 'string'
        ? raw.error.trim()
        : '';
  const parts = [code, message].map((part) => sanitizeDiagnosticText(part)).filter(Boolean);
  return parts.length ? parts.join(' - ') : null;
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
  const registrations = raw.registrations || raw.devices || raw.subscriptions || raw.mongodb || raw.mongo || {};
  const sends = raw.sends || raw.send || raw.delivery || raw.notifications || {};
  const fcm = normalizeFcmStatus(raw);

  return {
    ...EMPTY_DIAGNOSTICS,
    ...fcm,
    backendReachable: typeof raw.backendReachable === 'boolean' ? raw.backendReachable : backendReachable,
    mongoRegistrations: readNumber(raw.mongoRegistrations, raw.mongodbRegistrations, raw.registrationCount, registrations.total, registrations.count),
    enabledDevices: readNumber(raw.enabledDevices, raw.enabledCount, registrations.enabled, registrations.enabledCount),
    disabledDevices: readNumber(raw.disabledDevices, raw.disabledCount, registrations.disabled, registrations.disabledCount),
    lastRegistration: readTimestamp(raw.lastRegistration, raw.lastRegistrationAt, registrations.lastRegistration, registrations.lastRegistrationAt),
    lastSuccessfulSend: readTimestamp(raw.lastSuccessfulSend, raw.lastSuccessfulSendAt, sends.lastSuccessfulSend, sends.lastSuccessfulSendAt),
    lastFailure: readTimestamp(raw.lastFailureAt, raw.lastFailure, sends.lastFailureAt, sends.lastFailure) || readSafeFailure(raw.lastFailure || sends.lastFailure || sends.lastError || raw.error),
  };
}

function formatCount(value: number | null): string {
  return value === null ? 'Unknown' : value.toLocaleString();
}

function formatValue(value: string | null): string {
  return value || 'None';
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
            <div className="text-xs font-semibold uppercase text-slate-500">MongoDB Registrations</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatCount(diagnostics.mongoRegistrations)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Enabled Devices</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatCount(diagnostics.enabledDevices)}</div>
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
            <div className="text-xs font-semibold uppercase text-slate-500">Last Failure</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatValue(diagnostics.lastFailure)}</div>
          </div>
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
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Sent At</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.type}</td>
                    <td className="px-4 py-3 text-slate-700">{item.title}</td>
                    <td className="px-4 py-3 text-slate-700">{item.sentAt}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{item.status}</div>
                      <div className="mt-1 max-w-80 break-words text-xs text-slate-500">{formatPushDeliveryProof(item)}</div>
                      {item.status === 'Failed' && item.failureCode ? <div className="mt-1 max-w-56 break-words text-xs text-slate-500">{item.failureCode}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}