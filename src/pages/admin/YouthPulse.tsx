import React, { useEffect, useMemo, useState } from 'react';
import AiToolsPanel, { type AiToolResult, type AiToolsPanelLanguage } from '../../components/SafeZone/AiToolsPanel';
import { fetchCommunitySubmissionById, fetchCommunitySubmissions } from '@/api/adminCommunityReporterApi';
import { adminApi } from '@/lib/adminApi';
import { createArticle, publishArticle, updateArticle } from '@/lib/api/articles';
import { useNotify } from '@/components/ui/toast-bridge';
import { normalizeError } from '@/lib/error';
import { YOUTH_PULSE_TRACK_LABELS, YOUTH_PULSE_TRACK_OPTIONS, normalizeYouthPulseTrack, type YouthPulseTrack } from '@/lib/youthPulseTracks';

type DeskStatusFilter = 'all' | 'new' | 'under-review' | 'approved' | 'rejected' | 'published';
type TrackFilter = 'all' | YouthPulseTrack;

type RawSubmission = Record<string, any>;

interface ReviewDraft {
  title: string;
  cleanedBody: string;
  summary: string;
  language: AiToolsPanelLanguage;
  track: YouthPulseTrack | '';
  rejectReason: string;
}

interface YouthPulseSubmission {
  id: string;
  title: string;
  originalBody: string;
  submittedBy: string;
  email: string;
  contact: string;
  track: TrackFilter | 'uncategorized';
  trackLabel: string;
  city: string;
  state: string;
  locationLabel: string;
  createdAt: string;
  createdLabel: string;
  status: DeskStatusFilter;
  statusLabel: string;
  linkedArticleId: string;
  linkedArticleStatus: string;
  published: boolean;
  summary: string;
  language: string;
  raw: RawSubmission;
}

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
  ...YOUTH_PULSE_TRACK_OPTIONS,
];

const TRACK_LABELS: Record<TrackFilter | 'uncategorized', string> = {
  all: 'All Tracks',
  ...YOUTH_PULSE_TRACK_LABELS,
  uncategorized: 'Youth Pulse',
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

function pickBoolean(source: any, paths: string[]) {
  for (const path of paths) {
    const value = getPathValue(source, path);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
  }
  return false;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function normalizeTrack(raw: RawSubmission): TrackFilter | 'uncategorized' {
  const candidates = [
    pickString(raw, ['track', 'trackName', 'subCategory', 'subcategory', 'deskTrack', 'series', 'theme']),
    pickString(raw, ['category', 'categorySlug', 'primaryCategory', 'topic', 'section']),
  ]
    .filter(Boolean);

  for (const value of candidates) {
    const normalized = normalizeYouthPulseTrack(value);
    if (normalized) return normalized;
  }

  return 'uncategorized';
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

function normalizeStatus(raw: RawSubmission): { value: DeskStatusFilter; label: string; published: boolean; linkedArticleStatus: string } {
  const statusSlug = slugify(pickString(raw, ['status', 'workflowStatus', 'reviewStatus']));
  const linkedArticleStatus = pickString(raw, ['linkedArticleStatus', 'articleStatus', 'publicationStatus', 'article.status']);
  const linkedStatusSlug = slugify(linkedArticleStatus);
  const published = pickBoolean(raw, ['published', 'isPublished']) || statusSlug === 'published' || linkedStatusSlug === 'published';

  if (published) return { value: 'published', label: 'Published', published: true, linkedArticleStatus };
  if (['approved', 'accepted'].includes(statusSlug)) return { value: 'approved', label: 'Approved', published: false, linkedArticleStatus };
  if (['rejected', 'trash', 'withdrawn', 'deleted', 'archived'].includes(statusSlug)) return { value: 'rejected', label: 'Rejected', published: false, linkedArticleStatus };
  if (['under-review', 'under-reviews', 'under_review', 'review', 'in-review', 'in_review'].includes(statusSlug)) return { value: 'under-review', label: 'Under Review', published: false, linkedArticleStatus };
  return { value: 'new', label: 'New', published: false, linkedArticleStatus };
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
  const submittedBy = pickString(raw, ['reporterName', 'userName', 'name', 'contactName', 'contact.name', 'reporter.name', 'user.name']) || (email.includes('@') ? email.split('@')[0] : 'Unknown reporter');
  const createdAt = pickString(raw, ['createdAt', 'submittedAt', 'updatedAt']);
  const locationLabel = [city, state].filter(Boolean).join(', ') || '—';

  return {
    id,
    title,
    originalBody,
    submittedBy,
    email,
    contact: [email, phone].filter(Boolean).join(' / ') || '—',
    track,
    trackLabel: TRACK_LABELS[track],
    city,
    state,
    locationLabel,
    createdAt,
    createdLabel: formatDate(createdAt),
    status: status.value,
    statusLabel: status.label,
    linkedArticleId: pickString(raw, ['linkedArticleId', 'articleId', 'article._id']),
    linkedArticleStatus: status.linkedArticleStatus,
    published: status.published,
    summary: pickString(raw, ['summary', 'excerpt']),
    language: pickString(raw, ['language', 'lang']) || 'English',
    raw,
  };
}

function buildDraftFromSubmission(submission: YouthPulseSubmission): ReviewDraft {
  return {
    title: pickString(submission.raw, ['aiHeadline', 'aiTitle']) || submission.title,
    cleanedBody: pickString(submission.raw, ['aiBody', 'aiText']) || submission.originalBody,
    summary: submission.summary,
    language: normalizeLanguage(submission.language),
    track: submission.track === 'uncategorized' ? '' : submission.track,
    rejectReason: '',
  };
}

function extractArticleId(payload: any) {
  return pickString(payload, ['draftArticle._id', 'article._id', 'submission.linkedArticleId', 'linkedArticleId', '_id', 'id']);
}

function statusClasses(status: DeskStatusFilter) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'approved') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (status === 'under-review') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-sky-100 text-sky-700 border-sky-200';
}

const YouthPulsePage: React.FC = () => {
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
  }, [refreshKey]);

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
        setSelectedSubmission(normalized);
        setSubmissions((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
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
  }, [refreshKey, selectedId]);

  useEffect(() => {
    if (!selectedSubmission) return;
    setReviewDrafts((current) => {
      if (current[selectedSubmission.id]) return current;
      return { ...current, [selectedSubmission.id]: buildDraftFromSubmission(selectedSubmission) };
    });
  }, [selectedSubmission]);

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
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [searchQuery, statusFilter, submissions, trackFilter]);

  const selectedDraft = selectedId ? reviewDrafts[selectedId] : undefined;
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

  function handleTrackChange(nextTrack: YouthPulseTrack | '') {
    if (!selectedId || !selectedSubmission) return;
    patchDraft({ track: nextTrack });
    const nextLabel = nextTrack ? TRACK_LABELS[nextTrack] : 'Youth Pulse';
    updateSubmissionState(selectedId, {
      track: (nextTrack || 'uncategorized') as YouthPulseSubmission['track'],
      trackLabel: nextLabel,
      raw: {
        ...selectedSubmission.raw,
        track: nextTrack || undefined,
        trackName: nextTrack ? TRACK_LABELS[nextTrack] : undefined,
        subCategory: nextTrack || undefined,
        subcategory: nextTrack || undefined,
      },
    });
  }

  function updateSubmissionState(id: string, update: Partial<YouthPulseSubmission>) {
    setSubmissions((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
    setSelectedSubmission((current) => (current && current.id === id ? { ...current, ...update } : current));
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
        track: selectedDraft.track || undefined,
        trackName: selectedDraft.track ? TRACK_LABELS[selectedDraft.track] : undefined,
        subCategory: selectedDraft.track || undefined,
        subcategory: selectedDraft.track || undefined,
        rejectReason: decision === 'reject' ? selectedDraft.rejectReason.trim() : undefined,
      });

      const articleId = extractArticleId(res.data);
      const nextStatus = decision === 'approve' ? 'approved' : 'rejected';

      updateSubmissionState(selectedSubmission.id, {
        status: nextStatus,
        statusLabel: nextStatus === 'approved' ? 'Approved' : 'Rejected',
        linkedArticleId: articleId || selectedSubmission.linkedArticleId,
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
      notify.err('Missing content', 'Add a cleaned title and story body before publishing.');
      return;
    }

    setActionLoading('publish');
    try {
      const articlePayload = {
        title: selectedDraft.title.trim(),
        summary: selectedDraft.summary.trim() || undefined,
        content: selectedDraft.cleanedBody.trim(),
        category: 'youth-pulse',
        track: selectedDraft.track || undefined,
        trackName: selectedDraft.track ? TRACK_LABELS[selectedDraft.track] : undefined,
        subCategory: selectedDraft.track || undefined,
        subcategory: selectedDraft.track || undefined,
        language: selectedDraft.language.toLowerCase().slice(0, 2),
        city: selectedSubmission.city || undefined,
        state: selectedSubmission.state || undefined,
        source: 'youth-pulse-desk',
        origin: 'youth-pulse-submission',
        submittedBy: selectedSubmission.submittedBy,
        location: {
          city: selectedSubmission.city || undefined,
          state: selectedSubmission.state || undefined,
        },
      } as Record<string, any>;

      let articleId = selectedSubmission.linkedArticleId;

      if (!articleId) {
        const approveRes = await adminApi.post(`/community-reporter/submissions/${encodeURIComponent(selectedSubmission.id)}/decision`, {
          decision: 'approve',
          aiHeadline: selectedDraft.title.trim(),
          aiBody: selectedDraft.cleanedBody.trim(),
          track: selectedDraft.track || undefined,
          trackName: selectedDraft.track ? TRACK_LABELS[selectedDraft.track] : undefined,
          subCategory: selectedDraft.track || undefined,
          subcategory: selectedDraft.track || undefined,
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
      });

      notify.ok('Story published', 'Youth Pulse story was sent to the article pipeline and marked published.');
    } catch (err: any) {
      const normalized = normalizeError(err, 'Failed to publish Youth Pulse story.');
      notify.err('Publish failed', normalized.message);
    } finally {
      setActionLoading('');
    }
  }

  function handleAiToolResult(result: AiToolResult) {
    if (!selectedId) return;
    setAiOutputsById((current) => ({
      ...current,
      [selectedId]: [result, ...(current[selectedId] || [])],
    }));

    if (result.tool === 'headline' && result.output.trim()) {
      patchDraft({ title: result.output.trim().split('\n')[0] });
      return;
    }

    if (['translate', 'inverted-pyramid', '5w1h'].includes(result.tool) && result.output.trim()) {
      patchDraft({ cleanedBody: result.output.trim() });
      return;
    }

    if (result.tool === 'seo-meta' && result.output.trim()) {
      patchDraft({ summary: result.output.trim() });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Youth Pulse Submission Desk</h1>
          <p className="text-sm text-slate-600">
            Review Youth Pulse submissions, clean them up with AI, and move them from inbox to publish without leaving this desk.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh Inbox
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
            placeholder="Search title, reporter, contact, city or state"
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm lg:max-w-md"
          />
          <div className="text-sm text-slate-500">{filteredSubmissions.length} Youth Pulse submissions</div>
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
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">Loading Youth Pulse submissions…</td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">No Youth Pulse submissions matched the current filters.</td>
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
                    <td className="px-3 py-3 align-top">{submission.submittedBy}</td>
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Submission Review Panel</h2>
              <p className="text-sm text-slate-500">Open a record from the inbox to inspect the original copy, edit a cleaned version, and run AI against the selected submission.</p>
            </div>
            {selectedSubmission ? (
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(selectedSubmission.status)}`}>
                {selectedSubmission.statusLabel}
              </span>
            ) : null}
          </div>

          {!selectedSubmission || !selectedDraft ? (
            <div className="py-12 text-center text-sm text-slate-500">Select a Youth Pulse submission to start reviewing it.</div>
          ) : (
            <div className="space-y-5 pt-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Original Submission</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div><span className="font-medium text-slate-900">Title:</span> {selectedSubmission.title}</div>
                    <div><span className="font-medium text-slate-900">Submitted by:</span> {selectedSubmission.submittedBy}</div>
                    <div><span className="font-medium text-slate-900">Contact:</span> {selectedSubmission.contact}</div>
                    <div><span className="font-medium text-slate-900">Track:</span> {selectedSubmission.trackLabel}</div>
                    <div><span className="font-medium text-slate-900">Location:</span> {selectedSubmission.locationLabel}</div>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap min-h-[220px]">
                    {selectedSubmission.originalBody || 'No original body supplied.'}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Cleaned Version</h3>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Clean Headline</label>
                      <input
                        value={selectedDraft.title}
                        onChange={(event) => patchDraft({ title: event.target.value })}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Headline ready for publish"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Desk Summary / Notes</label>
                      <textarea
                        value={selectedDraft.summary}
                        onChange={(event) => patchDraft({ summary: event.target.value })}
                        rows={4}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Short summary or SEO meta that should travel with the article"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Youth Pulse Track</label>
                      <select
                        value={selectedDraft.track}
                        onChange={(event) => handleTrackChange((event.target.value || '') as YouthPulseTrack | '')}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Unassigned Youth Pulse Track</option>
                        {YOUTH_PULSE_TRACK_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Editable Cleaned Copy</label>
                      <textarea
                        value={selectedDraft.cleanedBody}
                        onChange={(event) => patchDraft({ cleanedBody: event.target.value })}
                        rows={12}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6"
                        placeholder="Rewrite, trim, and prepare the final Youth Pulse version here"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Desk Actions</h3>
                    <p className="text-sm text-slate-500">Approve or reject the submission record, then publish the cleaned copy into the article system.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={actionLoading === 'publish'}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionLoading === 'publish' ? 'Publishing…' : 'Publish'}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Reject Reason</label>
                    <input
                      value={selectedDraft.rejectReason}
                      onChange={(event) => patchDraft({ rejectReason: event.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Explain why this submission should be rejected"
                    />
                  </div>
                  {selectedSubmission.linkedArticleId ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Linked article: {selectedSubmission.linkedArticleId}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      No linked article yet. Publish will create one if needed.
                    </div>
                  )}
                </div>
              </div>

              <AiToolsPanel
                text={selectedDraft.cleanedBody}
                onTextChange={(value) => patchDraft({ cleanedBody: value })}
                titleText={selectedDraft.title}
                language={selectedDraft.language}
                onLanguageChange={(value) => patchDraft({ language: value })}
                heading="Submission-Aware AI Tools"
                contextLabel={submissionLoading ? 'Refreshing selected submission…' : `Running tools on ${selectedSubmission.submittedBy}'s submission`}
                hideTextInput
                emptyStateText="Select a Youth Pulse submission to enable AI tools."
                onToolResult={handleAiToolResult}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">AI Outputs</h3>
                    <p className="text-sm text-slate-500">Latest tool runs for the selected Youth Pulse submission.</p>
                  </div>
                  <div className="text-xs text-slate-400">{aiOutputs.length} results</div>
                </div>

                {aiOutputs.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    No AI output yet for this submission. Use the tools above to summarize, translate, fact-check, rank the headline, generate SEO meta, create a voice script, convert to inverted pyramid, or extract 5W1H.
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-sm">
          <h2 className="text-lg font-semibold">Desk Workflow</h2>
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inbox</div>
              <div className="mt-2 text-slate-200">The table now surfaces Youth Pulse submissions instead of a blank AI textarea, filtered to desk/category values that map to Youth Pulse.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review</div>
              <div className="mt-2 text-slate-200">Editors can inspect the original copy, clean it up, keep a reject reason, and review AI outputs without leaving the desk.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Publish</div>
              <div className="mt-2 text-slate-200">Publish reuses the existing article pipeline. If the submission already has a linked article, it updates and publishes it. Otherwise it creates one first.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouthPulsePage;
