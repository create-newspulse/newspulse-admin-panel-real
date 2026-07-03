import React from 'react';
import toast from 'react-hot-toast';
import {
  getDpdpPrivacyRequest,
  listDpdpPrivacyRequests,
  updateDpdpPrivacyRequest,
  type DpdpActivityEntry,
  type DpdpPrivacyRequest,
  type DpdpRequestStatus,
} from '@/lib/dpdpPrivacyRequests';

type StatusAction = {
  label: string;
  status: DpdpRequestStatus;
  requiresNote?: boolean;
  className: string;
};

const STATUS_ACTIONS: StatusAction[] = [
  { label: 'Mark In Review', status: 'In Review', className: 'border-blue-300 text-blue-700 hover:bg-blue-50' },
  { label: 'Mark Completed', status: 'Completed', className: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' },
  { label: 'Reject Request', status: 'Rejected', requiresNote: true, className: 'border-red-300 text-red-700 hover:bg-red-50' },
  { label: 'Mark Spam/Fake', status: 'Spam/Fake', requiresNote: true, className: 'border-red-300 text-red-700 hover:bg-red-50' },
  { label: 'Close Request', status: 'Closed', className: 'border-slate-300 text-slate-700 hover:bg-slate-100' },
];

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
  if (status === 'In Review' || status === 'Need More Details') return 'bg-amber-100 text-amber-800 border-amber-200';
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

export default function DpdpPrivacyRequestsPage() {
  const [requests, setRequests] = React.useState<DpdpPrivacyRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = React.useState<DpdpPrivacyRequest | null>(null);
  const [adminNote, setAdminNote] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showActivity, setShowActivity] = React.useState(false);

  const summary = React.useMemo(() => {
    const open = requests.filter((request) => !['Completed', 'Closed', 'Rejected', 'Spam/Fake'].includes(request.status)).length;
    const verified = requests.filter((request) => request.status === 'Verified').length;
    const completed = requests.filter((request) => request.status === 'Completed' || request.status === 'Closed').length;
    const spamFake = requests.filter((request) => request.status === 'Spam/Fake').length;
    return { open, verified, completed, spamFake };
  }, [requests]);

  const loadRequests = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await listDpdpPrivacyRequests();
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

  const openEditor = async (request: DpdpPrivacyRequest) => {
    const id = requestKey(request);
    if (!id) {
      toast.error('Privacy request ID is missing.');
      return;
    }

    setSelectedRequest(request);
    setAdminNote(request.adminNote || '');
    setShowActivity(false);
    setIsDetailLoading(true);
    try {
      const detail = await getDpdpPrivacyRequest(id);
      setSelectedRequest(detail);
      setAdminNote(detail.adminNote || '');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load privacy request details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeEditor = () => {
    setSelectedRequest(null);
    setAdminNote('');
    setShowActivity(false);
  };

  const applyStatus = async (action: StatusAction) => {
    if (!selectedRequest) return;
    const note = adminNote.trim();
    if (action.requiresNote && !note) {
      toast.error('Admin note is required for rejection or spam/fake marking.');
      return;
    }

    const id = requestKey(selectedRequest);
    if (!id) {
      toast.error('Privacy request ID is missing.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateDpdpPrivacyRequest(id, {
        status: action.status,
        adminNote: note,
      });
      setSelectedRequest(updated);
      setAdminNote(updated.adminNote || note);
      setShowActivity(false);
      await loadRequests();
      toast.success('Privacy request updated.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update privacy request.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">DPDP Compliance</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Privacy Requests</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Privacy requests submitted from the frontend and verified by email.
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
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Open</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{summary.open}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Verified</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{summary.verified}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Completed</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{summary.completed}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Spam/Fake</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{summary.spamFake}</div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-950">Privacy Requests</h2>
          {error ? <span className="text-sm font-semibold text-red-700">{error}</span> : null}
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
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">No privacy requests found.</td>
                </tr>
              ) : requests.map((request) => (
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
                      onClick={() => void openEditor(request)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      View/Edit
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">View/Edit Privacy Request</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedRequest.requestId || selectedRequest.referenceId}</p>
              </div>
              <button type="button" onClick={closeEditor} className="text-sm font-semibold text-slate-500 hover:text-slate-900">Close</button>
            </div>

            <div className="space-y-5 p-5">
              {isDetailLoading ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Loading latest request details...</div> : null}

              <div className="grid gap-4 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-2">
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
                <div className="md:col-span-2"><span className="font-semibold text-slate-500">Message:</span> {selectedRequest.message || '-'}</div>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Admin note
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Required when rejecting or marking spam/fake. Optional for completed or closed."
                />
              </label>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                No automatic data deletion. Founder must verify and manually review before any action.
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                {STATUS_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    disabled={isSaving || isDetailLoading}
                    onClick={() => void applyStatus(action)}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${action.className}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>

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