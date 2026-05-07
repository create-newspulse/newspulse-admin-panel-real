import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listCommunitySubmissions, CommunitySubmission, CommunitySubmissionPriority } from '../../../lib/api/communitySubmissions';
import SubmissionDetailModal from '../../../components/community/SubmissionDetailModal';
import { formatLocation } from '../../../lib/formatLocation';

type StatusFilter = 'ALL' | 'NEW';
type PriorityFilter = 'ALL' | CommunitySubmissionPriority;

function formatPriorityLabel(priority?: CommunitySubmissionPriority){
  if (priority === 'FOUNDER_REVIEW') return '🔴 Founder Review';
  if (priority === 'EDITOR_REVIEW') return '🟡 Editor Review';
  if (priority === 'LOW_PRIORITY') return '🟢 Low';
  return '—';
}

function priorityRank(priority?: CommunitySubmissionPriority){
  if (priority === 'FOUNDER_REVIEW') return 1;
  if (priority === 'EDITOR_REVIEW') return 2;
  if (priority === 'LOW_PRIORITY') return 3;
  return 99;
}

export default function CommunityReporterPage(){
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [toast, setToast] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('NEW');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');

  const { data, isLoading, refetch } = useQuery({
    queryKey:['community-submissions', statusFilter],
    queryFn: () => listCommunitySubmissions(statusFilter==='NEW' ? { status: 'NEW'} : {} )
  });

  const submissionsRaw: CommunitySubmission[] = useMemo(() => {
    const arr = (data as any)?.data || data || [];
    return Array.isArray(arr) ? arr.slice() : [];
  }, [data]);

  const submissions = useMemo(() =>
    submissionsRaw
      .filter(s => priorityFilter === 'ALL' ? true : s.priority === priorityFilter)
      .slice()
      .sort((a, b) => {
        const prioDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (prioDiff !== 0) return prioDiff;
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime; // newest first within same priority
      })
  , [submissionsRaw, priorityFilter]);

  function open(id: string){
    setSelectedId(id);
  }
  function close(){
    setSelectedId(null);
  }
  function onStatusChange(id: string, nextStatus: string){
    setError(null);
    setToast(nextStatus === 'APPROVED' ? 'Submission approved.' : 'Submission updated.');
    setTimeout(()=> setToast(null), 3500);
    // Remove from list immediately if approved while showing Pending
    if (statusFilter === 'NEW' && nextStatus === 'APPROVED') {
      qc.setQueryData(['community-submissions', statusFilter], (old: any) => {
        try {
          const arr = Array.isArray(old) ? old : (Array.isArray(old?.data) ? old.data : []);
          const next = arr.filter((s: any) => (s._id || s.id) !== id);
          return Array.isArray(old) ? next : { ...(old||{}), data: next };
        } catch { return old; }
      });
    }
    qc.invalidateQueries({ queryKey:['community-submissions'] });
  }
  function onError(message: string){
    setError(message);
    setTimeout(()=> setError(null), 5000);
  }

  useEffect(()=> { refetch(); }, [statusFilter, refetch]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">🧑‍🤝‍🧑 Community Reporter Queue</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value as StatusFilter)} className="border rounded px-2 py-1 text-sm">
              <option value="ALL">All statuses</option>
              <option value="NEW">Pending</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-newspulse-slate mr-1">Priority:</span>
            <button
              type="button"
              onClick={()=> setPriorityFilter('ALL')}
              className={`px-2 py-1 text-xs rounded border ${priorityFilter==='ALL' ? 'bg-newspulse-blue text-newspulse-white border-newspulse-blue' : 'bg-newspulse-white text-newspulse-slate border-newspulse-slate/30'}`}
              title="Show all priorities"
            >All</button>
            <button
              type="button"
              onClick={()=> setPriorityFilter('FOUNDER_REVIEW')}
              className={`px-2 py-1 text-xs rounded border ${priorityFilter==='FOUNDER_REVIEW' ? 'bg-newspulse-blue text-newspulse-white border-newspulse-blue' : 'bg-newspulse-white text-newspulse-slate border-newspulse-slate/30'}`}
              title="High priority – founder should review first"
            >🔴 Founder</button>
            <button
              type="button"
              onClick={()=> setPriorityFilter('EDITOR_REVIEW')}
              className={`px-2 py-1 text-xs rounded border ${priorityFilter==='EDITOR_REVIEW' ? 'bg-newspulse-blue text-newspulse-white border-newspulse-blue' : 'bg-newspulse-white text-newspulse-slate border-newspulse-slate/30'}`}
              title="Medium priority – editor can review"
            >🟡 Editor</button>
            <button
              type="button"
              onClick={()=> setPriorityFilter('LOW_PRIORITY')}
              className={`px-2 py-1 text-xs rounded border ${priorityFilter==='LOW_PRIORITY' ? 'bg-newspulse-blue text-newspulse-white border-newspulse-blue' : 'bg-newspulse-white text-newspulse-slate border-newspulse-slate/30'}`}
              title="Low priority – safe to review later"
            >🟢 Low</button>
          </div>
          <button onClick={()=> qc.invalidateQueries({ queryKey:['community-submissions'] })} className="btn-secondary">Refresh</button>
        </div>
      </div>
      {error && <div className="mb-3 text-sm bg-newspulse-red/10 text-newspulse-red px-3 py-2 rounded border border-newspulse-red/20">{error}</div>}
      {toast && <div className="mb-3 text-sm bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">{toast}</div>}
      {isLoading && <div>Loading...</div>}
      <table className="w-full text-sm border">
        <thead className="bg-newspulse-slate/10">
          <tr>
            <th className="p-2 text-left">Headline</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Location</th>
            <th className="p-2 text-left">Category</th>
            <th className="p-2 text-left">AI</th>
            <th className="p-2 text-left">Priority</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Risk</th>
            <th className="p-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s: any)=>(
            <tr key={s._id || s.id} className="border-t hover:bg-newspulse-slate/10 cursor-pointer" onClick={()=> open(s._id || s.id)}>
              <td className="p-2 max-w-[220px] truncate" title={s.headline}>{s.headline}</td>
              <td className="p-2" title={s.userName}>{s.userName}</td>
              <td className="p-2" title={formatLocation(s.location) === '-' ? '' : formatLocation(s.location)}>{formatLocation(s.location)}</td>
              <td className="p-2" title={s.category}>{s.category || '—'}</td>
              <td className="p-2">
                {s?.aiTipOnlySuggested === true ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium border bg-yellow-50 text-yellow-800 border-yellow-200"
                    title={(s?.aiSuggestedCategory || '') as string}
                  >
                    Tip
                  </span>
                ) : (
                  <span className="text-newspulse-slate/40"> </span>
                )}
              </td>
              <td className="p-2" title={s.priority || ''}>{formatPriorityLabel(s.priority)}</td>
              <td className="p-2 font-medium" title={s.status}>{s.status}</td>
              <td className="p-2" title={typeof s.riskScore==='number' ? String(s.riskScore) : '—'}>
                {typeof s.riskScore==='number' ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${s.riskScore <= 25 ? 'bg-green-100 text-green-700 border-green-200' : s.riskScore <= 60 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-newspulse-red/10 text-newspulse-red border-newspulse-red/20'}`}>{s.riskScore}</span>
                ) : '—'}
              </td>
              <td className="p-2" title={s.createdAt}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
            </tr>
          ))}
          {!isLoading && submissions.length===0 && (
            <tr>
              <td colSpan={9} className="p-4 text-center text-newspulse-slate">No submissions found.</td>
            </tr>
          )}
        </tbody>
      </table>

      <SubmissionDetailModal
        id={selectedId}
        onClose={close}
        onStatusChange={(id, status) => onStatusChange(id, status)}
        onError={(msg) => onError(msg)}
      />
    </div>
  );
}
