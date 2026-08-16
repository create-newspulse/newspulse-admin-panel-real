import { adminJson } from '@/lib/http/adminFetch';

export type PushHistoryStatus = 'FCM Accepted' | 'Browser Received' | 'Shown' | 'Clicked' | 'Failed' | 'No recipients' | 'Partial';

export function formatPushStatusLabel(status: PushHistoryStatus | string): string {
  return status === 'Shown' ? 'Notification Shown' : status;
}

export type PushHistoryFilterStatus = 'all' | 'fcm-accepted' | 'browser-received' | 'shown' | 'clicked' | 'failed' | 'no-recipients' | 'partial';
export type PushHistoryFilterType = 'all' | 'breaking' | 'article';
export type PushHistoryFilterDate = 'today' | '7d' | '30d' | 'all';

export type PushHistoryRecord = {
  id: string;
  type: string;
  title: string;
  sentAt: string;
  sentAtMs: number | null;
  targeted: number | null;
  success: number | null;
  failed: number | null;
  browserReceived: number | null;
  notificationShown: number | null;
  clicked: number | null;
  firstReceivedAt: string | null;
  lastReceivedAt: string | null;
  firstShownAt: string | null;
  lastShownAt: string | null;
  firstClickedAt: string | null;
  lastClickedAt: string | null;
  fcmAcceptedInSeconds: number | null;
  browserReceivedInSeconds: number | null;
  notificationShownInSeconds: number | null;
  clickedInSeconds: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  status: PushHistoryStatus;
};

export type PushHistoryFilters = {
  date: PushHistoryFilterDate;
  type: PushHistoryFilterType;
  status: PushHistoryFilterStatus;
};

export const PUSH_HISTORY_PAGE_SIZE = 20;

function padPushTimestamp(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

export function formatPushIstTimestamp(value: unknown): string {
  if (value === null || value === undefined) return 'None';

  const time = (() => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return Number.NaN;

    const trimmed = value.trim();
    return trimmed ? Date.parse(trimmed) : Number.NaN;
  })();

  if (!Number.isFinite(time)) return 'None';

  const date = new Date(time + 5.5 * 60 * 60 * 1000);
  return [
    padPushTimestamp(date.getUTCDate()),
    padPushTimestamp(date.getUTCMonth() + 1),
    date.getUTCFullYear(),
  ].join('-') + ` ${padPushTimestamp(date.getUTCHours())}:${padPushTimestamp(date.getUTCMinutes())}:${padPushTimestamp(date.getUTCSeconds())}.${padPushTimestamp(date.getUTCMilliseconds(), 3)} IST`;
}

export function sanitizePushHistoryText(value: string): string | null {
  const text = value
    .replace(/(?:\r?\n|\r)\s*(?:at\s+|caused by:|error:\s*)[\s\S]*$/i, '')
    .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/gi, '[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\b(?:token|fid|registration[_ -]?id|private[_ -]?key|client[_ -]?email)\b\s*[:=]\s*["']?[^"',\s}]+/gi, '[redacted]')
    .replace(/\b(?:token|fid|registration[_ -]?id|private[_ -]?key|client[_ -]?email)\b\s+["']?[^"',\s}]+/gi, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{64,}\b/g, '[redacted]')
    .trim();
  return text ? text.slice(0, 160) : null;
}

export function readPushHistoryNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

export function readPushHistoryTimestamp(...values: unknown[]): { label: string; ms: number | null } {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const time = Date.parse(trimmed);
    return Number.isNaN(time)
      ? { label: 'None', ms: null }
      : { label: formatPushIstTimestamp(time), ms: time };
  }
  return { label: 'None', ms: null };
}

function readOptionalPushHistoryTimestamp(...values: unknown[]): string | null {
  const timestamp = readPushHistoryTimestamp(...values);
  return timestamp.ms === null ? null : timestamp.label;
}

function readOptionalPushHistoryTimestampMs(...values: unknown[]): number | null {
  const timestamp = readPushHistoryTimestamp(...values);
  return timestamp.ms;
}

function readPushHistorySeconds(...values: unknown[]): number | null {
  const value = readPushHistoryNumber(...values);
  return value !== null && value >= 0 ? value : null;
}

function readPushHistoryMillisecondsAsSeconds(...values: unknown[]): number | null {
  const value = readPushHistoryNumber(...values);
  return value !== null && value >= 0 ? value / 1000 : null;
}

function secondsBetween(startMs: number | null, endMs: number | null): number | null {
  if (startMs === null || endMs === null || endMs < startMs) return null;
  return (endMs - startMs) / 1000;
}

function formatResponseSeconds(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}s`;
}

export function formatPushDeliveryProof(record: PushHistoryRecord): string {
  const targeted = record.targeted ?? 0;
  if (record.status === 'No recipients') return `Targeted ${targeted.toLocaleString()}`;

  return [
    `Targeted ${targeted.toLocaleString()}`,
    `FCM accepted ${(record.success ?? 0).toLocaleString()}`,
    `Browser received ${(record.browserReceived ?? 0).toLocaleString()}`,
    `Notification shown ${(record.notificationShown ?? 0).toLocaleString()}`,
    `Clicked ${(record.clicked ?? 0).toLocaleString()}`,
  ].join(' · ');
}

export function formatPushAudience(record: PushHistoryRecord): string {
  return `${(record.targeted ?? 0).toLocaleString()} targeted`;
}

export function formatPushDeliverySummary(record: PushHistoryRecord): string {
  return [
    `FCM ${(record.success ?? 0).toLocaleString()}`,
    `Browser ${(record.browserReceived ?? 0).toLocaleString()}`,
    `Shown ${(record.notificationShown ?? 0).toLocaleString()}`,
    `Clicked ${(record.clicked ?? 0).toLocaleString()}`,
  ].join(' • ');
}

export function formatRecentPushStatus(record: PushHistoryRecord): PushHistoryStatus {
  return record.status;
}

export function formatPushResponseTiming(record: PushHistoryRecord): string | null {
  if (record.status === 'Clicked' && record.clickedInSeconds !== null) return `Clicked in ${formatResponseSeconds(record.clickedInSeconds)}`;
  if (record.status === 'Shown' && record.notificationShownInSeconds !== null) return `First notification shown in ${formatResponseSeconds(record.notificationShownInSeconds)}`;
  if (record.status === 'Browser Received' && record.browserReceivedInSeconds !== null) return `First browser received in ${formatResponseSeconds(record.browserReceivedInSeconds)}`;
  if ((record.status === 'FCM Accepted' || record.status === 'Partial') && record.fcmAcceptedInSeconds !== null) return `FCM accepted in ${formatResponseSeconds(record.fcmAcceptedInSeconds)}`;
  return null;
}

export function formatPushAcceptedTiming(record: PushHistoryRecord): string | null {
  return record.fcmAcceptedInSeconds === null ? null : `FCM accepted in ${formatResponseSeconds(record.fcmAcceptedInSeconds)}`;
}

export function formatPushBrowserReceivedTiming(record: PushHistoryRecord): string | null {
  return record.browserReceivedInSeconds === null ? null : `First browser received in ${formatResponseSeconds(record.browserReceivedInSeconds)}`;
}

export function formatPushNotificationShownTiming(record: PushHistoryRecord): string | null {
  return record.notificationShownInSeconds === null ? null : `First notification shown in ${formatResponseSeconds(record.notificationShownInSeconds)}`;
}

export function formatPushClickTiming(record: PushHistoryRecord): string | null {
  return record.clickedInSeconds === null ? null : `Clicked in ${formatResponseSeconds(record.clickedInSeconds)}`;
}

function readText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const safe = sanitizePushHistoryText(String(value));
    if (safe) return safe;
  }
  return '';
}

function readOptionalText(...values: unknown[]): string | null {
  const text = readText(...values);
  return text || null;
}

function readFirstFailureObject(raw: any): any {
  const candidates = [
    raw?.failure,
    raw?.lastFailure,
    raw?.error,
    raw?.firebaseError,
    raw?.fcmError,
    raw?.result,
    Array.isArray(raw?.failures) ? raw.failures[0] : raw?.failures,
    Array.isArray(raw?.errors) ? raw.errors[0] : raw?.errors,
  ];
  return candidates.find((candidate) => candidate && typeof candidate === 'object') || {};
}

function formatType(value: string): string {
  const text = value.trim().toLowerCase();
  if (!text) return 'Unknown';
  return text.slice(0, 1).toUpperCase() + text.slice(1);
}

function readHistoryArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.items)) return input.items;
  if (Array.isArray(input?.rows)) return input.rows;
  if (Array.isArray(input?.records)) return input.records;
  if (Array.isArray(input?.history)) return input.history;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.data?.items)) return input.data.items;
  if (Array.isArray(input?.data?.rows)) return input.data.rows;
  if (Array.isArray(input?.data?.history)) return input.data.history;
  return [];
}

export function getPushHistoryStatus(
  raw: any,
  targeted: number | null,
  success: number | null,
  failed: number | null,
  browserReceived: number | null,
  notificationShown: number | null,
  clicked: number | null,
): PushHistoryStatus {
  const statusText = readText(raw?.status, raw?.state, raw?.result).toLowerCase();
  if (typeof clicked === 'number' && clicked > 0) return 'Clicked';
  if (typeof notificationShown === 'number' && notificationShown > 0) return 'Shown';
  if (typeof browserReceived === 'number' && browserReceived > 0) return 'Browser Received';
  if (typeof success === 'number' && success > 0 && (browserReceived ?? 0) === 0) return 'FCM Accepted';
  if (typeof failed === 'number' && failed > 0 && (success ?? 0) > 0) return 'Partial';
  if (statusText.includes('partial')) return 'Partial';
  if (typeof failed === 'number' && failed > 0 && (success ?? 0) === 0) return 'Failed';
  if (targeted === 0) return 'No recipients';
  if (statusText.includes('click')) return 'Clicked';
  if (statusText.includes('shown') || statusText.includes('display')) return 'Shown';
  if (statusText.includes('receiv')) return 'Browser Received';
  if (statusText.includes('fcm') || statusText.includes('accept') || statusText.includes('sent') || statusText.includes('success')) return 'FCM Accepted';
  if (statusText.includes('fail') || statusText.includes('error')) return 'Failed';
  if (statusText.includes('no recipient') || statusText.includes('no-recipient')) return 'No recipients';
  return 'FCM Accepted';
}

export function normalizePushHistory(input: unknown, limit?: number): PushHistoryRecord[] {
  const rows = readHistoryArray(input);
  const limited = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  return limited.map((raw: any, index) => {
    const targeted = readPushHistoryNumber(raw?.targeted, raw?.targetedCount, raw?.targetCount, raw?.stats?.targeted);
    const success = readPushHistoryNumber(raw?.success, raw?.successCount, raw?.sent, raw?.stats?.success);
    const failed = readPushHistoryNumber(raw?.failed, raw?.failureCount, raw?.failures, raw?.stats?.failed);
    const browserReceived = readPushHistoryNumber(raw?.browserReceivedCount, raw?.receivedCount, raw?.browserReceived, raw?.stats?.browserReceived);
    const notificationShown = readPushHistoryNumber(raw?.notificationShownCount, raw?.shownCount, raw?.notificationShown, raw?.stats?.notificationShown);
    const clicked = readPushHistoryNumber(raw?.clickedCount, raw?.clickCount, raw?.clicked, raw?.stats?.clicked);
    const sentAt = readPushHistoryTimestamp(raw?.sentAt, raw?.createdAt, raw?.updatedAt, raw?.timestamp);
    const fcmAcceptedAtMs = readOptionalPushHistoryTimestampMs(raw?.fcmAcceptedAt, raw?.acceptedAt, raw?.successAt, raw?.firstAcceptedAt, raw?.stats?.fcmAcceptedAt, raw?.timing?.fcmAcceptedAt);
    const firstReceivedAt = readPushHistoryTimestamp(raw?.firstReceivedAt, raw?.firstBrowserReceivedAt, raw?.receivedAt?.first, raw?.stats?.firstReceivedAt);
    const firstShownAt = readPushHistoryTimestamp(raw?.firstShownAt, raw?.firstNotificationShownAt, raw?.notificationShownAt?.first, raw?.shownAt?.first, raw?.stats?.firstShownAt, raw?.stats?.firstNotificationShownAt);
    const firstClickedAt = readPushHistoryTimestamp(raw?.firstClickedAt, raw?.firstClickAt, raw?.clickedAt?.first, raw?.stats?.firstClickedAt);
    const failure = readFirstFailureObject(raw);
    return {
      id: readText(raw?.id, raw?._id) || `push-history-${index}`,
      type: formatType(readText(raw?.type, raw?.kind, raw?.category)),
      title: readText(raw?.title, raw?.headline, raw?.notification?.title) || 'Untitled',
      sentAt: sentAt.label,
      sentAtMs: sentAt.ms,
      targeted,
      success,
      failed,
      browserReceived,
      notificationShown,
      clicked,
      firstReceivedAt: firstReceivedAt.ms === null ? null : firstReceivedAt.label,
      lastReceivedAt: readOptionalPushHistoryTimestamp(raw?.lastReceivedAt, raw?.lastBrowserReceivedAt, raw?.receivedAt?.last, raw?.stats?.lastReceivedAt),
      firstShownAt: firstShownAt.ms === null ? null : firstShownAt.label,
      lastShownAt: readOptionalPushHistoryTimestamp(raw?.lastShownAt, raw?.lastNotificationShownAt, raw?.notificationShownAt?.last, raw?.shownAt?.last, raw?.stats?.lastShownAt, raw?.stats?.lastNotificationShownAt),
      firstClickedAt: firstClickedAt.ms === null ? null : firstClickedAt.label,
      lastClickedAt: readOptionalPushHistoryTimestamp(raw?.lastClickedAt, raw?.lastClickAt, raw?.clickedAt?.last, raw?.stats?.lastClickedAt),
      fcmAcceptedInSeconds: readPushHistorySeconds(raw?.fcmAcceptedInSeconds, raw?.fcmAcceptedSeconds, raw?.acceptedInSeconds, raw?.acceptedSeconds, raw?.timing?.fcmAcceptedInSeconds) ?? readPushHistoryMillisecondsAsSeconds(raw?.fcmAcceptedMs, raw?.acceptedMs, raw?.fcmLatencyMs, raw?.timing?.fcmAcceptedMs) ?? secondsBetween(sentAt.ms, fcmAcceptedAtMs),
      browserReceivedInSeconds: readPushHistorySeconds(raw?.browserReceivedInSeconds, raw?.firstBrowserReceivedInSeconds, raw?.receivedInSeconds, raw?.timing?.browserReceivedInSeconds) ?? readPushHistoryMillisecondsAsSeconds(raw?.browserReceivedMs, raw?.firstBrowserReceivedMs, raw?.receivedMs, raw?.deliveryLatencyMs, raw?.timing?.browserReceivedMs) ?? secondsBetween(sentAt.ms, firstReceivedAt.ms),
      notificationShownInSeconds: readPushHistorySeconds(raw?.notificationShownInSeconds, raw?.firstNotificationShownInSeconds, raw?.shownInSeconds, raw?.timing?.notificationShownInSeconds) ?? readPushHistoryMillisecondsAsSeconds(raw?.notificationShownMs, raw?.firstNotificationShownMs, raw?.shownMs, raw?.timing?.notificationShownMs) ?? secondsBetween(sentAt.ms, firstShownAt.ms),
      clickedInSeconds: readPushHistorySeconds(raw?.clickedInSeconds, raw?.firstClickedInSeconds, raw?.clickInSeconds, raw?.timing?.clickedInSeconds) ?? readPushHistoryMillisecondsAsSeconds(raw?.clickedMs, raw?.firstClickedMs, raw?.clickMs, raw?.timing?.clickedMs) ?? secondsBetween(sentAt.ms, firstClickedAt.ms),
      failureCode: readOptionalText(raw?.failureCode, raw?.code, raw?.errorCode, raw?.firebaseCode, raw?.fcmCode, failure?.code, failure?.errorCode),
      failureMessage: readOptionalText(
        raw?.failureMessage,
        raw?.safeFailureMessage,
        raw?.safeMessage,
        raw?.message,
        raw?.errorMessage,
        failure?.failureMessage,
        failure?.safeMessage,
        failure?.message,
        failure?.errorMessage,
      ),
      status: getPushHistoryStatus(raw, targeted, success, failed, browserReceived, notificationShown, clicked),
    };
  });
}

export function filterPushHistory(records: PushHistoryRecord[], filters: PushHistoryFilters, now = Date.now()): PushHistoryRecord[] {
  const minDate = (() => {
    if (filters.date === 'today') {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }
    if (filters.date === '7d') return now - 7 * 24 * 60 * 60 * 1000;
    if (filters.date === '30d') return now - 30 * 24 * 60 * 60 * 1000;
    return null;
  })();

  return records.filter((record) => {
    if (minDate !== null && (record.sentAtMs === null || record.sentAtMs < minDate)) return false;
    if (filters.type !== 'all' && record.type.toLowerCase() !== filters.type) return false;
    if (filters.status === 'fcm-accepted' && record.status !== 'FCM Accepted') return false;
    if (filters.status === 'browser-received' && record.status !== 'Browser Received') return false;
    if (filters.status === 'shown' && record.status !== 'Shown') return false;
    if (filters.status === 'clicked' && record.status !== 'Clicked') return false;
    if (filters.status === 'failed' && record.status !== 'Failed') return false;
    if (filters.status === 'no-recipients' && record.status !== 'No recipients') return false;
    if (filters.status === 'partial' && record.status !== 'Partial') return false;
    return true;
  });
}

export async function loadPushHistory(limit?: number): Promise<PushHistoryRecord[]> {
  try {
    const path = typeof limit === 'number' ? `/admin/push/history?limit=${encodeURIComponent(String(limit))}` : '/admin/push/history';
    const data = await adminJson(path, { cache: 'no-store' });
    return normalizePushHistory(data, limit);
  } catch {
    return [];
  }
}