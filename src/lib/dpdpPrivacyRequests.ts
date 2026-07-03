import { adminJson, adminPatch, adminPost } from '@/lib/http/adminFetch';

export const DPDP_REQUEST_STATUSES = [
  'Pending Email Verification',
  'Verified',
  'In Review',
  'Need More Details',
  'Completed',
  'Rejected',
  'Spam/Fake',
  'Closed',
] as const;

export type DpdpRequestStatus = (typeof DPDP_REQUEST_STATUSES)[number];

export type DpdpPrivacyRequestFilter = 'All' | DpdpRequestStatus;

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

export type DpdpMatchingDataRecommendation = 'Delete' | 'Anonymize' | 'Manual Review';

export type DpdpMatchingDataItem = {
  recordId: string;
  source: string;
  sourceKey: string;
  sourceLabel: string;
  maskedPreview: string;
  recommendedAction: DpdpMatchingDataRecommendation;
  blocked: boolean;
  blockedReason: string;
  quickActionAllowed: boolean;
};

export type DpdpMatchingDataGroup = {
  key: string;
  label: string;
  items: DpdpMatchingDataItem[];
};

export type DpdpDataActionKind = 'delete' | 'anonymize';

export type DpdpDataActionSelection = {
  source: string;
  recordId: string;
  recommendedAction: DpdpMatchingDataRecommendation;
};

export type DpdpDataActionPayload = {
  action: DpdpDataActionKind;
  adminNote: string;
  founderConfirmation: string;
  items: DpdpDataActionSelection[];
};

export type DpdpDataActionResult = {
  message: string;
  summary: string;
  request: DpdpPrivacyRequest | null;
};

const BASE_PATH = '/dpdp/privacy-requests';

const MATCHING_DATA_GROUP_DEFS = [
  { key: 'contact_messages', label: 'Contact Messages', aliases: ['contact_messages', 'contact', 'contact_message', 'contact messages'] },
  { key: 'newsletter_subscribers', label: 'Newsletter Subscribers', aliases: ['newsletter_subscribers', 'newsletter', 'newsletter_subscriber', 'newsletter subscribers'] },
  { key: 'comments', label: 'Comments', aliases: ['comments', 'comment'] },
  { key: 'polls', label: 'Polls', aliases: ['polls', 'poll'] },
  { key: 'push_tokens', label: 'Push Tokens', aliases: ['push_tokens', 'push token', 'push tokens', 'push_subscriptions', 'push subscriptions'] },
  { key: 'career_applications', label: 'Career Applications', aliases: ['career_applications', 'career applications', 'careers', 'career'] },
  { key: 'community_reporter_requests', label: 'Community Reporter Requests', aliases: ['community_reporter_requests', 'community_reporter', 'community reporter', 'community reporters', 'community reporter requests'] },
  { key: 'journalist_desk_requests', label: 'Journalist Desk Requests', aliases: ['journalist_desk_requests', 'journalist_desk', 'journalist desk', 'journalist', 'journalist desk requests'] },
  { key: 'advertise_business_inquiries', label: 'Advertise/Business Inquiries', aliases: ['advertise_business_inquiries', 'advertise/business inquiries', 'advertise_business', 'business_inquiries', 'business inquiries', 'advertise inquiries'] },
  { key: 'user_account', label: 'User Account', aliases: ['user_account', 'user account', 'accounts', 'account'] },
  { key: 'staff_accounts', label: 'Staff Accounts', aliases: ['staff_accounts', 'staff account', 'staff accounts'] },
  { key: 'admin_accounts', label: 'Admin Accounts', aliases: ['admin_accounts', 'admin account', 'admin accounts'] },
  { key: 'founder_account', label: 'Founder Account', aliases: ['founder_account', 'founder account'] },
  { key: 'news_articles', label: 'News/Articles', aliases: ['news_articles', 'news', 'article', 'articles', 'news/articles'] },
  { key: 'audit_logs', label: 'Audit Logs', aliases: ['audit_logs', 'audit log', 'audit logs'] },
  { key: 'security_logs', label: 'Security Logs', aliases: ['security_logs', 'security log', 'security logs'] },
  { key: 'payment_records', label: 'Payment Records', aliases: ['payment_records', 'payment record', 'payment records', 'payments'] },
  { key: 'legal_records', label: 'Legal Records', aliases: ['legal_records', 'legal record', 'legal records', 'legal'] },
] as const;

const SAFE_DELETE_SOURCES = new Set([
  'contact_messages',
  'newsletter_subscribers',
  'advertise_business_inquiries',
  'community_reporter_requests',
  'journalist_desk_requests',
  'career_applications',
  'push_tokens',
]);

const SAFE_ANONYMIZE_SOURCES = new Set([
  'comments',
  'polls',
]);

const BLOCKED_QUICK_ACTION_SOURCES = new Set([
  'user_account',
  'staff_accounts',
  'admin_accounts',
  'founder_account',
  'news_articles',
  'audit_logs',
  'security_logs',
  'payment_records',
  'legal_records',
]);

const BLOCKED_QUICK_ACTION_REASON = 'Manual review only. This source cannot be deleted from DPDP quick action.';

const MATCHING_DATA_GROUP_LOOKUP = new Map(
  MATCHING_DATA_GROUP_DEFS.flatMap((definition) =>
    definition.aliases.map((alias) => [normalizeKey(alias), { key: definition.key, label: definition.label }] as const),
  ),
);

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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
  if (!raw) return 'Pending Email Verification';
  if (raw === 'pending' || raw === 'pending verification' || raw === 'pending email verification' || raw === 'email verification pending') return 'Pending Email Verification';
  if (raw === 'verified') return 'Verified';
  if (raw === 'review' || raw === 'in review') return 'In Review';
  if (raw === 'need more details' || raw === 'needs more details' || raw === 'need more verification') return 'Need More Details';
  if (raw === 'approved' || raw === 'complete' || raw === 'completed') return 'Completed';
  if (raw === 'rejected' || raw === 'reject') return 'Rejected';
  if (raw === 'spam' || raw === 'fake' || raw === 'spam fake' || raw === 'spam/fake') return 'Spam/Fake';
  if (raw === 'closed' || raw === 'close') return 'Closed';
  return 'Pending Email Verification';
}

function toApiStatus(status: DpdpRequestStatus): string {
  const map: Record<DpdpRequestStatus, string> = {
    'Pending Email Verification': 'pending_verification',
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

function maskPreview(value: unknown): string {
  const raw = cleanText(value);
  if (!raw) return 'Masked preview unavailable';
  if (raw.includes('@')) {
    const [name, domain] = raw.split('@');
    const safeName = name.length <= 2 ? `${name.slice(0, 1)}***` : `${name.slice(0, 2)}***${name.slice(-1)}`;
    const domainParts = domain.split('.');
    const domainName = domainParts[0] || '';
    const domainSuffix = domainParts.slice(1).join('.');
    const safeDomain = domainName.length <= 2 ? `${domainName.slice(0, 1)}***` : `${domainName.slice(0, 2)}***${domainName.slice(-1)}`;
    return domainSuffix ? `${safeName}@${safeDomain}.${domainSuffix}` : `${safeName}@${safeDomain}`;
  }
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (compact.length <= 6) return `${compact.slice(0, 1)}***`;
  return `${compact.slice(0, 3)}***${compact.slice(-3)}`;
}

function normalizeMatchingDataRecommendation(value: unknown): DpdpMatchingDataRecommendation {
  const raw = normalizeKey(value);
  if (!raw) return 'Delete';
  if (raw.includes('anonym')) return 'Anonymize';
  if (raw.includes('manual') || raw.includes('review') || raw.includes('blocked')) return 'Manual Review';
  return 'Delete';
}

function recommendedActionForSource(sourceKey: string, explicit: DpdpMatchingDataRecommendation): DpdpMatchingDataRecommendation {
  if (SAFE_ANONYMIZE_SOURCES.has(sourceKey)) return 'Anonymize';
  if (SAFE_DELETE_SOURCES.has(sourceKey)) return 'Delete';
  if (BLOCKED_QUICK_ACTION_SOURCES.has(sourceKey)) return 'Manual Review';
  return explicit;
}

function matchingGroupMeta(input: unknown): { key: string; label: string } {
  const normalized = normalizeKey(input);
  const mapped = MATCHING_DATA_GROUP_LOOKUP.get(normalized);
  if (mapped) return mapped;
  const cleaned = cleanText(input);
  return {
    key: normalized || 'other',
    label: cleaned || 'Other Data',
  };
}

function toMatchingGroupInput(groupKey: string, label: string, payload: unknown): Record<string, unknown> {
  return {
    key: groupKey,
    label,
    items: payload,
  };
}

function extractMatchingGroupInputs(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
  }

  const source = asObject(payload);
  const nested = source.groups || source.results || source.matches || source.matchingData || source.matching_data || source.data;
  if (Array.isArray(nested)) return extractMatchingGroupInputs(nested);

  const objectPayload = asObject(nested && typeof nested === 'object' ? nested : source);
  const collected = MATCHING_DATA_GROUP_DEFS.flatMap((definition) => {
    const keyMatch = definition.aliases.find((alias) => Object.prototype.hasOwnProperty.call(objectPayload, alias));
    if (!keyMatch) return [];
    return [toMatchingGroupInput(definition.key, definition.label, objectPayload[keyMatch])];
  });

  if (collected.length > 0) return collected;

  return Object.entries(objectPayload)
    .filter(([, value]) => Array.isArray(value) || (value && typeof value === 'object'))
    .map(([key, value]) => {
      const meta = matchingGroupMeta(key);
      return toMatchingGroupInput(meta.key, meta.label, value);
    });
}

function normalizeMatchingDataItem(input: unknown, fallbackGroupKey: string, fallbackGroupLabel: string, index: number): DpdpMatchingDataItem {
  const source = asObject(input);
  const groupMeta = matchingGroupMeta(source.source || source.sourceKey || source.group || source.category || fallbackGroupKey);
  const backendSource = firstText(source.source, source.sourceKey, source.group, source.category) || groupMeta.key;
  const recordId = firstText(source.recordId, source.record_id);
  const blockedReason = firstText(source.blockedReason, source.blocked_reason, source.disabledReason, source.disabled_reason, source.reason);
  const explicitRecommendation = normalizeMatchingDataRecommendation(source.recommendedAction ?? source.recommended_action ?? source.action);
  const sourceBlockedByPolicy = BLOCKED_QUICK_ACTION_SOURCES.has(groupMeta.key);
  const backendBlocked = Boolean(source.blocked ?? source.disabled);
  const quickActionAllowed = SAFE_DELETE_SOURCES.has(groupMeta.key) || SAFE_ANONYMIZE_SOURCES.has(groupMeta.key);
  const missingRecordId = !recordId;
  const blocked = backendBlocked || sourceBlockedByPolicy || !quickActionAllowed || missingRecordId || Boolean(blockedReason);
  const recommendedAction = blocked
    ? 'Manual Review'
    : recommendedActionForSource(groupMeta.key, explicitRecommendation);
  const preview = firstText(
    source.maskedPreview,
    source.masked_preview,
    source.preview,
    source.display,
    source.displayText,
    source.summary,
    source.email,
    source.mobile,
    source.phone,
    source.phoneNumber,
    source.message,
    source.name,
    source.label,
    source.title,
    source.text,
  );

  return {
    recordId,
    source: backendSource,
    sourceKey: groupMeta.key,
    sourceLabel: groupMeta.label || fallbackGroupLabel,
    maskedPreview: maskPreview(preview),
    recommendedAction,
    blocked,
    blockedReason: blocked
      ? (missingRecordId
        ? 'Record ID unavailable. Cannot process quick action.'
        : blockedReason || (sourceBlockedByPolicy || !quickActionAllowed ? BLOCKED_QUICK_ACTION_REASON : ''))
      : '',
    quickActionAllowed: !blocked && quickActionAllowed && !missingRecordId,
  };
}

function normalizeMatchingDataGroup(input: unknown, index: number): DpdpMatchingDataGroup {
  const source = asObject(input);
  const meta = matchingGroupMeta(source.key || source.source || source.sourceKey || source.label || source.title || source.group || source.category);
  const items = extractArray(source.items || source.records || source.matches || source.results || source.entries || source.data, ['items', 'records', 'matches', 'results', 'entries', 'data']);
  return {
    key: meta.key || `group-${index}`,
    label: meta.label || 'Other Data',
    items: items.map((item, itemIndex) => normalizeMatchingDataItem(item, meta.key, meta.label, itemIndex)),
  };
}

function extractMatchingDataGroups(payload: unknown): DpdpMatchingDataGroup[] {
  const groups = extractMatchingGroupInputs(payload).map(normalizeMatchingDataGroup);
  const knownOrder = new Map(MATCHING_DATA_GROUP_DEFS.map((item, index) => [item.key, index] as const));
  return groups.sort((left, right) => {
    const leftIndex = knownOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = knownOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.label.localeCompare(right.label);
  });
}

function normalizeDataActionResult(payload: unknown): DpdpDataActionResult {
  const source = asObject(payload);
  const requestPayload = source.request || source.privacyRequest || source.updatedRequest || source.data;
  return {
    message: firstText(source.message, source.statusMessage, source.result) || 'Action completed successfully.',
    summary: firstText(source.summary, source.actionSummary, source.action_summary, source.note),
    request: requestPayload && typeof requestPayload === 'object' ? normalizePrivacyRequest(requestPayload) : null,
  };
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

function toApiFilterStatus(status: DpdpPrivacyRequestFilter): string {
  if (status === 'All') return 'all';
  return toApiStatus(status);
}

export async function listDpdpPrivacyRequests(status: DpdpPrivacyRequestFilter = 'All'): Promise<DpdpPrivacyRequest[]> {
  const payload = await adminJson<unknown>(`${BASE_PATH}?status=${encodeURIComponent(toApiFilterStatus(status))}`);
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

export async function getDpdpPrivacyRequestMatchingData(id: string): Promise<DpdpMatchingDataGroup[]> {
  const safeId = encodeURIComponent(cleanText(id));
  const payload = await adminJson<unknown>(`${BASE_PATH}/${safeId}/matching-data`);
  return extractMatchingDataGroups(payload);
}

export async function runDpdpPrivacyRequestDataAction(id: string, payload: DpdpDataActionPayload): Promise<DpdpDataActionResult> {
  const safeId = encodeURIComponent(cleanText(id));
  const result = await adminPost<unknown>(`${BASE_PATH}/${safeId}/data-action`, {
    action: payload.action,
    items: payload.items.map((record) => ({
      source: cleanText(record.source),
      recordId: cleanText(record.recordId),
      recommendedAction: record.recommendedAction,
    })),
    adminNote: cleanText(payload.adminNote),
    founderConfirmation: cleanText(payload.founderConfirmation),
  });
  return normalizeDataActionResult(result);
}

export async function completeDpdpPrivacyRequest(id: string, adminNote: string): Promise<DpdpPrivacyRequest> {
  const safeId = encodeURIComponent(cleanText(id));
  const payload = await adminPost<unknown>(`${BASE_PATH}/${safeId}/complete`, {
    adminNote: cleanText(adminNote),
  });
  return normalizePrivacyRequest(extractRecord(payload));
}

export async function resendDpdpPrivacyRequestVerification(id: string): Promise<string> {
  const safeId = encodeURIComponent(cleanText(id));
  const payload = await adminPost<unknown>(`${BASE_PATH}/${safeId}/resend-verification`);
  const source = asObject(payload);
  return firstText(source.message, source.statusMessage, source.result) || 'Verification email resent.';
}

export async function clearDpdpPrivacyTestRequests(): Promise<string> {
  const path = cleanText((import.meta.env.VITE_DPDP_CLEAR_TEST_REQUESTS_PATH || '').toString()) || `${BASE_PATH}/clear-test-requests`;
  const payload = await adminPost<unknown>(path);
  const source = asObject(payload);
  return firstText(source.message, source.statusMessage, source.result) || 'Test privacy requests cleared.';
}
