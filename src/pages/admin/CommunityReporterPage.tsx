import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/lib/adminApi';

// Updated interface for new backend routes (/api/admin/community/submissions)
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
  const loadedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (loadedRef.current) return;
      loadedRef.current = true;
      setLoading(true); setError(null);
      try {
        const res = await adminApi.get('/api/admin/community/submissions');
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
            <th className="p-2 text-left">View</th>
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
                <button onClick={()=> navigate(`/admin/community-reporter/${s._id}`)} className="px-3 py-1 text-xs rounded bg-blue-600 text-white">View</button>
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
