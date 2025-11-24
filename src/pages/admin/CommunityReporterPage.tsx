import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/lib/adminApi';

// Updated interface for new backend routes (/api/admin/community-reporter/submissions)
interface CommunitySubmission {
  _id: string;
  headline?: string;
  userName?: string;
  name?: string; // fallback legacy field
  location?: string;
  city?: string; // some backends may use city
  category?: string;
  status?: string; // pending | approved | rejected | new
  createdAt?: string;
}

export default function CommunityReporterPage(){
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [actionId, setActionId] = useState<string|null>(null);
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
        const list = Array.isArray(raw?.submissions) ? raw.submissions : (Array.isArray(raw) ? raw : []);
        setSubmissions(list);
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

  async function handleDecision(id: string, action: 'approve'|'reject') {
    setActionId(id); setError(null);
    try {
      await adminApi.post(`/api/admin/community-reporter/submissions/${id}/decision`, { action });
      // Optimistically update status locally; backend canonical status strings may differ (e.g. uppercase)
      setSubmissions(prev => prev.map(s => s._id === id ? { ...s, status: action === 'approve' ? 'approved' : 'rejected' } : s));
    } catch (e:any) {
      const msg = e?.response?.data?.message || e.message || 'Action failed';
      setError(prev => prev ? prev + ' | ' + msg : msg);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">🧑‍🤝‍🧑 Community Reporter Queue</h1>
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
          {submissions.map(s => (
            <tr key={s._id} className="border-t hover:bg-slate-50">
              <td className="p-2 max-w-[220px] truncate" title={s.headline}>{s.headline || '—'}</td>
              <td className="p-2" title={s.userName || s.name}>{s.userName || s.name || '—'}</td>
              <td className="p-2" title={s.city || s.location}>{s.city || s.location || '—'}</td>
              <td className="p-2" title={s.category}>{s.category || '—'}</td>
              <td className="p-2 font-medium" title={s.status}>{s.status || '—'}</td>
              <td className="p-2" title={s.createdAt}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
              <td className="p-2">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={()=> navigate(`/admin/community-reporter/${s._id}`)} className="px-3 py-1 text-xs rounded bg-blue-600 text-white">View</button>
                  {s.status !== 'approved' && (
                    <button
                      disabled={actionId === s._id}
                      onClick={()=> handleDecision(s._id, 'approve')}
                      className="px-3 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-60"
                    >Approve</button>
                  )}
                  {s.status !== 'rejected' && (
                    <button
                      disabled={actionId === s._id}
                      onClick={()=> handleDecision(s._id, 'reject')}
                      className="px-3 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-60"
                    >Reject</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!loading && submissions.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-slate-500">No submissions found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
