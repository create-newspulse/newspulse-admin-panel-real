import { adminJson } from '@/lib/http/adminFetch';

export type PushHistoryStatus = 'Sent' | 'Failed' | 'No recipients';
export type PushHistoryFilterStatus = 'all' | 'sent' | 'failed' | 'no-recipients';
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
  status: PushHistoryStatus;
};

export type PushHistoryFilters = {
  date: PushHistoryFilterDate;
  type: PushHistoryFilterType;
  status: PushHistoryFilterStatus;
};

export const PUSH_HISTORY_PAGE_SIZE = 20;

export function sanitizePushHistoryText(value: string): string | null {
  const text = value
    .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/gi, '[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\b(?:token|fid|registration[_ -]?id|private[_ -]?key|client[_ -]?email)\b\s*[:=]\s*["']?[^"',\s}]+/gi, '[redacted]')
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
      ? { label: sanitizePushHistoryText(trimmed) || 'Unknown', ms: null }
      : { label: new Date(time).toLocaleString(), ms: time };
  }
  return { label: 'Unknown', ms: null };
}

function readText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const safe = sanitizePushHistoryText(String(value));
    if (safe) return safe;
  }
  return '';
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

export function getPushHistoryStatus(raw: any, targeted: number | null, success: number | null, failed: number | null): PushHistoryStatus {
  const statusText = readText(raw?.status, raw?.state, raw?.result).toLowerCase();
  if (targeted === 0 || statusText.includes('no recipient') || statusText.includes('no-recipient')) return 'No recipients';
  if ((typeof failed === 'number' && failed > 0) || statusText.includes('fail') || statusText.includes('error')) return 'Failed';
  return 'Sent';
}

export function normalizePushHistory(input: unknown, limit?: number): PushHistoryRecord[] {
  const rows = readHistoryArray(input);
  const limited = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  return limited.map((raw: any, index) => {
    const targeted = readPushHistoryNumber(raw?.targeted, raw?.targetedCount, raw?.targetCount, raw?.stats?.targeted);
    const success = readPushHistoryNumber(raw?.success, raw?.successCount, raw?.sent, raw?.stats?.success);
    const failed = readPushHistoryNumber(raw?.failed, raw?.failureCount, raw?.failures, raw?.stats?.failed);
    const sentAt = readPushHistoryTimestamp(raw?.sentAt, raw?.createdAt, raw?.updatedAt, raw?.timestamp);
    return {
      id: readText(raw?.id, raw?._id) || `push-history-${index}`,
      type: formatType(readText(raw?.type, raw?.kind, raw?.category)),
      title: readText(raw?.title, raw?.headline, raw?.notification?.title) || 'Untitled',
      sentAt: sentAt.label,
      sentAtMs: sentAt.ms,
      targeted,
      success,
      failed,
      status: getPushHistoryStatus(raw, targeted, success, failed),
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