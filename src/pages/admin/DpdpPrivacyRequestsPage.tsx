import React from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import {
  createDpdpPrivacyRequest,
  DPDP_REQUEST_STATUSES,
  DPDP_REQUEST_TYPES,
  listDpdpAuditLog,
  listDpdpPrivacyRequests,
  updateDpdpPrivacyRequest,
  type DpdpAuditEntry,
  type DpdpPrivacyRequest,
  type DpdpPrivacyRequestInput,
  type DpdpRequestStatus,
  type DpdpRequestType,
} from '@/lib/dpdpPrivacyRequests';

const emptyForm: DpdpPrivacyRequestInput = {
  fullName: '',
  email: '',
  mobile: '',
  requestType: 'Access my data',
  message: '',
  status: 'Pending Verification',
  adminNote: '',
};

function formatDate(value: string): string {
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

function handledByFromUser(user: any): string {
  return String(user?.name || user?.email || user?.role || 'Founder').trim();
}

function statusBadgeClass(status: DpdpRequestStatus): string {
  if (status === 'Closed') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Spam/Fake' || status === 'Rejected') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'Approved' || status === 'Verified') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'Need More Details') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-800 border-slate-200';
}

export default function DpdpPrivacyRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = React.useState<DpdpPrivacyRequest[]>(() => listDpdpPrivacyRequests());
  const [auditLog, setAuditLog] = React.useState<DpdpAuditEntry[]>(() => listDpdpAuditLog());
  const [formValues, setFormValues] = React.useState<DpdpPrivacyRequestInput>(emptyForm);
  const [selectedRequest, setSelectedRequest] = React.useState<DpdpPrivacyRequest | null>(null);
  const [editStatus, setEditStatus] = React.useState<DpdpRequestStatus>('Pending Verification');
  const [editNote, setEditNote] = React.useState('');
  const [isAddOpen, setIsAddOpen] = React.useState(false);

  const handledBy = handledByFromUser(user);
  const summary = React.useMemo(() => {
    return {
      total: requests.length,
      open: requests.filter((request) => !['Closed', 'Rejected', 'Spam/Fake'].includes(request.status)).length,
      closed: requests.filter((request) => request.status === 'Closed').length,
      flagged: requests.filter((request) => request.status === 'Spam/Fake').length,
    };
  }, [requests]);

  const refreshLocalState = React.useCallback(() => {
    setRequests(listDpdpPrivacyRequests());
    setAuditLog(listDpdpAuditLog());
  }, []);

  const openEditor = (request: DpdpPrivacyRequest) => {
    setSelectedRequest(request);
    setEditStatus(request.status);
    setEditNote(request.adminNote);
  };

  const closeEditor = () => {
    setSelectedRequest(null);
    setEditNote('');
    setEditStatus('Pending Verification');
  };

  const updateFormValue = (key: keyof DpdpPrivacyRequestInput, value: string) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formValues.fullName.trim() || !formValues.email.trim() || !formValues.message.trim()) {
      toast.error('Name, email, and request summary are required.');
      return;
    }

    createDpdpPrivacyRequest(formValues, handledBy);
    setFormValues(emptyForm);
    setIsAddOpen(false);
    refreshLocalState();
    toast.success('Privacy request saved.');
  };

  const saveSelectedRequest = (status: DpdpRequestStatus = editStatus) => {
    if (!selectedRequest) return;
    const updated = updateDpdpPrivacyRequest(selectedRequest.requestId, { status, adminNote: editNote }, handledBy);
    if (!updated) {
      toast.error('Privacy request could not be found.');
      return;
    }

    refreshLocalState();
    setSelectedRequest(updated);
    setEditStatus(updated.status);
    setEditNote(updated.adminNote);
    toast.success('Privacy request updated.');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">DPDP Compliance</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Privacy Requests</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Manual Email Request Tracking for requests received at privacy@newspulse.co.in.
            </p>
            <div className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              No Automatic Data Deletion
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
          >
            Add Privacy Request
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Total requests</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{summary.total}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Open review</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{summary.open}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Closed</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{summary.closed}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Spam/Fake</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{summary.flagged}</div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Manual Email Request Tracking</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Request ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Request type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created date</th>
                <th className="px-4 py-3">Handled by</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No privacy requests have been logged yet.
                  </td>
                </tr>
              ) : requests.map((request) => (
                <tr key={request.requestId} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{request.requestId}</td>
                  <td className="px-4 py-3 text-slate-700">{request.fullName}</td>
                  <td className="px-4 py-3 text-slate-700">{request.email}</td>
                  <td className="px-4 py-3 text-slate-700">{request.requestType}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(request.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{request.handledBy || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEditor(request)}
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

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Audit Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Request ID</th>
                <th className="px-4 py-3">Old status</th>
                <th className="px-4 py-3">New status</th>
                <th className="px-4 py-3">Admin note</th>
                <th className="px-4 py-3">Handled by</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLog.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No audit entries yet.</td>
                </tr>
              ) : auditLog.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-4 py-3 font-semibold text-slate-900">{entry.action.replace('_', ' ')}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{entry.requestId}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.oldStatus || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.newStatus}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-700">{entry.adminNote || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.handledBy || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(entry.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isAddOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-950">Add Privacy Request</h2>
              <button type="button" onClick={() => setIsAddOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-900">Close</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Full name
                  <input value={formValues.fullName} onChange={(event) => updateFormValue('fullName', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Email
                  <input type="email" value={formValues.email} onChange={(event) => updateFormValue('email', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Mobile optional
                  <input value={formValues.mobile} onChange={(event) => updateFormValue('mobile', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Source
                  <input value="Email" readOnly className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Request type
                  <select value={formValues.requestType} onChange={(event) => updateFormValue('requestType', event.target.value as DpdpRequestType)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    {DPDP_REQUEST_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Status
                  <select value={formValues.status} onChange={(event) => updateFormValue('status', event.target.value as DpdpRequestStatus)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    {DPDP_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Message / request summary
                <textarea value={formValues.message} onChange={(event) => updateFormValue('message', event.target.value)} rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Admin note
                <textarea value={formValues.adminNote} onChange={(event) => updateFormValue('adminNote', event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setIsAddOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="submit" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">Save request</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">View/Edit Privacy Request</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedRequest.requestId}</p>
              </div>
              <button type="button" onClick={closeEditor} className="text-sm font-semibold text-slate-500 hover:text-slate-900">Close</button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-2">
                <div><span className="font-semibold text-slate-500">Name:</span> {selectedRequest.fullName}</div>
                <div><span className="font-semibold text-slate-500">Email:</span> {selectedRequest.email}</div>
                <div><span className="font-semibold text-slate-500">Mobile:</span> {selectedRequest.mobile || '-'}</div>
                <div><span className="font-semibold text-slate-500">Source:</span> {selectedRequest.source}</div>
                <div><span className="font-semibold text-slate-500">Request type:</span> {selectedRequest.requestType}</div>
                <div><span className="font-semibold text-slate-500">Created date:</span> {formatDate(selectedRequest.createdAt)}</div>
                <div><span className="font-semibold text-slate-500">Updated date:</span> {formatDate(selectedRequest.updatedAt)}</div>
                <div><span className="font-semibold text-slate-500">Handled by:</span> {selectedRequest.handledBy || '-'}</div>
                <div className="md:col-span-2"><span className="font-semibold text-slate-500">Message / request summary:</span> {selectedRequest.message}</div>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Status
                <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as DpdpRequestStatus)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {DPDP_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Admin note
                <textarea value={editNote} onChange={(event) => setEditNote(event.target.value)} rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setEditStatus('Spam/Fake'); saveSelectedRequest('Spam/Fake'); }} className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Mark as Spam/Fake</button>
                  <button type="button" onClick={() => { setEditStatus('Closed'); saveSelectedRequest('Closed'); }} className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Mark as Closed</button>
                </div>
                <button type="button" onClick={() => saveSelectedRequest()} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">Save changes</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}