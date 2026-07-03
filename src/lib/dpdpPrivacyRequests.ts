import seedAuditLog from '@/data/dpdp-audit-log.json';
import seedRequests from '@/data/dpdp-privacy-requests.json';

export const DPDP_REQUEST_TYPES = [
  'Access my data',
  'Correct/update my data',
  'Delete/erase my data',
  'Withdraw consent',
  'Privacy/data grievance',
  'Other privacy request',
] as const;

export const DPDP_REQUEST_STATUSES = [
  'Pending Verification',
  'Verified',
  'In Review',
  'Need More Details',
  'Approved',
  'Rejected',
  'Spam/Fake',
  'Closed',
] as const;

export type DpdpRequestType = (typeof DPDP_REQUEST_TYPES)[number];
export type DpdpRequestStatus = (typeof DPDP_REQUEST_STATUSES)[number];

export type DpdpPrivacyRequest = {
  requestId: string;
  fullName: string;
  email: string;
  mobile: string;
  requestType: DpdpRequestType;
  source: 'Email';
  message: string;
  status: DpdpRequestStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  handledBy: string;
};

export type DpdpAuditEntry = {
  id: string;
  action: 'create' | 'update' | 'status_change';
  requestId: string;
  oldStatus: DpdpRequestStatus | '';
  newStatus: DpdpRequestStatus;
  adminNote: string;
  handledBy: string;
  timestamp: string;
};

export type DpdpPrivacyRequestInput = {
  fullName: string;
  email: string;
  mobile: string;
  requestType: DpdpRequestType;
  message: string;
  status: DpdpRequestStatus;
  adminNote: string;
};

const REQUESTS_STORAGE_KEY = 'np_dpdp_privacy_requests_v1';
const AUDIT_STORAGE_KEY = 'np_dpdp_audit_log_v1';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRequestType(value: unknown): DpdpRequestType {
  const raw = cleanText(value);
  return DPDP_REQUEST_TYPES.includes(raw as DpdpRequestType) ? raw as DpdpRequestType : 'Other privacy request';
}

function normalizeStatus(value: unknown): DpdpRequestStatus {
  const raw = cleanText(value);
  return DPDP_REQUEST_STATUSES.includes(raw as DpdpRequestStatus) ? raw as DpdpRequestStatus : 'Pending Verification';
}

function safeIsoDate(value: unknown, fallback: string): string {
  const raw = cleanText(value);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function readJsonArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizePrivacyRequest(input: unknown): DpdpPrivacyRequest {
  const now = new Date().toISOString();
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const createdAt = safeIsoDate(source.createdAt ?? source.createdDate, now);
  const requestId = cleanText(source.requestId ?? source.id) || generateRequestId(createdAt);

  return {
    requestId,
    fullName: cleanText(source.fullName ?? source.name),
    email: cleanText(source.email).toLowerCase(),
    mobile: cleanText(source.mobile),
    requestType: normalizeRequestType(source.requestType),
    source: 'Email',
    message: cleanText(source.message ?? source.summary),
    status: normalizeStatus(source.status),
    adminNote: cleanText(source.adminNote ?? source.note),
    createdAt,
    updatedAt: safeIsoDate(source.updatedAt ?? source.updatedDate, createdAt),
    handledBy: cleanText(source.handledBy),
  };
}

function normalizeAuditEntry(input: unknown): DpdpAuditEntry {
  const now = new Date().toISOString();
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const action = cleanText(source.action);

  return {
    id: cleanText(source.id) || `DPDP-AUD-${Date.now()}`,
    action: action === 'create' || action === 'status_change' ? action : 'update',
    requestId: cleanText(source.requestId),
    oldStatus: source.oldStatus ? normalizeStatus(source.oldStatus) : '',
    newStatus: normalizeStatus(source.newStatus),
    adminNote: cleanText(source.adminNote),
    handledBy: cleanText(source.handledBy),
    timestamp: safeIsoDate(source.timestamp, now),
  };
}

function loadRequests(): DpdpPrivacyRequest[] {
  return readJsonArray<unknown>('np_dpdp_privacy_requests_seed_check', []).length
    ? readJsonArray<unknown>(REQUESTS_STORAGE_KEY, []).map(normalizePrivacyRequest)
    : readJsonArray<unknown>(REQUESTS_STORAGE_KEY, seedRequests).map(normalizePrivacyRequest);
}

function saveRequests(requests: DpdpPrivacyRequest[]): void {
  writeJsonArray(REQUESTS_STORAGE_KEY, requests);
  writeJsonArray('np_dpdp_privacy_requests_seed_check', ['ready']);
}

function loadAuditLog(): DpdpAuditEntry[] {
  return readJsonArray<unknown>(AUDIT_STORAGE_KEY, seedAuditLog).map(normalizeAuditEntry);
}

function saveAuditLog(entries: DpdpAuditEntry[]): void {
  writeJsonArray(AUDIT_STORAGE_KEY, entries);
}

function appendAuditEntry(entry: Omit<DpdpAuditEntry, 'id' | 'timestamp'>): void {
  const next: DpdpAuditEntry = {
    ...entry,
    id: `DPDP-AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  saveAuditLog([next, ...loadAuditLog()]);
}

export function generateRequestId(value: string | Date = new Date()): string {
  const parsed = value instanceof Date ? value : new Date(value);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `DPDP-${stamp}-${suffix}`;
}

export function listDpdpPrivacyRequests(): DpdpPrivacyRequest[] {
  return loadRequests().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function listDpdpAuditLog(): DpdpAuditEntry[] {
  return loadAuditLog().sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

export function createDpdpPrivacyRequest(input: DpdpPrivacyRequestInput, handledBy: string): DpdpPrivacyRequest {
  const now = new Date().toISOString();
  const request: DpdpPrivacyRequest = {
    requestId: generateRequestId(now),
    fullName: cleanText(input.fullName),
    email: cleanText(input.email).toLowerCase(),
    mobile: cleanText(input.mobile),
    requestType: normalizeRequestType(input.requestType),
    source: 'Email',
    message: cleanText(input.message),
    status: normalizeStatus(input.status),
    adminNote: cleanText(input.adminNote),
    createdAt: now,
    updatedAt: now,
    handledBy: cleanText(handledBy),
  };
  saveRequests([request, ...loadRequests()]);
  appendAuditEntry({
    action: 'create',
    requestId: request.requestId,
    oldStatus: '',
    newStatus: request.status,
    adminNote: request.adminNote,
    handledBy: request.handledBy,
  });
  return request;
}

export function updateDpdpPrivacyRequest(
  requestId: string,
  updates: Pick<DpdpPrivacyRequestInput, 'status' | 'adminNote'>,
  handledBy: string,
): DpdpPrivacyRequest | null {
  const requests = loadRequests();
  const index = requests.findIndex((request) => request.requestId === requestId);
  if (index === -1) return null;

  const current = requests[index];
  const newStatus = normalizeStatus(updates.status);
  const next: DpdpPrivacyRequest = {
    ...current,
    status: newStatus,
    adminNote: cleanText(updates.adminNote),
    handledBy: cleanText(handledBy) || current.handledBy,
    updatedAt: new Date().toISOString(),
  };

  requests[index] = next;
  saveRequests(requests);
  appendAuditEntry({
    action: current.status === next.status ? 'update' : 'status_change',
    requestId: next.requestId,
    oldStatus: current.status,
    newStatus: next.status,
    adminNote: next.adminNote,
    handledBy: next.handledBy,
  });
  return next;
}