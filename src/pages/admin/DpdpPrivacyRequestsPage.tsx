import React from 'react';
import toast from 'react-hot-toast';
import { ADMIN_API_BASE } from '@/lib/http/adminFetch';
import {
  clearDpdpPrivacyTestRequests,
  completeDpdpPrivacyRequest,
  getDpdpPrivacyRequest,
  listDpdpPrivacyRequests,
  updateDpdpPrivacyRequest,
  type DpdpActivityEntry,
  type DpdpPrivacyRequest,
  type DpdpRequestStatus,
} from '@/lib/dpdpPrivacyRequests';

type VisibleStatusFilter =
  | 'Active'
  | 'All'
  | 'Pending Email Verification'
  | 'Verified'
  | 'In Review'
  | 'Completed'
  | 'Rejected'
  | 'Spam/Fake'
  | 'Closed';

type ReviewResultValue = '' | 'no-match' | 'deleted-manually' | 'retained' | 'rejected' | 'spam-fake';

type ReplyTemplateValue =
  | 'under-review'
  | 'need-more-details'
  | 'no-match'
  | 'deleted-manually'
  | 'retained'
  | 'rejected'
  | 'spam-fake';

type FounderReviewState = {
  emailIdentityVerified: boolean;
  contactMessagesChecked: boolean;
  newsletterChecked: boolean;
  commentsChecked: boolean;
  careersChecked: boolean;
  communityReporterChecked: boolean;
  journalistDeskChecked: boolean;
  advertiseBusinessChecked: boolean;
  userAccountChecked: boolean;
  reviewResult: ReviewResultValue;
  userReplySent: boolean;
};

type FounderReviewDraft = {
  adminNote: string;
  replyTemplate: ReplyTemplateValue;
  reviewState: FounderReviewState;
};

const ACTIVE_REQUEST_STATUSES: DpdpRequestStatus[] = ['Pending Email Verification', 'Verified', 'In Review'];

const FILTER_OPTIONS: VisibleStatusFilter[] = [
  'Active',
  'Pending Email Verification',
  'Verified',
  'In Review',
  'Completed',
  'Rejected',
  'Spam/Fake',
  'Closed',
  'All',
];

const SUMMARY_CARD_STATUS_MAP: Array<{ label: string; statuses: DpdpRequestStatus[] }> = [
  { label: 'Pending Verification', statuses: ['Pending Email Verification'] },
  { label: 'Verified', statuses: ['Verified'] },
  { label: 'In Review', statuses: ['In Review'] },
  { label: 'Completed', statuses: ['Completed'] },
  { label: 'Spam/Fake', statuses: ['Spam/Fake'] },
];

const REVIEW_RESULT_OPTIONS: Array<{ value: ReviewResultValue; label: string }> = [
  { value: 'no-match', label: 'No matching data found' },
  { value: 'deleted-manually', label: 'Data deleted manually' },
  { value: 'retained', label: 'Data retained with reason' },
  { value: 'rejected', label: 'Request rejected' },
  { value: 'spam-fake', label: 'Spam/Fake' },
];

const REPLY_TEMPLATE_OPTIONS: Array<{ value: ReplyTemplateValue; label: string }> = [
  { value: 'under-review', label: 'Under review' },
  { value: 'need-more-details', label: 'Need more details' },
  { value: 'no-match', label: 'No matching data found' },
  { value: 'deleted-manually', label: 'Data deleted manually' },
  { value: 'retained', label: 'Data retained with reason' },
  { value: 'rejected', label: 'Request rejected' },
  { value: 'spam-fake', label: 'Spam/Fake' },
];

const REVIEW_SUMMARY_HEADER = 'Founder review checklist:';
const REVIEW_DRAFT_PREFIX = 'np:dpdp-founder-review:';
const IS_DEVELOPMENT = import.meta.env.DEV || import.meta.env.MODE === 'development';

function defaultReviewState(): FounderReviewState {
  return {
    emailIdentityVerified: false,
    contactMessagesChecked: false,
    newsletterChecked: false,
    commentsChecked: false,
    careersChecked: false,
    communityReporterChecked: false,
    journalistDeskChecked: false,
    advertiseBusinessChecked: false,
    userAccountChecked: false,
    reviewResult: '',
    userReplySent: false,
  };
}

function formatDate(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: DpdpRequestStatus): string {
  if (status === 'Completed' || status === 'Closed') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Spam/Fake' || status === 'Rejected') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'Verified') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'In Review') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-800 border-slate-200';
}

function requestKey(request: DpdpPrivacyRequest): string {
  return request.id || request.requestId || request.referenceId;
}

function activityLine(entry: DpdpActivityEntry): string {
  const pieces = [entry.action];
  if (entry.oldStatus || entry.newStatus) pieces.push(`${entry.oldStatus || '-'} -> ${entry.newStatus || '-'}`);
  if (entry.adminNote) pieces.push(entry.adminNote);
  return pieces.filter(Boolean).join(' | ');
}

function toBoolString(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function reviewResultLabel(value: ReviewResultValue): string {
  return REVIEW_RESULT_OPTIONS.find((option) => option.value === value)?.label || '-';
}

function composeReviewSummary(state: FounderReviewState): string {
  return [
    REVIEW_SUMMARY_HEADER,
    `- Email/user identity verified: ${toBoolString(state.emailIdentityVerified)}`,
    `- Contact messages checked: ${toBoolString(state.contactMessagesChecked)}`,
    `- Newsletter checked: ${toBoolString(state.newsletterChecked)}`,
    `- Comments checked: ${toBoolString(state.commentsChecked)}`,
    `- Careers checked: ${toBoolString(state.careersChecked)}`,
    `- Community Reporter checked: ${toBoolString(state.communityReporterChecked)}`,
    `- Journalist Desk checked: ${toBoolString(state.journalistDeskChecked)}`,
    `- Advertise/Business inquiries checked: ${toBoolString(state.advertiseBusinessChecked)}`,
    `- User account checked manually: ${toBoolString(state.userAccountChecked)}`,
    `- Review result: ${reviewResultLabel(state.reviewResult)}`,
    `- User reply sent: ${toBoolString(state.userReplySent)}`,
  ].join('\n');
}

function composeAdminNote(adminNote: string, state: FounderReviewState): string {
  const trimmedNote = adminNote.trim();
  const summary = composeReviewSummary(state);
  return trimmedNote ? `${trimmedNote}\n\n${summary}` : summary;
}

function parseYesNo(value: string): boolean {
  return value.trim().toLowerCase() === 'yes';
}

function parseReviewResult(value: string): ReviewResultValue {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'no matching data found') return 'no-match';
  if (normalized === 'data deleted manually') return 'deleted-manually';
  if (normalized === 'data retained with reason') return 'retained';
  if (normalized === 'request rejected') return 'rejected';
  if (normalized === 'spam/fake') return 'spam-fake';
  return '';
}

function parseAdminNote(rawNote: string): { adminNote: string; reviewState: FounderReviewState } {
  const state = defaultReviewState();
  const markerIndex = rawNote.indexOf(REVIEW_SUMMARY_HEADER);
  if (markerIndex < 0) return { adminNote: rawNote.trim(), reviewState: state };

  const plainNote = rawNote.slice(0, markerIndex).trim();
  const summaryLines = rawNote.slice(markerIndex).split(/\r?\n/).map((line) => line.trim());

  for (const line of summaryLines) {
    if (line.startsWith('- Email/user identity verified:')) state.emailIdentityVerified = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- Contact messages checked:')) state.contactMessagesChecked = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- Newsletter checked:')) state.newsletterChecked = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- Comments checked:')) state.commentsChecked = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- Careers checked:')) state.careersChecked = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- Community Reporter checked:')) state.communityReporterChecked = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- Journalist Desk checked:')) state.journalistDeskChecked = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- Advertise/Business inquiries checked:')) state.advertiseBusinessChecked = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- User account checked manually:')) state.userAccountChecked = parseYesNo(line.split(':').slice(1).join(':'));
    if (line.startsWith('- Review result:')) state.reviewResult = parseReviewResult(line.split(':').slice(1).join(':'));
    if (line.startsWith('- User reply sent:')) state.userReplySent = parseYesNo(line.split(':').slice(1).join(':'));
  }

  return { adminNote: plainNote, reviewState: state };
}

function replyTemplateForResult(result: ReviewResultValue): ReplyTemplateValue {
  if (result === 'no-match') return 'no-match';
  if (result === 'deleted-manually') return 'deleted-manually';
  if (result === 'retained') return 'retained';
  if (result === 'rejected') return 'rejected';
  if (result === 'spam-fake') return 'spam-fake';
  return 'under-review';
}

function buildReplyTemplate(request: DpdpPrivacyRequest, template: ReplyTemplateValue, adminNote: string): string {
  const name = request.fullName || 'User';
  const reference = request.referenceId || request.requestId || request.id || 'your request';
  const note = adminNote.trim();

  switch (template) {
    case 'under-review':
      return `Subject: Privacy request under review\n\nHello ${name},\n\nWe received your privacy request (${reference}) and it is under founder review. We are manually reviewing the relevant records and will update you by email.\n\nRegards,\nNews Pulse Privacy Team`;
    case 'need-more-details':
      return `Subject: More details needed for your privacy request\n\nHello ${name},\n\nWe are reviewing your privacy request (${reference}) and need more details before we can complete the review. ${note ? `Review note: ${note}\n\n` : ''}Please reply with the required details.\n\nRegards,\nNews Pulse Privacy Team`;
    case 'no-match':
      return `Subject: Privacy request review update\n\nHello ${name},\n\nWe reviewed your privacy request (${reference}) manually and did not identify matching data in the records checked at this stage. If you want us to review additional details, please reply to this email.\n\nRegards,\nNews Pulse Privacy Team`;
    case 'deleted-manually':
      return `Subject: Privacy request completed\n\nHello ${name},\n\nYour privacy request (${reference}) has been reviewed and the relevant data was handled manually by the Founder review desk. ${note ? `Review note: ${note}\n\n` : ''}If you need any follow-up, please reply to this email.\n\nRegards,\nNews Pulse Privacy Team`;
    case 'retained':
      return `Subject: Privacy request review outcome\n\nHello ${name},\n\nYour privacy request (${reference}) has been reviewed. The relevant data was retained with recorded reasoning after manual founder review. ${note ? `Review note: ${note}\n\n` : ''}If you need clarification, please reply to this email.\n\nRegards,\nNews Pulse Privacy Team`;
    case 'rejected':
      return `Subject: Privacy request rejected\n\nHello ${name},\n\nYour privacy request (${reference}) has been reviewed and rejected. ${note ? `Reason: ${note}\n\n` : 'If you need to provide more information, please reply to this email.\n\n'}Regards,\nNews Pulse Privacy Team`;
    case 'spam-fake':
      return `Subject: Privacy request closed\n\nHello ${name},\n\nYour privacy request (${reference}) was reviewed and marked as spam/fake. If this was submitted in error and you need help, please contact support with the correct details.\n\nRegards,\nNews Pulse Privacy Team`;
    default:
      return '';
  }
}

function isCompletedEntry(entry: DpdpActivityEntry): boolean {
  const nextStatus = entry.newStatus.trim().toLowerCase();
  const action = entry.action.trim().toLowerCase();
  return nextStatus === 'completed' || action.includes('complete');
}

function getLatestCompletionEntry(activityHistory: DpdpActivityEntry[]): DpdpActivityEntry | null {
  for (let index = activityHistory.length - 1; index >= 0; index -= 1) {
    const entry = activityHistory[index];
    if (isCompletedEntry(entry)) return entry;
  }
  return null;
}

function readReviewDraft(id: string): FounderReviewDraft | null {
  try {
    const raw = window.localStorage.getItem(`${REVIEW_DRAFT_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as FounderReviewDraft;
  } catch {
    return null;
  }
}

function writeReviewDraft(id: string, draft: FounderReviewDraft) {
  try {
    window.localStorage.setItem(`${REVIEW_DRAFT_PREFIX}${id}`, JSON.stringify(draft));
  } catch {
    // ignore localStorage failures
  }
}

function clearReviewDraft(id: string) {
  try {
    window.localStorage.removeItem(`${REVIEW_DRAFT_PREFIX}${id}`);
  } catch {
    // ignore localStorage failures
  }
}

export default function DpdpPrivacyRequestsPage() {
  const [requests, setRequests] = React.useState<DpdpPrivacyRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = React.useState<DpdpPrivacyRequest | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<VisibleStatusFilter>('Active');
  const [adminNote, setAdminNote] = React.useState('');
  const [reviewState, setReviewState] = React.useState<FounderReviewState>(() => defaultReviewState());
  const [replyTemplate, setReplyTemplate] = React.useState<ReplyTemplateValue>('under-review');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [isClearingTestRequests, setIsClearingTestRequests] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showActivity, setShowActivity] = React.useState(false);

  const summary = React.useMemo(() => {
    return SUMMARY_CARD_STATUS_MAP.map((card) => ({
      ...card,
      count: requests.filter((request) => card.statuses.includes(request.status)).length,
    }));
  }, [requests]);

  const filteredRequests = React.useMemo(() => {
    if (statusFilter === 'Active') {
      return requests.filter((request) => ACTIVE_REQUEST_STATUSES.includes(request.status));
    }
    if (statusFilter === 'All') return requests;
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const replyTemplateText = React.useMemo(() => {
    if (!selectedRequest) return '';
    return buildReplyTemplate(selectedRequest, replyTemplate, adminNote);
  }, [adminNote, replyTemplate, selectedRequest]);

  const completionProof = React.useMemo(() => {
    if (!selectedRequest) return null;

    const parsed = parseAdminNote(selectedRequest.adminNote || '');
    const hasStoredReviewSummary = (selectedRequest.adminNote || '').includes(REVIEW_SUMMARY_HEADER);
    const completionEntry = getLatestCompletionEntry(selectedRequest.activityHistory);
    const isCompleted = selectedRequest.status === 'Completed' || !!completionEntry;

    return {
      isCompleted,
      completedDate: formatDate(completionEntry?.timestamp || (isCompleted ? selectedRequest.updatedAt : '')),
      completedBy: completionEntry?.handledBy || '-',
      reviewResult: hasStoredReviewSummary ? reviewResultLabel(parsed.reviewState.reviewResult) : '-',
      adminNote: parsed.adminNote || '-',
      userReplySent: hasStoredReviewSummary ? toBoolString(parsed.reviewState.userReplySent) : '-',
    };
  }, [selectedRequest]);

  React.useEffect(() => {
    if (!selectedRequest) return;
    const id = requestKey(selectedRequest);
    if (!id) return;
    writeReviewDraft(id, {
      adminNote,
      replyTemplate,
      reviewState,
    });
  }, [adminNote, replyTemplate, reviewState, selectedRequest]);

  React.useEffect(() => {
    if (!reviewState.reviewResult) return;
    setReplyTemplate(replyTemplateForResult(reviewState.reviewResult));
  }, [reviewState.reviewResult]);

  const loadRequests = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await listDpdpPrivacyRequests('All');
      setRequests(next);
    } catch (err: any) {
      setError(err?.message || 'Failed to load privacy requests.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const hydrateRequest = React.useCallback((request: DpdpPrivacyRequest) => {
    const id = requestKey(request);
    const parsed = parseAdminNote(request.adminNote || '');
    const draft = id ? readReviewDraft(id) : null;
    setSelectedRequest(request);
    setAdminNote(draft?.adminNote ?? parsed.adminNote);
    setReviewState(draft?.reviewState ?? parsed.reviewState);
    setReplyTemplate(draft?.replyTemplate ?? replyTemplateForResult(parsed.reviewState.reviewResult));
  }, []);

  const openRequest = async (request: DpdpPrivacyRequest) => {
    const id = requestKey(request);
    if (!id) {
      toast.error('Privacy request ID is missing.');
      return;
    }

    hydrateRequest(request);
    setShowActivity(false);
    setIsDetailLoading(true);
    try {
      const detail = await getDpdpPrivacyRequest(id);
      hydrateRequest(detail);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load privacy request details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeRequest = () => {
    setSelectedRequest(null);
    setAdminNote('');
    setReviewState(defaultReviewState());
    setReplyTemplate('under-review');
    setShowActivity(false);
  };

  const persistStatusUpdate = async (status: DpdpRequestStatus, options?: { requiresNote?: boolean; requiresReviewCompletion?: boolean; confirmMessage?: string }) => {
    if (!selectedRequest) return;
    const note = adminNote.trim();
    if (options?.requiresNote && !note) {
      toast.error('Admin note is required for this action.');
      return;
    }
    if (options?.requiresReviewCompletion) {
      if (!reviewState.reviewResult) {
        toast.error('Select a review result before marking the request completed.');
        return;
      }
      if (!reviewState.userReplySent) {
        toast.error('Confirm that the user reply was sent before marking the request completed.');
        return;
      }
    }

    const id = requestKey(selectedRequest);
    if (!id) {
      toast.error('Privacy request ID is missing.');
      return;
    }

    if (options?.confirmMessage && !window.confirm(options.confirmMessage)) return;

    setIsSaving(true);
    try {
      const payloadNote = composeAdminNote(adminNote, reviewState);
      const updated = status === 'Completed'
        ? await completeDpdpPrivacyRequest(id, payloadNote)
        : await updateDpdpPrivacyRequest(id, { status, adminNote: payloadNote });
      clearReviewDraft(id);
      hydrateRequest(updated);
      setShowActivity(false);
      await loadRequests();
      toast.success(status === 'Completed' ? 'Privacy request marked completed.' : 'Privacy request updated.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update privacy request.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyReplyTemplate = async () => {
    if (!replyTemplateText) return;
    try {
      await navigator.clipboard.writeText(replyTemplateText);
      toast.success('Reply template copied.');
    } catch {
      toast.error('Failed to copy reply template.');
    }
  };

  const handleClearTestRequests = async () => {
    if (!IS_DEVELOPMENT) return;
    if (!window.confirm('Clear DPDP test requests in development only? This must not be used for real records.')) return;

    setIsClearingTestRequests(true);
    try {
      closeRequest();
      const message = await clearDpdpPrivacyTestRequests();
      await loadRequests();
      toast.success(message || 'Test privacy requests cleared.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to clear test privacy requests.');
    } finally {
      setIsClearingTestRequests(false);
    }
  };

  const emptyState = requests.length === 0;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">DPDP Compliance</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Privacy Requests</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Founder review desk for privacy requests submitted from the public Privacy Request form.
            </p>
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              No automatic data deletion. Founder must verify and manually review before any action.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={isLoading}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
          {IS_DEVELOPMENT ? (
            <button
              type="button"
              onClick={() => void handleClearTestRequests()}
              disabled={isLoading || isClearingTestRequests}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClearingTestRequests ? 'Clearing Test Requests...' : 'Clear Test Requests'}
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {summary.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setStatusFilter(card.statuses[0] as VisibleStatusFilter)}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="text-sm font-medium text-slate-500">{card.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-950">{card.count}</div>
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-950">Privacy Requests</h2>
            {error ? <span className="text-sm font-semibold text-red-700">{error}</span> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => {
              const isActive = option === statusFilter;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatusFilter(option)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${isActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">
            Completed requests are archived for recordkeeping and can be viewed using the Completed or All filter.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Request ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Request Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading privacy requests...</td>
                </tr>
              ) : emptyState ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    <div className="font-semibold text-slate-700">No privacy requests found. Submit a test request from /privacy-request and check backend connection.</div>
                    {import.meta.env.DEV ? <div className="mt-2 text-xs text-slate-500">Development API base: {ADMIN_API_BASE}</div> : null}
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">No privacy requests found for the selected status.</td>
                </tr>
              ) : filteredRequests.map((request) => (
                <tr key={requestKey(request)} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{request.requestId || request.referenceId || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{request.fullName || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{request.email || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{request.requestType || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(request.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void openRequest(request)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      View Request
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">View Request</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedRequest.requestId || selectedRequest.referenceId}</p>
              </div>
              <button type="button" onClick={closeRequest} className="text-sm font-semibold text-slate-500 hover:text-slate-900">Close</button>
            </div>

            <div className="space-y-5 p-5">
              {isDetailLoading ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Loading latest request details...</div> : null}

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-bold text-slate-950">Request Details</h3>
                <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <div><span className="font-semibold text-slate-500">Request ID:</span> {selectedRequest.requestId || selectedRequest.referenceId || '-'}</div>
                  <div><span className="font-semibold text-slate-500">Full name:</span> {selectedRequest.fullName || '-'}</div>
                  <div><span className="font-semibold text-slate-500">Email:</span> {selectedRequest.email || '-'}</div>
                  <div><span className="font-semibold text-slate-500">Mobile:</span> {selectedRequest.mobile || '-'}</div>
                  <div><span className="font-semibold text-slate-500">Request type:</span> {selectedRequest.requestType || '-'}</div>
                  <div><span className="font-semibold text-slate-500">Reference ID:</span> {selectedRequest.referenceId || selectedRequest.requestId || '-'}</div>
                  <div>
                    <span className="font-semibold text-slate-500">Status:</span>{' '}
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(selectedRequest.status)}`}>
                      {selectedRequest.status}
                    </span>
                  </div>
                  <div><span className="font-semibold text-slate-500">Created date:</span> {formatDate(selectedRequest.createdAt)}</div>
                  <div className="md:col-span-2"><span className="font-semibold text-slate-500">Message:</span> {selectedRequest.message || '-'}</div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">Completion Proof</h3>
                    <p className="mt-1 text-sm text-slate-600">Saved recordkeeping details for founder-completed requests.</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${completionProof?.isCompleted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    {completionProof?.isCompleted ? 'Completed record' : 'Not completed yet'}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <div><span className="font-semibold text-slate-500">Completed date:</span> {completionProof?.completedDate || '-'}</div>
                  <div><span className="font-semibold text-slate-500">Completed by:</span> {completionProof?.completedBy || '-'}</div>
                  <div><span className="font-semibold text-slate-500">Review result:</span> {completionProof?.reviewResult || '-'}</div>
                  <div><span className="font-semibold text-slate-500">User reply sent:</span> {completionProof?.userReplySent || '-'}</div>
                  <div className="md:col-span-2">
                    <span className="font-semibold text-slate-500">Admin note:</span> {completionProof?.adminNote || '-'}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-base font-bold text-slate-950">Founder Action Panel</h3>
                <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-900">
                  Review the verified request manually. If action is needed, check the relevant News Pulse records manually and reply to the user by email. Do not delete data automatically from this screen.
                </div>

                <div className="mt-5 space-y-5">
                  <section>
                    <div className="text-sm font-bold text-slate-900">Step 1: Verify</div>
                    <label className="mt-2 flex items-start gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={reviewState.emailIdentityVerified}
                        onChange={(event) => setReviewState((current) => ({ ...current, emailIdentityVerified: event.target.checked }))}
                        className="mt-1"
                      />
                      <span>Email/user identity verified</span>
                    </label>
                  </section>

                  <section>
                    <div className="text-sm font-bold text-slate-900">Step 2: Manual data check</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {[
                        ['contactMessagesChecked', 'Contact messages checked'],
                        ['newsletterChecked', 'Newsletter checked'],
                        ['commentsChecked', 'Comments checked'],
                        ['careersChecked', 'Careers checked'],
                        ['communityReporterChecked', 'Community Reporter checked'],
                        ['journalistDeskChecked', 'Journalist Desk checked'],
                        ['advertiseBusinessChecked', 'Advertise/Business inquiries checked'],
                        ['userAccountChecked', 'User account checked manually, if applicable'],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-start gap-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={reviewState[key as keyof FounderReviewState] as boolean}
                            onChange={(event) => setReviewState((current) => ({ ...current, [key]: event.target.checked }))}
                            className="mt-1"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="text-sm font-bold text-slate-900">Step 3: Review result</div>
                    <div className="mt-2 grid gap-2">
                      {REVIEW_RESULT_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="dpdp-review-result"
                            checked={reviewState.reviewResult === option.value}
                            onChange={() => setReviewState((current) => ({ ...current, reviewResult: option.value }))}
                            className="mt-1"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="text-sm font-bold text-slate-900">Step 4: Reply</div>
                    <label className="mt-2 flex items-start gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={reviewState.userReplySent}
                        onChange={(event) => setReviewState((current) => ({ ...current, userReplySent: event.target.checked }))}
                        className="mt-1"
                      />
                      <span>User reply sent</span>
                    </label>
                  </section>
                </div>
              </section>

              <label className="block text-sm font-semibold text-slate-700">
                Admin Note
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Required before Mark Completed, Reject, Mark Spam/Fake, or Close."
                />
              </label>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                No automatic data deletion. Founder must verify and manually review before any action.
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={isSaving || isDetailLoading || selectedRequest.status === 'In Review'}
                  onClick={() => void persistStatusUpdate('In Review', { confirmMessage: 'Move this privacy request to In Review?' })}
                  className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Mark In Review
                </button>
                <button
                  type="button"
                  disabled={isSaving || isDetailLoading}
                  onClick={() => void persistStatusUpdate('Completed', { requiresNote: true, requiresReviewCompletion: true, confirmMessage: 'Mark this privacy request as completed?' })}
                  className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Mark Completed
                </button>
                <button
                  type="button"
                  disabled={isSaving || isDetailLoading}
                  onClick={() => void persistStatusUpdate('Rejected', { requiresNote: true, confirmMessage: 'Reject this privacy request?' })}
                  className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={isSaving || isDetailLoading || selectedRequest.status === 'Spam/Fake'}
                  onClick={() => void persistStatusUpdate('Spam/Fake', { requiresNote: true, confirmMessage: 'Mark this privacy request as Spam/Fake?' })}
                  className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Mark Spam/Fake
                </button>
                <button
                  type="button"
                  disabled={isSaving || isDetailLoading || selectedRequest.status === 'Closed'}
                  onClick={() => void persistStatusUpdate('Closed', { requiresNote: true, confirmMessage: 'Close this privacy request?' })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
              </div>

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">Generate Reply Email</h3>
                    <p className="mt-1 text-sm text-slate-600">Copy a simple founder reply template based on the selected review outcome.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyReplyTemplate()}
                    disabled={!replyTemplateText}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy Reply Template
                  </button>
                </div>

                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Template
                  <select
                    value={replyTemplate}
                    onChange={(event) => setReplyTemplate(event.target.value as ReplyTemplateValue)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {REPLY_TEMPLATE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Copy box
                  <textarea
                    value={replyTemplateText}
                    readOnly
                    rows={9}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  />
                </label>
              </section>

              <section className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowActivity((current) => !current)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-slate-800 hover:bg-slate-50"
                >
                  <span>View Activity History</span>
                  <span className="text-xs font-semibold text-slate-500">{showActivity ? 'Hide' : 'Show'}</span>
                </button>
                {showActivity ? (
                  <div className="border-t border-slate-200 p-4">
                    {selectedRequest.activityHistory.length === 0 ? (
                      <div className="text-sm text-slate-500">No activity history available.</div>
                    ) : (
                      <ul className="space-y-3">
                        {selectedRequest.activityHistory.map((entry) => (
                          <li key={entry.id} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                            <div className="font-semibold text-slate-900">{activityLine(entry)}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDate(entry.timestamp)}{entry.handledBy ? ` | ${entry.handledBy}` : ''}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}