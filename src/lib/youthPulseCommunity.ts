import { YOUTH_PULSE_TRACK_LABELS, normalizeYouthPulseTrack, type YouthPulseTrack } from '@/lib/youthPulseTracks';

export type DeskWorkflowStatus = 'new' | 'under-review' | 'approved' | 'rejected' | 'published';
export type DeskStatusFilter = 'all' | DeskWorkflowStatus;
export type DeskTrack = 'youth-pulse' | YouthPulseTrack;

export interface ReviewDraft {
  title: string;
  cleanedBody: string;
  summary: string;
  language: 'English' | 'Hindi' | 'Gujarati';
  track: DeskTrack;
  publicLabel: string;
  rejectReason: string;
  editorialNotes: string;
  verificationNotes: string;
  moderationFlags: string[];
}

export interface QueueRecord {
  savedAt?: string;
  status?: DeskWorkflowStatus;
  linkedArticleId?: string;
  linkedArticleStatus?: string;
  draft?: Partial<ReviewDraft>;
}

export interface YouthPulseSubmission {
  id: string;
  title: string;
  originalBody: string;
  submittedBy: string;
  email: string;
  phone: string;
  contact: string;
  college: string;
  track: DeskTrack;
  trackLabel: string;
  city: string;
  state: string;
  locationLabel: string;
  createdAt: string;
  createdLabel: string;
  status: DeskWorkflowStatus;
  statusLabel: string;
  linkedArticleId: string;
  linkedArticleStatus: string;
  published: boolean;
  summary: string;
  language: string;
  sourceLinks: string[];
  attachments: string[];
  firstHand: boolean | null;
  firstHandLabel: string;
  moderationFlags: string[];
  rejectionReason: string;
  raw: Record<string, any>;
}

export interface YouthPulseContributorMeta {
  status?: string;
  internalNotes?: string;
}

export interface YouthPulseContributorDirectoryEntry {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  city: string;
  state: string;
  submissionsCount: number;
  approvedCount: number;
  publishedCount: number;
  lastSubmission: string;
  lastSubmissionLabel: string;
  status: string;
  internalNotes: string;
}

export const DESK_STORAGE_KEY = 'np:youth-pulse-community-queue:v1';
export const CONTRIBUTOR_DIRECTORY_STORAGE_KEY = 'np:youth-pulse-community-directory:v1';

export const STATUS_FILTERS: Array<{ value: DeskStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
];

export const TRACK_FILTERS: Array<{ value: 'all' | DeskTrack; label: string }> = [
  { value: 'all', label: 'All Tracks' },
  { value: 'youth-pulse', label: 'Youth Pulse' },
  { value: 'campus-buzz', label: 'Campus Buzz' },
  { value: 'govt-exam-updates', label: 'Govt Exam Updates' },
  { value: 'career-boosters', label: 'Career Boosters' },
  { value: 'young-achievers', label: 'Young Achievers' },
  { value: 'student-voices', label: 'Student Voices' },
];

export const MODERATION_FLAG_OPTIONS = [
  'Needs fact check',
  'Needs source verification',
  'Sensitive claim',
  'Identity check',
  'Rewrite required',
  'Consent check',
];

export const PUBLIC_LABEL_OPTIONS = [
  'Youth Pulse',
  'Campus Buzz',
  'Govt Exam Updates',
  'Career Boosters',
  'Young Achievers',
  'Student Voices',
];

export const TRACK_LABELS: Record<DeskTrack, string> = {
  'youth-pulse': 'Youth Pulse',
  ...YOUTH_PULSE_TRACK_LABELS,
};

function getPathValue(source: any, path: string) {
  return path.split('.').reduce<any>((acc, part) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[part];
  }, source);
}

function pickString(source: any, paths: string[]) {
  for (const path of paths) {
    const value = getPathValue(source, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  }
  return '';
}

function pickOptionalBoolean(source: any, paths: string[]) {
  for (const path of paths) {
    const value = getPathValue(source, path);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
      if (['false', 'no', 'n', '0'].includes(normalized)) return false;
    }
    if (typeof value === 'number') return value !== 0;
  }
  return null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeFlagLabel(flag: string) {
  return titleCase(flag || '').replace(/\bAi\b/g, 'AI');
}

function extractLinkStrings(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,\s*/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((item) => extractLinkStrings(item));
  if (typeof value === 'object') {
    const candidate = pickString(value, ['url', 'href', 'link', 'publicUrl', 'fileUrl', 'downloadUrl', 'src']);
    if (candidate) return [candidate];
  }
  return [];
}

function pickLinks(source: any, paths: string[]) {
  const links = paths.flatMap((path) => extractLinkStrings(getPathValue(source, path)));
  return Array.from(new Set(links.map((item) => item.trim()).filter(Boolean)));
}

function normalizeLanguage(value: string): ReviewDraft['language'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'gujarati' || normalized === 'gu') return 'Gujarati';
  if (normalized === 'hindi' || normalized === 'hi') return 'Hindi';
  return 'English';
}

export function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function firstHandLabel(value: boolean | null) {
  if (value == null) return 'Not specified';
  return value ? 'Yes' : 'No';
}

export function normalizeDeskTrack(value: string | undefined | null): DeskTrack | '' {
  const normalized = normalizeYouthPulseTrack(value);
  if (normalized) return normalized;
  const slug = slugify(String(value || ''));
  if (['youth-pulse', 'youth', 'education'].includes(slug)) return 'youth-pulse';
  return '';
}

function normalizeTrack(raw: Record<string, any>): DeskTrack {
  const candidates = [
    pickString(raw, ['track', 'trackName', 'subCategory', 'subcategory', 'deskTrack', 'series', 'theme']),
    pickString(raw, ['category', 'categorySlug', 'primaryCategory', 'topic', 'section']),
  ].filter(Boolean);

  for (const value of candidates) {
    const normalized = normalizeDeskTrack(value);
    if (normalized) return normalized;
  }

  return 'youth-pulse';
}

export function isYouthPulseSubmission(raw: Record<string, any>) {
  const candidates = [
    pickString(raw, ['desk', 'deskSlug', 'deskName', 'section', 'sectionSlug', 'vertical', 'verticalSlug']),
    pickString(raw, ['category', 'categorySlug', 'primaryCategory', 'topic']),
    pickString(raw, ['track', 'trackName', 'subCategory', 'subcategory', 'deskTrack']),
  ]
    .map((value) => slugify(value))
    .filter(Boolean);

  return candidates.some((value) => [
    'youth-pulse',
    'youth',
    'education',
    'campus',
    'campus-buzz',
    'govt-exam-updates',
    'career-boosters',
    'young-achievers',
    'student-voices',
  ].includes(value));
}

function normalizeStatus(raw: Record<string, any>): { value: DeskWorkflowStatus; label: string; published: boolean; linkedArticleStatus: string } {
  const statusSlug = slugify(pickString(raw, ['status', 'workflowStatus', 'reviewStatus']));
  const linkedArticleStatus = pickString(raw, ['linkedArticleStatus', 'articleStatus', 'publicationStatus', 'article.status']);
  const linkedStatusSlug = slugify(linkedArticleStatus);
  const published = statusSlug === 'published' || linkedStatusSlug === 'published' || Boolean(getPathValue(raw, 'published')) || Boolean(getPathValue(raw, 'isPublished'));

  if (published) return { value: 'published', label: 'Published', published: true, linkedArticleStatus };
  if (['approved', 'accepted'].includes(statusSlug)) return { value: 'approved', label: 'Approved', published: false, linkedArticleStatus };
  if (['rejected', 'trash', 'withdrawn', 'deleted', 'archived'].includes(statusSlug)) return { value: 'rejected', label: 'Rejected', published: false, linkedArticleStatus };
  if (['under-review', 'under-reviews', 'under_review', 'review', 'in-review', 'in_review'].includes(statusSlug)) {
    return { value: 'under-review', label: 'Under Review', published: false, linkedArticleStatus };
  }
  return { value: 'new', label: 'New', published: false, linkedArticleStatus };
}

export function getStatusLabel(status: DeskWorkflowStatus) {
  return STATUS_FILTERS.find((item) => item.value === status)?.label || titleCase(status);
}

export function normalizeYouthPulseSubmission(raw: Record<string, any>): YouthPulseSubmission | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!isYouthPulseSubmission(raw)) return null;

  const id = pickString(raw, ['id', '_id', 'ID', 'uuid']);
  if (!id) return null;

  const city = pickString(raw, ['city', 'location.city']);
  const state = pickString(raw, ['state', 'location.state']);
  const title = pickString(raw, ['headline', 'title', 'storyTitle']) || 'Untitled submission';
  const originalBody = pickString(raw, ['body', 'content', 'storyBody', 'submission']);
  const status = normalizeStatus(raw);
  const track = normalizeTrack(raw);
  const email = pickString(raw, ['contactEmail', 'email', 'contact.email', 'reporterEmail', 'reporter.email']);
  const phone = pickString(raw, ['contactPhone', 'phone', 'contact.phone', 'reporterPhone', 'reporter.phone', 'whatsapp']);
  const submittedBy = pickString(raw, ['reporterName', 'userName', 'name', 'contactName', 'contact.name', 'reporter.name', 'user.name'])
    || (email.includes('@') ? email.split('@')[0] : 'Unknown contributor');
  const createdAt = pickString(raw, ['createdAt', 'submittedAt', 'updatedAt']);
  const college = pickString(raw, ['college', 'collegeName', 'institution', 'organization', 'education.college', 'school']);
  const firstHand = pickOptionalBoolean(raw, ['firstHand', 'firsthand', 'firstHandAccount', 'isFirstHand', 'metadata.firstHand']);
  const sourceLinks = pickLinks(raw, ['sourceLinks', 'sources', 'references', 'links', 'sourceUrls']);
  const attachments = pickLinks(raw, ['attachments', 'files', 'uploads', 'attachmentLinks']);
  const flagsValue = getPathValue(raw, 'flags');
  const moderationFlags = Array.isArray(flagsValue)
    ? Array.from(new Set(flagsValue.map((item) => normalizeFlagLabel(String(item || '').trim())).filter(Boolean)))
    : [];

  return {
    id,
    title,
    originalBody,
    submittedBy,
    email,
    phone,
    contact: [email, phone].filter(Boolean).join(' / ') || '—',
    college,
    track,
    trackLabel: TRACK_LABELS[track],
    city,
    state,
    locationLabel: [city, state].filter(Boolean).join(', ') || '—',
    createdAt,
    createdLabel: formatDate(createdAt),
    status: status.value,
    statusLabel: status.label,
    linkedArticleId: pickString(raw, ['linkedArticleId', 'articleId', 'article._id']),
    linkedArticleStatus: status.linkedArticleStatus,
    published: status.published,
    summary: pickString(raw, ['summary', 'excerpt']),
    language: pickString(raw, ['language', 'lang']) || 'English',
    sourceLinks,
    attachments,
    firstHand,
    firstHandLabel: firstHandLabel(firstHand),
    moderationFlags,
    rejectionReason: pickString(raw, ['rejectReason', 'rejectionReason']),
    raw,
  };
}

export function defaultPublicLabel(track: DeskTrack) {
  return TRACK_LABELS[track] || 'Youth Pulse';
}

export function buildReviewDraftFromSubmission(submission: YouthPulseSubmission, queueRecord?: QueueRecord): ReviewDraft {
  const base: ReviewDraft = {
    title: pickString(submission.raw, ['aiHeadline', 'aiTitle']) || submission.title,
    cleanedBody: pickString(submission.raw, ['aiBody', 'aiText']) || submission.originalBody,
    summary: submission.summary,
    language: normalizeLanguage(submission.language),
    track: submission.track,
    publicLabel: defaultPublicLabel(submission.track),
    rejectReason: submission.rejectionReason,
    editorialNotes: pickString(submission.raw, ['editorialNotes', 'deskNotes']),
    verificationNotes: pickString(submission.raw, ['verificationNotes', 'factCheckNotes']),
    moderationFlags: submission.moderationFlags,
  };

  return {
    ...base,
    ...(queueRecord?.draft || {}),
    track: normalizeDeskTrack(String(queueRecord?.draft?.track || base.track)) || base.track,
    moderationFlags: Array.isArray(queueRecord?.draft?.moderationFlags) ? queueRecord?.draft?.moderationFlags || [] : base.moderationFlags,
    publicLabel: String(queueRecord?.draft?.publicLabel || base.publicLabel || '').trim() || defaultPublicLabel(base.track),
  };
}

export function applyQueueRecordToSubmission(submission: YouthPulseSubmission, queueRecord?: QueueRecord) {
  if (!queueRecord) return submission;
  const nextTrack = normalizeDeskTrack(String(queueRecord.draft?.track || submission.track)) || submission.track;
  const nextStatus = queueRecord.status || submission.status;

  return {
    ...submission,
    track: nextTrack,
    trackLabel: TRACK_LABELS[nextTrack],
    status: nextStatus,
    statusLabel: getStatusLabel(nextStatus),
    linkedArticleId: queueRecord.linkedArticleId || submission.linkedArticleId,
    linkedArticleStatus: queueRecord.linkedArticleStatus || submission.linkedArticleStatus,
    published: nextStatus === 'published' || submission.published,
    rejectionReason: typeof queueRecord.draft?.rejectReason === 'string' && queueRecord.draft.rejectReason.trim()
      ? queueRecord.draft.rejectReason.trim()
      : submission.rejectionReason,
    moderationFlags: Array.isArray(queueRecord.draft?.moderationFlags) && queueRecord.draft.moderationFlags.length > 0
      ? queueRecord.draft.moderationFlags
      : submission.moderationFlags,
  };
}

export function extractArticleId(payload: any) {
  return pickString(payload, ['draftArticle._id', 'article._id', 'submission.linkedArticleId', 'linkedArticleId', '_id', 'id']);
}

export function getLinkedArticleStatusLabel(submission: YouthPulseSubmission) {
  if (submission.linkedArticleStatus.trim()) return titleCase(submission.linkedArticleStatus);
  if (submission.linkedArticleId) return submission.published ? 'Published' : 'Draft Linked';
  return 'Not Created';
}

export function buildDecisionTrackPayload(track: DeskTrack) {
  if (track === 'youth-pulse') return {};
  return {
    track,
    trackName: TRACK_LABELS[track],
    subCategory: track,
    subcategory: track,
  };
}

export function buildYouthDraftPayload(submission: YouthPulseSubmission, draft: ReviewDraft) {
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim() || undefined,
    description: draft.summary.trim() || undefined,
    content: draft.cleanedBody.trim(),
    category: 'youth-pulse',
    language: draft.language.toLowerCase().slice(0, 2),
    city: submission.city || undefined,
    state: submission.state || undefined,
    source: 'youth-pulse-community',
    origin: 'youth-pulse-community',
    submittedBy: 'Youth Pulse Community',
    isCommunity: true,
    tags: Array.from(new Set([
      'Youth Pulse Community',
      'Youth Pulse',
      draft.track !== 'youth-pulse' ? TRACK_LABELS[draft.track] : '',
      draft.publicLabel,
    ].filter(Boolean))),
    publicLabel: draft.publicLabel.trim() || undefined,
    label: draft.publicLabel.trim() || undefined,
    location: {
      city: submission.city || undefined,
      state: submission.state || undefined,
    },
    metadata: {
      sourceLabel: 'Youth Pulse Community',
      youthPulseCommunity: true,
      youthPulseTrack: draft.track,
      youthPulseTrackLabel: TRACK_LABELS[draft.track],
      youthPulsePublicLabel: draft.publicLabel.trim() || undefined,
      linkedSubmissionId: submission.id,
      contributor: {
        name: submission.submittedBy,
        email: submission.email || undefined,
        phone: submission.phone || undefined,
        college: submission.college || undefined,
        city: submission.city || undefined,
        state: submission.state || undefined,
      },
      sourceLinks: submission.sourceLinks,
      attachments: submission.attachments,
      firstHand: submission.firstHand,
      moderation: {
        flags: draft.moderationFlags,
        editorialNotes: draft.editorialNotes.trim() || undefined,
        verificationNotes: draft.verificationNotes.trim() || undefined,
        rejectionReason: draft.rejectReason.trim() || undefined,
      },
    },
    ...buildDecisionTrackPayload(draft.track),
  };
}

export function buildYouthDecisionPayload(submission: YouthPulseSubmission, draft: ReviewDraft, decision: 'approve' | 'reject') {
  return {
    decision,
    aiHeadline: draft.title.trim() || undefined,
    aiBody: draft.cleanedBody.trim() || undefined,
    publicLabel: draft.publicLabel.trim() || undefined,
    moderationFlags: draft.moderationFlags,
    editorialNotes: draft.editorialNotes.trim() || undefined,
    verificationNotes: draft.verificationNotes.trim() || undefined,
    rejectReason: decision === 'reject' ? draft.rejectReason.trim() : undefined,
    sourceLabel: 'Youth Pulse Community',
    youthPulseCommunity: true,
    contributorType: 'youth-pulse-community',
    contributor: {
      name: submission.submittedBy,
      email: submission.email || undefined,
      phone: submission.phone || undefined,
      college: submission.college || undefined,
      city: submission.city || undefined,
      state: submission.state || undefined,
    },
    ...buildDecisionTrackPayload(draft.track),
  };
}

function buildContributorKey(submission: YouthPulseSubmission) {
  if (submission.email) return `email:${submission.email.trim().toLowerCase()}`;
  if (submission.phone) return `phone:${submission.phone.replace(/\D/g, '')}`;
  return `name:${[submission.submittedBy, submission.college, submission.city, submission.state].join('|').toLowerCase()}`;
}

export function buildYouthContributorDirectory(
  submissions: YouthPulseSubmission[],
  meta: Record<string, YouthPulseContributorMeta> = {},
): YouthPulseContributorDirectoryEntry[] {
  const map = new Map<string, YouthPulseContributorDirectoryEntry>();

  submissions.forEach((submission) => {
    const key = buildContributorKey(submission);
    const existing = map.get(key);
    const currentTimestamp = new Date(submission.createdAt || 0).getTime();
    const existingTimestamp = existing ? new Date(existing.lastSubmission || 0).getTime() : 0;
    const contributionMeta = meta[key] || {};
    const approvedIncrement = submission.status === 'approved' || submission.status === 'published' ? 1 : 0;
    const publishedIncrement = submission.status === 'published' || submission.linkedArticleStatus.trim().toLowerCase() === 'published' ? 1 : 0;

    if (!existing) {
      map.set(key, {
        id: key,
        fullName: submission.submittedBy,
        email: submission.email || '—',
        mobile: submission.phone || '—',
        college: submission.college || '—',
        city: submission.city || '—',
        state: submission.state || '—',
        submissionsCount: 1,
        approvedCount: approvedIncrement,
        publishedCount: publishedIncrement,
        lastSubmission: submission.createdAt,
        lastSubmissionLabel: submission.createdLabel,
        status: contributionMeta.status || 'active',
        internalNotes: contributionMeta.internalNotes || '',
      });
      return;
    }

    existing.submissionsCount += 1;
    existing.approvedCount += approvedIncrement;
    existing.publishedCount += publishedIncrement;
    if (currentTimestamp > existingTimestamp) {
      existing.lastSubmission = submission.createdAt;
      existing.lastSubmissionLabel = submission.createdLabel;
      existing.fullName = submission.submittedBy || existing.fullName;
      existing.email = submission.email || existing.email;
      existing.mobile = submission.phone || existing.mobile;
      existing.college = submission.college || existing.college;
      existing.city = submission.city || existing.city;
      existing.state = submission.state || existing.state;
    }
    existing.status = contributionMeta.status || existing.status;
    existing.internalNotes = contributionMeta.internalNotes || existing.internalNotes;
  });

  return Array.from(map.values()).sort((left, right) => {
    const rightTime = new Date(right.lastSubmission || 0).getTime();
    const leftTime = new Date(left.lastSubmission || 0).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime;
    return left.fullName.localeCompare(right.fullName);
  });
}