import { useState, useEffect } from 'react';
import SubmissionDetailModal from '../../../admin/src/components/community/SubmissionDetailModal';
import { adminApi, getCommunityReporterSubmissions } from '@lib/adminApi';

// Minimal interface for display
interface CommunitySubmission {
  _id: string;
  headline?: string;
  name?: string;
  location?: string;
  category?: string;
  status?: string; // new | approved | rejected
  createdAt?: string;
}

export default function CommunityReporterPage(){
  const [statusFilter, setStatusFilter] = useState<'all'|'new'>('all');
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [toast, setToast] = useState<string|null>(null);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string|null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Load submissions once per filter / refresh
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCommunityReporterSubmissions(statusFilter)
      .then(data => {
        if (cancelled) return;
        const items = (data?.items || data?.data || data?.submissions || data?.rows || data || []);
        setSubmissions(Array.isArray(items) ? items : []);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[community-reporter] load error', err);
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          setError('You are not authorized. Please log in again.');
        } else {
          setError('Could not load submissions. Please try again.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, reloadTick]);

  async function approve(id: string){
    try {
      await adminApi.patch(`/admin/community-reporter/submissions/${id}/approve`);
      setSubmissions(prev => prev.map(s => s._id === id ? { ...s, status: 'approved' } : s));
      setToast('Submission approved.');
      setTimeout(()=> setToast(null), 3500);
    } catch (e:any){
      setToast(e?.response?.data?.message || e.message || 'Approve failed');
      setTimeout(()=> setToast(null), 3500);
    }
  }

  async function reject(id: string){
    try {
      await adminApi.patch(`/admin/community-reporter/submissions/${id}/reject`);
      setSubmissions(prev => prev.map(s => s._id === id ? { ...s, status: 'rejected' } : s));
      setToast('Submission rejected.');
      setTimeout(()=> setToast(null), 3500);
    } catch (e:any){
      setToast(e?.response?.data?.message || e.message || 'Reject failed');
      setTimeout(()=> setToast(null), 3500);
    }
  }

  function open(id: string){ setSelectedId(id); }
  function close(){ setSelectedId(null); }
  function onStatusChange(id: string, nextStatus: string){
    setToast(nextStatus === 'APPROVED' ? 'Submission approved.' : 'Submission updated.');
    setTimeout(()=> setToast(null), 3500);
  }

  function refresh(){ setReloadTick(t => t+1); }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">🧑‍🤝‍🧑 Community Reporter Queue</h1>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value as 'all'|'new')} className="border rounded px-2 py-1 text-sm">
            <option value="all">All</option>
            <option value="new">Pending</option>
          </select>
          <button onClick={refresh} className="btn-secondary">Refresh</button>
        </div>
      </div>
      {toast && <div className="mb-3 text-sm bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">{toast}</div>}
      {loading && <div>Loading...</div>}
      {error && !loading && <div className="mb-3 text-sm bg-red-100 text-red-700 px-3 py-2 rounded border border-red-200">{error}</div>}
      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Headline</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Location</th>
            <th className="p-2 text-left">Category</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Created</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s: any)=>(
            <tr key={s._id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={()=> open(s._id)}>
              <td className="p-2 max-w-[220px] truncate" title={s.headline}>{s.headline}</td>
              <td className="p-2" title={s.name}>{s.name}</td>
              <td className="p-2" title={s.location}>{s.location || '—'}</td>
              <td className="p-2" title={s.category}>{s.category || '—'}</td>
              <td className="p-2 font-medium" title={s.status}>{s.status}</td>
              <td className="p-2" title={s.createdAt}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
              <td className="p-2 flex gap-2">
                {s.status !== 'approved' && <button onClick={(e)=> { e.stopPropagation(); approve(s._id); }} className="px-2 py-1 text-xs rounded bg-green-600 text-white">✅ Approve</button>}
                {s.status !== 'rejected' && <button onClick={(e)=> { e.stopPropagation(); reject(s._id); }} className="px-2 py-1 text-xs rounded bg-red-600 text-white">❌ Reject</button>}
              </td>
            </tr>
          ))}
          {!loading && submissions.length===0 && (
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
