import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/lib/adminApi';

// Raw shape from backend (_id based)
interface CommunitySubmissionApi {
  _id: string;
  userName?: string;
  name?: string;
  email?: string;
  location?: string;
  city?: string;
  category?: string;
  headline?: string;
  body?: string;
  mediaLink?: string;
  aiHeadline?: string;
  aiBody?: string;
  riskScore?: number;
  flags?: string[];
  rejectReason?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Normalized UI type (id guaranteed)
export interface CommunitySubmission {
  id: string; // normalized id used everywhere in UI
  userName?: string;
  name?: string;
  email?: string;
  location?: string;
  city?: string;
  category?: string;
  headline?: string;
  body?: string;
  mediaLink?: string;
  aiHeadline?: string;
  aiBody?: string;
  riskScore?: number;
  flags?: string[];
  rejectReason?: string;
  status?: string; // backend may send uppercase
  createdAt?: string;
  updatedAt?: string;
}

export default function CommunityReporterPage(){
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [actionId, setActionId] = useState<string|null>(null);
  const [viewMode, setViewMode] = useState<'pending'|'rejected'>('pending');
  const loadedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (loadedRef.current) return;
      loadedRef.current = true;
      setLoading(true); setError(null);
      try {
        const res = await adminApi.get('/api/admin/community-reporter/submissions');
        if (cancelled) return;
        const raw = res.data;
        const list: CommunitySubmissionApi[] = Array.isArray(raw?.submissions)
          ? raw.submissions
          : Array.isArray(raw?.data?.submissions)
            ? raw.data.submissions
            : Array.isArray(raw?.results)
              ? raw.results
              : Array.isArray(raw?.items)
                ? raw.items
                : Array.isArray(raw) ? raw : [];
        const normalized: CommunitySubmission[] = list.map(item => ({
          ...item,
          id: item._id || (item as any).id || (item as any).ID || (item as any).uuid || 'missing-id',
          status: (item.status || '').toLowerCase() // normalize for filtering
        }));
        setSubmissions(normalized);
      } catch (e:any) {
        if (cancelled) return;
        const status = e?.response?.status;
        setError(status === 401 ? 'Session expired. Please login again.' : 'Failed to load submissions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function fetchSubmissions(){
    try {
      const res = await adminApi.get('/api/admin/community-reporter/submissions');
      const raw = res.data;
      const list: CommunitySubmissionApi[] = Array.isArray(raw?.submissions) ? raw.submissions : (Array.isArray(raw) ? raw : []);
      const normalized: CommunitySubmission[] = list.map(item => ({
        ...item,
        id: item._id || (item as any).id || (item as any).ID || (item as any).uuid || 'missing-id',
        status: (item.status || '').toLowerCase()
      }));
      setSubmissions(normalized);
    } catch(e:any) {
      const status = e?.response?.status;
      setError(status === 401 ? 'Session expired. Please login again.' : 'Failed to load submissions.');
    }
  }

  const handleView = (submission: CommunitySubmission) => {
    if (!submission.id || submission.id === 'missing-id') return;
    navigate(`/admin/community-reporter/${submission.id}`);
  };

  const handleDecision = async (submissionId: string, decision: 'approve' | 'reject') => {
    setActionId(submissionId); setError(null);
    try {
      await adminApi.post(`/api/admin/community-reporter/submissions/${submissionId}/decision`, { decision });
      // Optimistic local status update to avoid refetch flash
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: decision === 'reject' ? 'rejected' : 'approved' } : s));
      // For approve we may want to remove from pending; refilter handles it since status changes
      // Optionally fetch to sync other fields
      await fetchSubmissions();
    } catch (e:any) {
      const msg = e?.response?.data?.message || e.message || 'Action failed';
      setError(prev => prev ? prev + ' | ' + msg : msg);
    } finally {
      setActionId(null);
    }
  };

  const handleRestore = async (submissionId: string) => {
    setActionId(submissionId); setError(null);
    try {
      await adminApi.post(`/api/admin/community-reporter/submissions/${submissionId}/restore`);
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'pending' } : s));
    } catch (e:any) {
      const msg = e?.response?.data?.message || e.message || 'Restore failed';
      setError(prev => prev ? prev + ' | ' + msg : msg);
    } finally {
      setActionId(null);
    }
  };

  const filteredSubmissions = submissions.filter(s => {
    if (viewMode === 'pending') return s.status === 'pending';
    if (viewMode === 'rejected') return s.status === 'rejected';
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">🧑‍🤝‍🧑 Community Reporter Queue</h1>
      <div className="mb-4 flex gap-2">
        <button
          className={`px-3 py-1 rounded text-sm ${viewMode==='pending' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          onClick={()=> setViewMode('pending')}
        >Pending Review</button>
        <button
          className={`px-3 py-1 rounded text-sm ${viewMode==='rejected' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          onClick={()=> setViewMode('rejected')}
        >Rejected / Trash</button>
      </div>
      {loading && <div>Loading...</div>}
      {error && !loading && <div className="mb-3 text-sm bg-red-100 text-red-700 px-3 py-2 rounded border border-red-200">{error}</div>}
      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Headline</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">City/Location</th>
            <th className="p-2 text-left">Category</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Created At</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSubmissions.map(s => (
            <tr key={s.id} className="border-t hover:bg-slate-50">
              <td className="p-2 max-w-[220px] truncate" title={s.headline}>{s.headline || '—'}</td>
              <td className="p-2" title={s.userName || s.name}>{s.userName || s.name || '—'}</td>
              <td className="p-2" title={s.city || s.location}>{s.city || s.location || '—'}</td>
              <td className="p-2" title={s.category}>{s.category || '—'}</td>
              <td className="p-2 font-medium" title={s.status}>{s.status || '—'}</td>
              <td className="p-2" title={s.createdAt}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
              <td className="p-2">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={()=> handleView(s)} className="px-3 py-1 text-xs rounded bg-blue-600 text-white" disabled={!s.id || s.id==='missing-id'}>View</button>
                  {viewMode === 'pending' && s.status !== 'approved' && s.status !== 'APPROVED' && (
                    <button
                      disabled={actionId === s.id || !s.id || s.id==='missing-id'}
                      onClick={()=> handleDecision(s.id, 'approve')}
                      className="px-3 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-60"
                    >Approve</button>
                  )}
                  {viewMode === 'pending' && s.status !== 'rejected' && s.status !== 'REJECTED' && (
                    <button
                      disabled={actionId === s.id || !s.id || s.id==='missing-id'}
                      onClick={()=> handleDecision(s.id, 'reject')}
                      className="px-3 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-60"
                    >Reject</button>
                  )}
                  {viewMode === 'rejected' && (
                    <button
                      disabled={actionId === s.id}
                      onClick={()=> handleRestore(s.id)}
                      className="px-3 py-1 text-xs rounded bg-yellow-600 text-white disabled:opacity-60"
                    >Restore</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!loading && filteredSubmissions.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-slate-500">No submissions found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
