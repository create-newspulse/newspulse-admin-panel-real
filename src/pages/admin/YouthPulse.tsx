import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiToolsPanel, { type AiToolResult, type AiToolsPanelLanguage } from '../../components/SafeZone/AiToolsPanel';
import { fetchCommunitySubmissionById, fetchCommunitySubmissions } from '@/api/adminCommunityReporterApi';
import { adminApi } from '@/lib/adminApi';
import { createArticle, publishArticle, updateArticle } from '@/lib/api/articles';
import { useNotify } from '@/components/ui/toast-bridge';
import { normalizeError } from '@/lib/error';
import { YOUTH_PULSE_TRACK_LABELS, YOUTH_PULSE_TRACK_OPTIONS, normalizeYouthPulseTrack, type YouthPulseTrack } from '@/lib/youthPulseTracks';

type DeskWorkflowStatus = 'new' | 'under-review' | 'approved' | 'rejected' | 'published';
type DeskStatusFilter = 'all' | DeskWorkflowStatus;
type DeskTrack = 'youth-pulse' | YouthPulseTrack;
type TrackFilter = 'all' | DeskTrack;
type ReviewFieldTarget = 'title' | 'summary' | 'cleanedBody' | 'editorialNotes' | 'verificationNotes';

type RawSubmission = Record<string, any>;

interface ReviewDraft {
  title: string;
  cleanedBody: string;
  summary: string;
  language: AiToolsPanelLanguage;
  track: DeskTrack;
  publicLabel: string;
  rejectReason: string;
  editorialNotes: string;
  verificationNotes: string;
  moderationFlags: string[];
}

interface StoredDeskRecord {
  savedAt?: string;
  status?: DeskWorkflowStatus;
  linkedArticleId?: string;
  linkedArticleStatus?: string;
  draft?: Partial<ReviewDraft>;
}

interface YouthPulseSubmission {
  id: string;
  title: string;
  originalBody: string;
  submittedBy: string;
  email: string;
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
  raw: RawSubmission;
}

const DESK_STORAGE_KEY = 'np:youth-pulse-desk:v1';

const STATUS_FILTERS: Array<{ value: DeskStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
];

const TRACK_FILTERS: Array<{ value: TrackFilter; label: string }> = [
  { value: 'all', label: 'All Tracks' },
  { value: 'youth-pulse', label: 'Youth Pulse' },
  ...YOUTH_PULSE_TRACK_OPTIONS,
];

const TRACK_LABELS: Record<DeskTrack, string> = {
  'youth-pulse': 'Youth Pulse',
  ...YOUTH_PULSE_TRACK_LABELS,
};

const PUBLIC_LABEL_OPTIONS = [
  'Youth Pulse',
  'Campus Buzz',
  'Govt Exam Updates',
  'Career Boosters',
  'Young Achievers',
  'Student Voices',
  'Student Update',
  'Campus Alert',
  'Career Watch',
];

const MODERATION_FLAG_OPTIONS = [
  'Needs fact check',
  'Needs source verification',
  'Sensitive claim',
  'Identity check',
  'Rewrite required',
  'Consent check',
];

const AI_APPLY_ACTIONS: Partial<Record<AiToolResult['tool'], Array<{ label: string; target: ReviewFieldTarget }>>> = {
  summarize: [
    { label: 'Use in Cleaned Summary', target: 'summary' },
    { label: 'Add to Editorial Notes', target: 'editorialNotes' },
  ],
  translate: [{ label: 'Use in Cleaned Body', target: 'cleanedBody' }],
  'fact-check': [{ label: 'Add to Verification Notes', target: 'verificationNotes' }],
  headline: [{ label: 'Use as Cleaned Headline', target: 'title' }],
  'seo-meta': [{ label: 'Use in Cleaned Summary', target: 'summary' }],
  'voice-script': [{ label: 'Add to Editorial Notes', target: 'editorialNotes' }],
  'inverted-pyramid': [{ label: 'Use in Cleaned Body', target: 'cleanedBody' }],
  '5w1h': [{ label: 'Add to Verification Notes', target: 'verificationNotes' }],
  topband: [{ label: 'Add to Editorial Notes', target: 'editorialNotes' }],
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

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeLanguage(value: string): AiToolsPanelLanguage {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'gujarati' || normalized === 'gu') return 'Gujarati';
  if (normalized === 'hindi' || normalized === 'hi') return 'Hindi';
  return 'English';
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function normalizeDeskTrack(value: string | undefined | null): DeskTrack | '' {
  const normalized = normalizeYouthPulseTrack(value);
  if (normalized) return normalized;
  const slug = slugify(String(value || ''));
  if (['youth-pulse', 'youth', 'education'].includes(slug)) return 'youth-pulse';
  return '';
}

function normalizeTrack(raw: RawSubmission): DeskTrack {
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

function isYouthPulseSubmission(raw: RawSubmission) {
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

function normalizeStatus(raw: RawSubmission): { value: DeskWorkflowStatus; label: string; published: boolean; linkedArticleStatus: string } {
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

function extractLinkStrings(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,\s*/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractLinkStrings(item));
  }
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

function normalizeFlagLabel(flag: string) {
  return titleCase(flag || '').replace(/\bAi\b/g, 'AI');
}

function firstHandLabel(value: boolean | null) {
  if (value == null) return 'Not specified';
  return value ? 'Yes' : 'No';
}

function getStatusLabel(status: DeskWorkflowStatus) {
  return STATUS_FILTERS.find((item) => item.value === status)?.label || titleCase(status);
}

function readStoredDeskRecords(): Record<string, StoredDeskRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DESK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function defaultPublicLabel(track: DeskTrack) {
  return TRACK_LABELS[track] || 'Youth Pulse';
}

function normalizeSubmission(raw: RawSubmission): YouthPulseSubmission | null {
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

function applyDeskRecordToSubmission(submission: YouthPulseSubmission, deskRecord?: StoredDeskRecord) {
  if (!deskRecord) return submission;
  const nextTrack = normalizeDeskTrack(String(deskRecord.draft?.track || submission.track)) || submission.track;
  const nextStatus = deskRecord.status || submission.status;

  return {
    ...submission,
    track: nextTrack,
    trackLabel: TRACK_LABELS[nextTrack],
    status: nextStatus,
    statusLabel: getStatusLabel(nextStatus),
    linkedArticleId: deskRecord.linkedArticleId || submission.linkedArticleId,
    linkedArticleStatus: deskRecord.linkedArticleStatus || submission.linkedArticleStatus,
    published: nextStatus === 'published' || submission.published,
    rejectionReason: typeof deskRecord.draft?.rejectReason === 'string' && deskRecord.draft.rejectReason.trim()
      ? deskRecord.draft.rejectReason.trim()
      : submission.rejectionReason,
    moderationFlags: Array.isArray(deskRecord.draft?.moderationFlags) && deskRecord.draft.moderationFlags.length > 0
      ? deskRecord.draft.moderationFlags
      : submission.moderationFlags,
  };
}

function buildDraftFromSubmission(submission: YouthPulseSubmission, deskRecord?: StoredDeskRecord): ReviewDraft {
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
    ...(deskRecord?.draft || {}),
    track: normalizeDeskTrack(String(deskRecord?.draft?.track || base.track)) || base.track,
    moderationFlags: Array.isArray(deskRecord?.draft?.moderationFlags) ? deskRecord?.draft?.moderationFlags || [] : base.moderationFlags,
    publicLabel: String(deskRecord?.draft?.publicLabel || base.publicLabel || '').trim() || defaultPublicLabel(base.track),
  };
}

function extractArticleId(payload: any) {
  return pickString(payload, ['draftArticle._id', 'article._id', 'submission.linkedArticleId', 'linkedArticleId', '_id', 'id']);
}

function statusClasses(status: DeskWorkflowStatus) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'approved') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (status === 'under-review') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-sky-100 text-sky-700 border-sky-200';
}

function linkedArticleStatusClasses(status: string, hasArticle: boolean) {
  const slug = slugify(status);
  if (slug === 'published') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (slug === 'draft' || slug === 'linked' || hasArticle) return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-white text-slate-500 border-slate-200';
}

function getLinkedArticleStatusLabel(submission: YouthPulseSubmission) {
  if (submission.linkedArticleStatus.trim()) return titleCase(submission.linkedArticleStatus);
  if (submission.linkedArticleId) return submission.published ? 'Published' : 'Draft Linked';
  return 'Not Created';
}

function buildDecisionTrackPayload(track: DeskTrack) {
  if (track === 'youth-pulse') return {};
  return {
    track,
    trackName: TRACK_LABELS[track],
    subCategory: track,
    subcategory: track,
  };
}

function appendNote(base: string, addition: string) {
  const next = addition.trim();
  if (!next) return base;
  return [base.trim(), next].filter(Boolean).join('\n\n');
}

function firstMeaningfulLine(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

const YouthPulsePage: React.FC = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState<YouthPulseSubmission[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<YouthPulseSubmission | null>(null);
  const [statusFilter, setStatusFilter] = useState<DeskStatusFilter>('new');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [aiOutputsById, setAiOutputsById] = useState<Record<string, AiToolResult[]>>({});
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [deskRecords, setDeskRecords] = useState<Record<string, StoredDeskRecord>>(() => readStoredDeskRecords());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DESK_STORAGE_KEY, JSON.stringify(deskRecords));
    } catch {
      // Ignore local persistence errors.
    }
  }, [deskRecords]);

  const selectedFromList = useMemo(
    () => submissions.find((item) => item.id === selectedId) || null,
    [selectedId, submissions]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        let records = await fetchCommunitySubmissions({ status: 'all', page: 1, limit: 300 });
        if (!Array.isArray(records) || records.length === 0) {
          records = await fetchCommunitySubmissions({ page: 1, limit: 300 });
        }

        const normalized = records
          .map((item) => normalizeSubmission(item as RawSubmission))
          .filter((item): item is YouthPulseSubmission => Boolean(item))
          .map((item) => applyDeskRecordToSubmission(item, deskRecords[item.id]))
          .sort((left, right) => {
            const leftTime = new Date(left.createdAt || 0).getTime();
            const rightTime = new Date(right.createdAt || 0).getTime();
            return rightTime - leftTime;
          });

        if (cancelled) return;

        setSubmissions(normalized);
        setSelectedId((current) => {
          if (current && normalized.some((item) => item.id === current)) return current;
          return normalized[0]?.id || '';
        });
      } catch (err: any) {
        if (cancelled) return;
        const normalized = normalizeError(err, 'Failed to load Youth Pulse submissions.');
        setError(normalized.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [deskRecords, refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedSubmission(null);
      return;
    }
    if (selectedFromList) setSelectedSubmission(selectedFromList);
  }, [selectedFromList, selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubmission() {
      if (!selectedId) return;

      setSubmissionLoading(true);
      try {
        const record = await fetchCommunitySubmissionById(selectedId);
        const normalized = normalizeSubmission(record as RawSubmission);
        if (cancelled || !normalized) return;
        const nextSubmission = applyDeskRecordToSubmission(normalized, deskRecords[normalized.id]);
        setSelectedSubmission(nextSubmission);
        setSubmissions((current) => current.map((item) => (item.id === nextSubmission.id ? nextSubmission : item)));
      } catch {
        // Keep the list-backed selection if detail fetch fails.
      } finally {
        if (!cancelled) setSubmissionLoading(false);
      }
    }

    void loadSubmission();
    return () => {
      cancelled = true;
    };
  }, [deskRecords, refreshKey, selectedId]);

  useEffect(() => {
    if (!selectedSubmission) return;
    setReviewDrafts((current) => {
      if (current[selectedSubmission.id]) return current;
      return {
        ...current,
        [selectedSubmission.id]: buildDraftFromSubmission(selectedSubmission, deskRecords[selectedSubmission.id]),
      };
    });
  }, [deskRecords, selectedSubmission]);

  const filteredSubmissions = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return submissions.filter((submission) => {
      if (statusFilter !== 'all' && submission.status !== statusFilter) return false;
      if (trackFilter !== 'all' && submission.track !== trackFilter) return false;
      if (!search) return true;

      const haystack = [
        submission.title,
        submission.submittedBy,
        submission.email,
        submission.contact,
        submission.trackLabel,
        submission.city,
        submission.state,
        submission.college,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [searchQuery, statusFilter, submissions, trackFilter]);

  const selectedDraft = selectedId ? reviewDrafts[selectedId] : undefined;
  const selectedDeskRecord = selectedId ? deskRecords[selectedId] : undefined;
  const aiOutputs = selectedId ? aiOutputsById[selectedId] || [] : [];

  const stats = useMemo(() => {
    const counts: Record<DeskStatusFilter, number> = {
      all: submissions.length,
      new: 0,
      'under-review': 0,
      approved: 0,
      rejected: 0,
      published: 0,
    };

    submissions.forEach((submission) => {
      counts[submission.status] += 1;
    });

    return counts;
  }, [submissions]);

  function patchDraft(update: Partial<ReviewDraft>) {
    if (!selectedId || !selectedDraft) return;
    setReviewDrafts((current) => ({
      ...current,
      [selectedId]: {
        ...current[selectedId],
        ...update,
      },
    }));
  }

  function updateDeskRecord(id: string, updater: (current: StoredDeskRecord | undefined) => StoredDeskRecord) {
    setDeskRecords((current) => ({
      ...current,
      [id]: updater(current[id]),
    }));
  }

  function updateSubmissionState(id: string, update: Partial<YouthPulseSubmission>) {
    setSubmissions((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
    setSelectedSubmission((current) => (current && current.id === id ? { ...current, ...update } : current));
  }

  function saveDeskDraft(nextStatus?: DeskWorkflowStatus, extra?: Partial<StoredDeskRecord>) {
    if (!selectedId || !selectedDraft || !selectedSubmission) return;
    const status = nextStatus || selectedSubmission.status;
    updateDeskRecord(selectedId, (current) => ({
      ...current,
      ...extra,
      status,
      linkedArticleId: extra?.linkedArticleId || current?.linkedArticleId || selectedSubmission.linkedArticleId || '',
      linkedArticleStatus: extra?.linkedArticleStatus || current?.linkedArticleStatus || selectedSubmission.linkedArticleStatus || '',
      savedAt: new Date().toISOString(),
      draft: selectedDraft,
    }));
  }

  function handleTrackChange(nextTrack: DeskTrack) {
    if (!selectedId || !selectedSubmission || !selectedDraft) return;
    const currentDefaultLabel = defaultPublicLabel(selectedDraft.track);
    const nextDefaultLabel = defaultPublicLabel(nextTrack);
    patchDraft({
      track: nextTrack,
      publicLabel: selectedDraft.publicLabel === currentDefaultLabel ? nextDefaultLabel : selectedDraft.publicLabel,
    });
    updateSubmissionState(selectedId, {
      track: nextTrack,
      trackLabel: TRACK_LABELS[nextTrack],
    });
  }

  function toggleModerationFlag(flag: string) {
    if (!selectedDraft) return;
    const hasFlag = selectedDraft.moderationFlags.includes(flag);
    patchDraft({
      moderationFlags: hasFlag
        ? selectedDraft.moderationFlags.filter((item) => item !== flag)
        : [...selectedDraft.moderationFlags, flag],
    });
  }

  function handleSaveCleanedVersion() {
    if (!selectedId || !selectedDraft) return;
    saveDeskDraft();
    notify.ok('Cleaned version saved', 'Review edits are saved inside the Youth Pulse desk.');
  }

  function handleMoveToUnderReview() {
    if (!selectedSubmission || !selectedDraft) return;
    saveDeskDraft('under-review');
    updateSubmissionState(selectedSubmission.id, {
      status: 'under-review',
      statusLabel: 'Under Review',
      track: selectedDraft.track,
      trackLabel: TRACK_LABELS[selectedDraft.track],
    });
    notify.ok('Moved to Under Review');
  }

  async function handleDecision(decision: 'approve' | 'reject') {
    if (!selectedSubmission || !selectedDraft) return;
    if (decision === 'reject' && !selectedDraft.rejectReason.trim()) {
      notify.err('Reject reason required', 'Add a short reason before rejecting the submission.');
      return;
    }

    setActionLoading(decision);
    try {
      const res = await adminApi.post(`/community-reporter/submissions/${encodeURIComponent(selectedSubmission.id)}/decision`, {
        decision,
        aiHeadline: selectedDraft.title.trim() || undefined,
        aiBody: selectedDraft.cleanedBody.trim() || undefined,
        ...buildDecisionTrackPayload(selectedDraft.track),
        publicLabel: selectedDraft.publicLabel.trim() || undefined,
        moderationFlags: selectedDraft.moderationFlags,
        editorialNotes: selectedDraft.editorialNotes.trim() || undefined,
        verificationNotes: selectedDraft.verificationNotes.trim() || undefined,
        rejectReason: decision === 'reject' ? selectedDraft.rejectReason.trim() : undefined,
      });

      const articleId = extractArticleId(res.data);
      const nextStatus: DeskWorkflowStatus = decision === 'approve' ? 'approved' : 'rejected';
      const nextLinkedStatus = articleId
        ? selectedSubmission.linkedArticleStatus || 'draft'
        : selectedSubmission.linkedArticleStatus;

      updateSubmissionState(selectedSubmission.id, {
        status: nextStatus,
        statusLabel: getStatusLabel(nextStatus),
        linkedArticleId: articleId || selectedSubmission.linkedArticleId,
        linkedArticleStatus: nextLinkedStatus,
        track: selectedDraft.track,
        trackLabel: TRACK_LABELS[selectedDraft.track],
        rejectionReason: decision === 'reject' ? selectedDraft.rejectReason.trim() : selectedSubmission.rejectionReason,
      });

      saveDeskDraft(nextStatus, {
        linkedArticleId: articleId || selectedSubmission.linkedArticleId,
        linkedArticleStatus: nextLinkedStatus,
      });

      notify.ok(decision === 'approve' ? 'Submission approved' : 'Submission rejected');
    } catch (err: any) {
      const normalized = normalizeError(err, `Failed to ${decision} submission.`);
      notify.err('Action failed', normalized.message);
    } finally {
      setActionLoading('');
    }
  }

  async function handlePublish() {
    if (!selectedSubmission || !selectedDraft) return;
    if (!selectedDraft.title.trim() || !selectedDraft.cleanedBody.trim()) {
      notify.err('Missing content', 'Add a cleaned headline and cleaned body before publishing.');
      return;
    }

    setActionLoading('publish');
    try {
      const articlePayload: Record<string, any> = {
        title: selectedDraft.title.trim(),
        summary: selectedDraft.summary.trim() || undefined,
        description: selectedDraft.summary.trim() || undefined,
        content: selectedDraft.cleanedBody.trim(),
        category: 'youth-pulse',
        language: selectedDraft.language.toLowerCase().slice(0, 2),
        city: selectedSubmission.city || undefined,
        state: selectedSubmission.state || undefined,
        source: 'youth-pulse-desk',
        origin: 'youth-pulse-submission',
        submittedBy: selectedSubmission.submittedBy,
        tags: Array.from(new Set([
          'Youth Pulse',
          selectedDraft.track !== 'youth-pulse' ? TRACK_LABELS[selectedDraft.track] : '',
          selectedDraft.publicLabel,
        ].filter(Boolean))),
        publicLabel: selectedDraft.publicLabel.trim() || undefined,
        label: selectedDraft.publicLabel.trim() || undefined,
        location: {
          city: selectedSubmission.city || undefined,
          state: selectedSubmission.state || undefined,
        },
        metadata: {
          youthPulseDesk: true,
          youthPulseTrack: selectedDraft.track,
          youthPulseTrackLabel: TRACK_LABELS[selectedDraft.track],
          youthPulsePublicLabel: selectedDraft.publicLabel.trim() || undefined,
          contributor: {
            name: selectedSubmission.submittedBy,
            email: selectedSubmission.email || undefined,
            contact: selectedSubmission.contact || undefined,
            college: selectedSubmission.college || undefined,
            city: selectedSubmission.city || undefined,
            state: selectedSubmission.state || undefined,
          },
          sourceLinks: selectedSubmission.sourceLinks,
          attachments: selectedSubmission.attachments,
          firstHand: selectedSubmission.firstHand,
          moderation: {
            flags: selectedDraft.moderationFlags,
            editorialNotes: selectedDraft.editorialNotes.trim() || undefined,
            verificationNotes: selectedDraft.verificationNotes.trim() || undefined,
            rejectionReason: selectedDraft.rejectReason.trim() || undefined,
          },
        },
        ...buildDecisionTrackPayload(selectedDraft.track),
      };

      let articleId = selectedSubmission.linkedArticleId;

      if (!articleId) {
        const approveRes = await adminApi.post(`/community-reporter/submissions/${encodeURIComponent(selectedSubmission.id)}/decision`, {
          decision: 'approve',
          aiHeadline: selectedDraft.title.trim(),
          aiBody: selectedDraft.cleanedBody.trim(),
          ...buildDecisionTrackPayload(selectedDraft.track),
          publicLabel: selectedDraft.publicLabel.trim() || undefined,
          moderationFlags: selectedDraft.moderationFlags,
          editorialNotes: selectedDraft.editorialNotes.trim() || undefined,
          verificationNotes: selectedDraft.verificationNotes.trim() || undefined,
        });
        articleId = extractArticleId(approveRes.data);
      }

      if (articleId) {
        await updateArticle(articleId, { ...articlePayload, status: 'draft' });
        await publishArticle(articleId, undefined, articlePayload);
      } else {
        const created = await createArticle({ ...articlePayload, status: 'draft' });
        articleId = extractArticleId(created);
        if (!articleId) throw new Error('Article created without an id');
        await publishArticle(articleId, undefined, articlePayload);
      }

      updateSubmissionState(selectedSubmission.id, {
        status: 'published',
        statusLabel: 'Published',
        linkedArticleId: articleId,
        linkedArticleStatus: 'published',
        published: true,
        track: selectedDraft.track,
        trackLabel: TRACK_LABELS[selectedDraft.track],
      });

      saveDeskDraft('published', {
        linkedArticleId: articleId,
        linkedArticleStatus: 'published',
      });

      notify.ok('Story published', 'Youth Pulse story was sent to the normal NewsPulse article pipeline.');
    } catch (err: any) {
      const normalized = normalizeError(err, 'Failed to publish Youth Pulse story.');
      notify.err('Publish failed', normalized.message);
    } finally {
      setActionLoading('');
    }
  }

  function handleOpenLinkedArticle(articleId?: string) {
    const safeId = String(articleId || selectedSubmission?.linkedArticleId || '').trim();
    if (!safeId) return;
    navigate(`/admin/articles/${encodeURIComponent(safeId)}/edit`);
  }

  function handleAiToolResult(result: AiToolResult) {
    if (!selectedId) return;
    setAiOutputsById((current) => ({
      ...current,
      [selectedId]: [result, ...(current[selectedId] || [])],
    }));
  }

  function applyAiOutput(result: AiToolResult, target: ReviewFieldTarget) {
    if (!selectedDraft) return;
    const output = result.output.trim();
    if (!output) return;

    if (target === 'title') {
      patchDraft({ title: firstMeaningfulLine(output) || selectedDraft.title });
    } else if (target === 'summary') {
      patchDraft({ summary: output });
    } else if (target === 'cleanedBody') {
      patchDraft({ cleanedBody: output });
    } else if (target === 'editorialNotes') {
      patchDraft({ editorialNotes: appendNote(selectedDraft.editorialNotes, output) });
    } else if (target === 'verificationNotes') {
      patchDraft({ verificationNotes: appendNote(selectedDraft.verificationNotes, output) });
    }

    notify.ok('AI output applied', `${result.label} was copied into the review panel.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Youth Pulse Submission Desk</h1>
          <p className="text-sm text-slate-600">
            Review submissions, inspect contributor details, clean the story, approve or reject it, then publish approved work into the normal NewsPulse article pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh Desk
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {STATUS_FILTERS.filter((item) => item.value !== 'all').map((item) => (
          <div key={item.value} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{stats[item.value]}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value)}
                className={`rounded-full border px-3 py-1.5 text-sm ${statusFilter === item.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {TRACK_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTrackFilter(item.value)}
                className={`rounded-full border px-3 py-1.5 text-sm ${trackFilter === item.value ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search title, contributor, contact, college, city or state"
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm lg:max-w-md"
          />
          <div className="text-sm text-slate-500">{filteredSubmissions.length} submissions in the desk</div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Title</th>
                <th className="px-3 py-3">Submitted By</th>
                <th className="px-3 py-3">Email / Contact</th>
                <th className="px-3 py-3">Track / Category</th>
                <th className="px-3 py-3">City / State</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Linked Article</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">Loading Youth Pulse submissions…</td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">No Youth Pulse submissions matched the current filters.</td>
                </tr>
              ) : (
                filteredSubmissions.map((submission) => (
                  <tr
                    key={submission.id}
                    onClick={() => setSelectedId(submission.id)}
                    className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${selectedId === submission.id ? 'bg-slate-50' : 'bg-white'}`}
                  >
                    <td className="px-3 py-3 align-top">
                      <div className="max-w-[280px] font-medium text-slate-900">{submission.title}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div>{submission.submittedBy}</div>
                      {submission.college ? <div className="mt-1 text-xs text-slate-500">{submission.college}</div> : null}
                    </td>
                    <td className="px-3 py-3 align-top">{submission.contact}</td>
                    <td className="px-3 py-3 align-top">{submission.trackLabel}</td>
                    <td className="px-3 py-3 align-top">{submission.locationLabel}</td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">{submission.createdLabel}</td>
                    <td className="px-3 py-3 align-top">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(submission.status)}`}>
                        {submission.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-max rounded-full border px-2.5 py-1 text-xs font-medium ${linkedArticleStatusClasses(submission.linkedArticleStatus, Boolean(submission.linkedArticleId))}`}>
                          {getLinkedArticleStatusLabel(submission)}
                        </span>
                        <span className="text-xs text-slate-500">{submission.linkedArticleId || '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(submission.id);
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Review
                        </button>
                        {submission.linkedArticleId ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenLinkedArticle(submission.linkedArticleId);
                            }}
                            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            Open Linked Article
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review Panel</h2>
              <p className="text-sm text-slate-500">Open a submission to inspect the original material, prepare a cleaned version, moderate it, and publish it into NewsPulse when it is ready.</p>
            </div>
            {selectedSubmission ? (
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(selectedSubmission.status)}`}>
                  {selectedSubmission.statusLabel}
                </span>
                <span className="text-xs text-slate-400">
                  {selectedDeskRecord?.savedAt ? `Saved ${formatDate(selectedDeskRecord.savedAt)}` : 'Not saved yet'}
                </span>
              </div>
            ) : null}
          </div>

          {!selectedSubmission || !selectedDraft ? (
            <div className="py-12 text-center text-sm text-slate-500">Select a Youth Pulse submission to start reviewing it.</div>
          ) : (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Original Submission</h3>
                    <p className="text-sm text-slate-500">The submitted headline, body, contributor details, links, and context stay visible here while you review.</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                    First-hand: {selectedSubmission.firstHandLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Original Headline</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{selectedSubmission.title}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Original Body</div>
                      <div className="mt-3 min-h-[260px] whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedSubmission.originalBody || 'No original body supplied.'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-semibold text-slate-900">Contributor Details</h4>
                      <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Submitted By</div>
                          <div className="mt-1">{selectedSubmission.submittedBy}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Email / Contact</div>
                          <div className="mt-1">{selectedSubmission.contact}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">College</div>
                          <div className="mt-1">{selectedSubmission.college || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">City / State</div>
                          <div className="mt-1">{selectedSubmission.locationLabel}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Youth Pulse Track</div>
                          <div className="mt-1">{selectedSubmission.trackLabel}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</div>
                          <div className="mt-1">{selectedSubmission.createdLabel}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Source Links</div>
                      {selectedSubmission.sourceLinks.length === 0 ? (
                        <div className="mt-2 text-sm text-slate-500">No source links were provided.</div>
                      ) : (
                        <div className="mt-2 flex flex-col gap-2 text-sm">
                          {selectedSubmission.sourceLinks.map((link) => (
                            <a key={link} href={link} target="_blank" rel="noreferrer" className="break-all text-blue-700 hover:underline">
                              {link}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Attachments</div>
                      {selectedSubmission.attachments.length === 0 ? (
                        <div className="mt-2 text-sm text-slate-500">No attachments were provided.</div>
                      ) : (
                        <div className="mt-2 flex flex-col gap-2 text-sm">
                          {selectedSubmission.attachments.map((link) => (
                            <a key={link} href={link} target="_blank" rel="noreferrer" className="break-all text-blue-700 hover:underline">
                              {link}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Cleaned Version</h3>
                  <p className="text-sm text-slate-500">Prepare the publish-ready version here. This is still part of the moderated desk, not a second article editor.</p>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Cleaned Headline</label>
                    <input
                      value={selectedDraft.title}
                      onChange={(event) => patchDraft({ title: event.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Headline ready for publish"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Cleaned Summary</label>
                    <textarea
                      value={selectedDraft.summary}
                      onChange={(event) => patchDraft({ summary: event.target.value })}
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Short summary for the article pipeline"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Public Track Selector</label>
                    <select
                      value={selectedDraft.track}
                      onChange={(event) => handleTrackChange(event.target.value as DeskTrack)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      {TRACK_FILTERS.filter((item) => item.value !== 'all').map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Public Label Selector</label>
                    <select
                      value={selectedDraft.publicLabel}
                      onChange={(event) => patchDraft({ publicLabel: event.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      {PUBLIC_LABEL_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Cleaned Body</label>
                  <textarea
                    value={selectedDraft.cleanedBody}
                    onChange={(event) => patchDraft({ cleanedBody: event.target.value })}
                    rows={14}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6"
                    placeholder="Rewrite, trim, and prepare the final version here"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Moderation</h3>
                    <p className="text-sm text-slate-500">Set the desk status, keep moderation flags visible, and store editorial or verification notes before you approve or reject.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCleanedVersion}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Save Cleaned Version
                    </button>
                    <button
                      type="button"
                      onClick={handleMoveToUnderReview}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Move to Under Review
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision('approve')}
                      disabled={actionLoading === 'approve'}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading === 'approve' ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision('reject')}
                      disabled={actionLoading === 'reject'}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(['new', 'under-review', 'approved', 'rejected', 'published'] as DeskWorkflowStatus[]).map((status) => (
                        <span key={status} className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(status)}`}>
                          {getStatusLabel(status)}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-500">Moderation Flags</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {MODERATION_FLAG_OPTIONS.map((flag) => {
                        const active = selectedDraft.moderationFlags.includes(flag);
                        return (
                          <button
                            key={flag}
                            type="button"
                            onClick={() => toggleModerationFlag(flag)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active ? 'border-amber-500 bg-amber-100 text-amber-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            {flag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Editorial Notes</label>
                      <textarea
                        value={selectedDraft.editorialNotes}
                        onChange={(event) => patchDraft({ editorialNotes: event.target.value })}
                        rows={4}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Keep simple founder-friendly notes about rewrites, tone, or decisions"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Verification Notes</label>
                      <textarea
                        value={selectedDraft.verificationNotes}
                        onChange={(event) => patchDraft({ verificationNotes: event.target.value })}
                        rows={4}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Keep source checks, fact-check notes, and verification reminders here"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Rejection Reason</label>
                      <textarea
                        value={selectedDraft.rejectReason}
                        onChange={(event) => patchDraft({ rejectReason: event.target.value })}
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Explain clearly why this submission should be rejected"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Publish / Linkage</h3>
                    <p className="text-sm text-slate-500">Approved stories feed into the normal NewsPulse article pipeline. This desk does not create a separate publishing system.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={actionLoading === 'publish'}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionLoading === 'publish' ? 'Publishing…' : 'Publish to NewsPulse'}
                    </button>
                    {selectedSubmission.linkedArticleId ? (
                      <button
                        type="button"
                        onClick={() => handleOpenLinkedArticle()}
                        className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        Open Linked Article
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Linked Article</div>
                    <div className="mt-2 text-sm text-slate-700">{selectedSubmission.linkedArticleId || 'No linked article yet'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Linked Article Status</div>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${linkedArticleStatusClasses(selectedSubmission.linkedArticleStatus, Boolean(selectedSubmission.linkedArticleId))}`}>
                        {getLinkedArticleStatusLabel(selectedSubmission)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">AI Helper Tools</h2>
                <p className="text-sm text-slate-500">AI helps with review and rewrite support only. Nothing here auto-publishes.</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              AI results stay in the output area until you apply them into the cleaned version, editorial notes, or verification notes.
            </div>

            <div className="mt-4">
              <AiToolsPanel
                text={selectedDraft?.cleanedBody || ''}
                onTextChange={(value) => patchDraft({ cleanedBody: value })}
                titleText={selectedDraft?.title || ''}
                language={selectedDraft?.language || 'English'}
                onLanguageChange={(value) => patchDraft({ language: value })}
                heading="Submission-Aware AI Tools"
                contextLabel={
                  !selectedSubmission
                    ? 'Select a Youth Pulse submission to enable AI helpers.'
                    : submissionLoading
                      ? 'Refreshing the selected submission…'
                      : `Helping with ${selectedSubmission.submittedBy}'s submission`
                }
                hideTextInput
                emptyStateText="Select a Youth Pulse submission to enable AI helpers."
                onToolResult={handleAiToolResult}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">AI Outputs</h2>
                <p className="text-sm text-slate-500">Review the latest tool runs and manually place useful output into the desk.</p>
              </div>
              <div className="text-xs text-slate-400">{aiOutputs.length} results</div>
            </div>

            {aiOutputs.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                No AI output yet for this submission. Use Summarize, Translate to English, Fact Check support, Rank Headline, SEO Meta, Voice Script, Inverted Pyramid, 5W1H, or Topband One-Liners when needed.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {aiOutputs.map((output, index) => (
                  <div key={`${output.tool}-${output.createdAt}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">{output.label}</div>
                      <div className="text-xs text-slate-500">{formatDate(output.createdAt)}</div>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{output.output}</pre>
                    {(AI_APPLY_ACTIONS[output.tool] || []).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(AI_APPLY_ACTIONS[output.tool] || []).map((action) => (
                          <button
                            key={`${output.tool}-${action.target}`}
                            type="button"
                            onClick={() => applyAiOutput(output, action.target)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-sm">
            <h2 className="text-lg font-semibold">Desk Workflow</h2>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">1. Review</div>
                <div className="mt-2 text-slate-200">Open the original submission, inspect contributor details, source links, attachments, and first-hand context.</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">2. Clean</div>
                <div className="mt-2 text-slate-200">Rewrite the headline, summary, and body in the Cleaned Version section. Save inside the desk or move the story to Under Review.</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">3. Approve or Reject</div>
                <div className="mt-2 text-slate-200">Use clear moderation flags, editorial notes, verification notes, and a rejection reason before you make the final decision.</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">4. Publish</div>
                <div className="mt-2 text-slate-200">Publish sends the approved story into the regular NewsPulse article pipeline and lets you open the linked article in the normal editor.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouthPulsePage;
