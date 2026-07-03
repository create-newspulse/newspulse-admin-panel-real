import { adminJson, adminPatch } from '@/lib/http/adminFetch';

export const DPDP_REQUEST_STATUSES = [
  'Pending Verification',
  'Verified',
  'In Review',
  'Need More Details',
  'Completed',
  'Rejected',
  'Spam/Fake',
  'Closed',
] as const;

export type DpdpRequestStatus = (typeof DPDP_REQUEST_STATUSES)[number];

export type DpdpActivityEntry = {
  id: string;
  action: string;
  oldStatus: string;
  newStatus: string;
  adminNote: string;
  handledBy: string;
  timestamp: string;
};

export type DpdpPrivacyRequest = {
  id: string;
  requestId: string;
  referenceId: string;
  fullName: string;
  email: string;
  mobile: string;
  requestType: string;
  message: string;
  status: DpdpRequestStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  activityHistory: DpdpActivityEntry[];
};

export type DpdpPrivacyRequestPatch = {
  status: DpdpRequestStatus;
  adminNote?: string;
};

const BASE_PATH = '/dpdp/privacy-requests';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const next = cleanText(value);
    if (next) return next;
  }
  return '';
}

function normalizeStatus(value: unknown): DpdpRequestStatus {
  const raw = cleanText(value).toLowerCase().replace(/[_-]+/g, ' ');
  if (!raw) return 'Pending Verification';
  if (raw === 'pending' || raw === 'pending verification') return 'Pending Verification';
  if (raw === 'verified') return 'Verified';
  if (raw === 'review' || raw === 'in review') return 'In Review';
  if (raw === 'need more details' || raw === 'needs more details' || raw === 'need more verification') return 'Need More Details';
  if (raw === 'approved' || raw === 'complete' || raw === 'completed') return 'Completed';
  if (raw === 'rejected' || raw === 'reject') return 'Rejected';
  if (raw === 'spam' || raw === 'fake' || raw === 'spam fake' || raw === 'spam/fake') return 'Spam/Fake';
  if (raw === 'closed' || raw === 'close') return 'Closed';
  return 'Pending Verification';
}

function toApiStatus(status: DpdpRequestStatus): string {
  const map: Record<DpdpRequestStatus, string> = {
    'Pending Verification': 'pending_verification',
    Verified: 'verified',
    'In Review': 'in_review',
    'Need More Details': 'need_more_details',
    Completed: 'completed',
    Rejected: 'rejected',
    'Spam/Fake': 'spam_fake',
    Closed: 'closed',
  };
  return map[status];
}

function normalizeDate(value: unknown): string {
  const raw = cleanText(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function asObject(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const source = asObject(payload);
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  const data = source.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return extractArray(data, keys);
  return [];
}

function extractRecord(payload: unknown): unknown {
  const source = asObject(payload);
  return source.request || source.privacyRequest || source.item || source.data || payload;
}

function normalizeActivityEntry(input: unknown, index: number): DpdpActivityEntry {
  const source = asObject(input);
  const timestamp = normalizeDate(source.timestamp ?? source.createdAt ?? source.created_at ?? source.updatedAt ?? source.updated_at);
  return {
    id: firstText(source.id, source._id) || `activity-${index}`,
    action: firstText(source.action, source.type, source.event) || 'Update',
    oldStatus: firstText(source.oldStatus, source.old_status, source.fromStatus, source.from_status),
    newStatus: firstText(source.newStatus, source.new_status, source.toStatus, source.to_status, source.status),
    adminNote: firstText(source.adminNote, source.admin_note, source.note, source.message),
    handledBy: firstText(source.handledBy, source.handled_by, source.actorName, source.actor, source.adminEmail),
    timestamp,
  };
}

function normalizePrivacyRequest(input: unknown): DpdpPrivacyRequest {
  const source = asObject(input);
  const id = firstText(source.id, source._id, source.requestId, source.request_id, source.referenceId, source.reference_id);
  const requestId = firstText(source.requestId, source.request_id, source.referenceId, source.reference_id, source.id, source._id);
  const referenceId = firstText(source.referenceId, source.reference_id, source.requestId, source.request_id, source.id, source._id);
  const activity = extractArray(source.activityHistory || source.auditLog || source.audit_log || source.history || source.activities, ['activityHistory', 'auditLog', 'audit_log', 'history', 'activities']);

  return {
    id,
    requestId,
    referenceId,
    fullName: firstText(source.fullName, source.full_name, source.name),
    email: firstText(source.email).toLowerCase(),
    mobile: firstText(source.mobile, source.phone, source.phoneNumber, source.phone_number),
    requestType: firstText(source.requestType, source.request_type, source.type) || 'Other privacy request',
    message: firstText(source.message, source.summary, source.requestSummary, source.request_summary, source.description),
    status: normalizeStatus(source.status),
    adminNote: firstText(source.adminNote, source.admin_note, source.note),
    createdAt: normalizeDate(source.createdAt ?? source.created_at ?? source.createdDate),
    updatedAt: normalizeDate(source.updatedAt ?? source.updated_at ?? source.updatedDate),
    activityHistory: activity.map(normalizeActivityEntry),
  };
}

export async function listDpdpPrivacyRequests(): Promise<DpdpPrivacyRequest[]> {
  const payload = await adminJson<unknown>(BASE_PATH);
  return extractArray(payload, ['requests', 'privacyRequests', 'items']).map(normalizePrivacyRequest);
}

export async function getDpdpPrivacyRequest(id: string): Promise<DpdpPrivacyRequest> {
  const safeId = encodeURIComponent(cleanText(id));
  const payload = await adminJson<unknown>(`${BASE_PATH}/${safeId}`);
  return normalizePrivacyRequest(extractRecord(payload));
}

export async function updateDpdpPrivacyRequest(id: string, patch: DpdpPrivacyRequestPatch): Promise<DpdpPrivacyRequest> {
  const safeId = encodeURIComponent(cleanText(id));
  const payload = await adminPatch<unknown>(`${BASE_PATH}/${safeId}`, {
    status: toApiStatus(patch.status),
    adminNote: cleanText(patch.adminNote),
  });
  return normalizePrivacyRequest(extractRecord(payload));
}
