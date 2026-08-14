import { adminJson } from '@/lib/http/adminFetch';

export type PushHistoryStatus = 'Sent' | 'Received' | 'Clicked' | 'Failed' | 'No recipients';
export type PushHistoryFilterStatus = 'all' | 'sent' | 'received' | 'clicked' | 'failed' | 'no-recipients';
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
  clicked: number | null;
  firstReceivedAt: string | null;
  lastReceivedAt: string | null;
  firstClickedAt: string | null;
  lastClickedAt: string | null;
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
  ].join('-') + `:${padPushTimestamp(date.getUTCHours())}:${padPushTimestamp(date.getUTCMinutes())}:${padPushTimestamp(date.getUTCSeconds())}.${padPushTimestamp(date.getUTCMilliseconds(), 3)} IST`;
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

export function formatPushDeliveryProof(record: PushHistoryRecord): string {
  const targeted = record.targeted ?? 0;
  if (record.status === 'No recipients') return `Targeted ${targeted.toLocaleString()}`;

  const parts = [
    `Targeted ${targeted.toLocaleString()}`,
    `FCM accepted ${(record.success ?? 0).toLocaleString()}`,
  ];

  if (record.status === 'Failed') {
    parts.push(`Failed ${(record.failed ?? 0).toLocaleString()}`);
  } else {
    parts.push(`Browser received ${(record.browserReceived ?? 0).toLocaleString()}`);
    parts.push(`Clicked ${(record.clicked ?? 0).toLocaleString()}`);
  }

  return parts.join(' · ');
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
  clicked: number | null,
): PushHistoryStatus {
  const statusText = readText(raw?.status, raw?.state, raw?.result).toLowerCase();
  if (typeof clicked === 'number' && clicked > 0) return 'Clicked';
  if (typeof browserReceived === 'number' && browserReceived > 0) return 'Received';
  if (typeof success === 'number' && success > 0) return 'Sent';
  if (typeof failed === 'number' && failed > 0 && (success ?? 0) === 0) return 'Failed';
  if (targeted === 0) return 'No recipients';
  if (statusText.includes('click')) return 'Clicked';
  if (statusText.includes('receiv')) return 'Received';
  if (statusText.includes('sent') || statusText.includes('success')) return 'Sent';
  if (statusText.includes('fail') || statusText.includes('error')) return 'Failed';
  if (statusText.includes('no recipient') || statusText.includes('no-recipient')) return 'No recipients';
  return 'Sent';
}

export function normalizePushHistory(input: unknown, limit?: number): PushHistoryRecord[] {
  const rows = readHistoryArray(input);
  const limited = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  return limited.map((raw: any, index) => {
    const targeted = readPushHistoryNumber(raw?.targeted, raw?.targetedCount, raw?.targetCount, raw?.stats?.targeted);
    const success = readPushHistoryNumber(raw?.success, raw?.successCount, raw?.sent, raw?.stats?.success);
    const failed = readPushHistoryNumber(raw?.failed, raw?.failureCount, raw?.failures, raw?.stats?.failed);
    const browserReceived = readPushHistoryNumber(raw?.browserReceivedCount, raw?.receivedCount, raw?.browserReceived, raw?.stats?.browserReceived);
    const clicked = readPushHistoryNumber(raw?.clickedCount, raw?.clickCount, raw?.clicked, raw?.stats?.clicked);
    const sentAt = readPushHistoryTimestamp(raw?.sentAt, raw?.createdAt, raw?.updatedAt, raw?.timestamp);
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
      clicked,
      firstReceivedAt: readOptionalPushHistoryTimestamp(raw?.firstReceivedAt, raw?.firstBrowserReceivedAt, raw?.receivedAt?.first, raw?.stats?.firstReceivedAt),
      lastReceivedAt: readOptionalPushHistoryTimestamp(raw?.lastReceivedAt, raw?.lastBrowserReceivedAt, raw?.receivedAt?.last, raw?.stats?.lastReceivedAt),
      firstClickedAt: readOptionalPushHistoryTimestamp(raw?.firstClickedAt, raw?.firstClickAt, raw?.clickedAt?.first, raw?.stats?.firstClickedAt),
      lastClickedAt: readOptionalPushHistoryTimestamp(raw?.lastClickedAt, raw?.lastClickAt, raw?.clickedAt?.last, raw?.stats?.lastClickedAt),
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
      status: getPushHistoryStatus(raw, targeted, success, failed, browserReceived, clicked),
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
    if (filters.status === 'sent' && record.status !== 'Sent') return false;
    if (filters.status === 'received' && record.status !== 'Received') return false;
    if (filters.status === 'clicked' && record.status !== 'Clicked') return false;
    if (filters.status === 'failed' && record.status !== 'Failed') return false;
    if (filters.status === 'no-recipients' && record.status !== 'No recipients') return false;
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