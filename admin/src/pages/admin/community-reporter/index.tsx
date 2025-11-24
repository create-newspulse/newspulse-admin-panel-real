import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listCommunitySubmissions, CommunitySubmission } from '../../../lib/api/communitySubmissions';
import SubmissionDetailModal from '../../../components/community/SubmissionDetailModal';

export default function CommunityReporterPage(){
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'ALL'|'NEW'>('ALL');
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [toast, setToast] = useState<string|null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey:['community-submissions', statusFilter],
    queryFn: () => listCommunitySubmissions(statusFilter==='NEW' ? { status: 'NEW'} : {} )
  });

  const submissions: CommunitySubmission[] = (data?.data || data || []).slice();

  function open(id: string){
    setSelectedId(id);
  }
  function close(){
    setSelectedId(null);
  }
  function onStatusChange(id: string, nextStatus: string){
    setToast(nextStatus === 'APPROVED' ? 'Submission approved.' : 'Submission updated.');
    setTimeout(()=> setToast(null), 3500);
  }

  useEffect(()=> { refetch(); }, [statusFilter, refetch]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">🧑‍🤝‍🧑 Community Reporter Queue</h1>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
            <option value="ALL">All</option>
            <option value="NEW">Pending</option>
          </select>
          <button onClick={()=> qc.invalidateQueries({ queryKey:['community-submissions'] })} className="btn-secondary">Refresh</button>
        </div>
      </div>
      {toast && <div className="mb-3 text-sm bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">{toast}</div>}
      {isLoading && <div>Loading...</div>}
      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Headline</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Location</th>
            <th className="p-2 text-left">Category</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Risk</th>
            <th className="p-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s: any)=>(
            <tr key={s._id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={()=> open(s._id)}>
              <td className="p-2 max-w-[220px] truncate" title={s.headline}>{s.headline}</td>
              <td className="p-2" title={s.userName}>{s.userName}</td>
              <td className="p-2" title={s.location}>{s.location || '—'}</td>
              <td className="p-2" title={s.category}>{s.category || '—'}</td>
              <td className="p-2 font-medium" title={s.status}>{s.status}</td>
              <td className="p-2" title={typeof s.riskScore==='number' ? String(s.riskScore) : '—'}>
                {typeof s.riskScore==='number' ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${s.riskScore <= 25 ? 'bg-green-100 text-green-700 border-green-200' : s.riskScore <= 60 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{s.riskScore}</span>
                ) : '—'}
              </td>
              <td className="p-2" title={s.createdAt}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
            </tr>
          ))}
          {!isLoading && submissions.length===0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-slate-500">No submissions found.</td>
            </tr>
          )}
        </tbody>
      </table>

      <SubmissionDetailModal
        id={selectedId}
        onClose={close}
        onStatusChange={(id, status) => onStatusChange(id, status)}
      />
    </div>
  );
}
