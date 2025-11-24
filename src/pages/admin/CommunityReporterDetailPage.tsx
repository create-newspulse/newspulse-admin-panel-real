import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '@/lib/adminApi';

interface SubmissionDetail {
  _id: string;
  headline?: string;
  body?: string;
  userName?: string;
  name?: string;
  email?: string;
  location?: string;
  city?: string;
  category?: string;
  status?: string;
  mediaUrl?: string;
  createdAt?: string;
}

export default function CommunityReporterDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string|null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true); setError(null);
      try {
        const res = await adminApi.get(`/api/admin/community/submissions/${id}`);
        if (cancelled) return;
        const raw = res.data;
        const submission = raw?.submission ?? raw;
        // If backend indicates failure or provides a null/empty submission, treat as not found
        if ((raw && raw.success === false) || !submission || (typeof submission === 'object' && submission !== null && Object.keys(submission).length === 0)) {
          setSub(null);
          setError('Submission not found.');
        } else {
          setSub(submission);
        }
      } catch (e:any) {
        if (cancelled) return;
        const st = e?.response?.status;
        setError(st === 404 ? 'Submission not found.' : st === 401 ? 'Please login again.' : 'Failed to load submission.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleDecision(action: 'approve'|'reject') {
    if (!id) return;
    setActionLoading(true); setError(null);
    try {
      await adminApi.post(`/api/admin/community/submissions/${id}/${action}`);
      setSub(prev => prev ? { ...prev, status: action === 'approve' ? 'approved' : 'rejected' } : prev);
      setToast(action === 'approve' ? 'Submission approved.' : 'Submission rejected.');
      setTimeout(()=> setToast(null), 3500);
    } catch (e:any) {
      const msg = e?.response?.data?.message || e.message || 'Action failed';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  function goBack() { navigate('/admin/community-reporter'); }

  if (loading) return <div>Loading...</div>;
  if (error && !sub) return <div className="max-w-xl"><p className="text-red-600 mb-4">{error}</p><button onClick={goBack} className="px-3 py-1 rounded bg-slate-600 text-white">Back</button></div>;
  if (!sub) return null;

  return (
    <div className="max-w-3xl">
      <button onClick={goBack} className="mb-4 px-3 py-1 rounded bg-slate-600 text-white">← Back to Queue</button>
      <h1 className="text-2xl font-bold mb-2">{sub.headline || 'Untitled Submission'}</h1>
      {toast && <div className="mb-3 text-sm bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">{toast}</div>}
      {error && <div className="mb-3 text-sm bg-red-100 text-red-700 px-3 py-2 rounded border border-red-200">{error}</div>}
      <div className="space-y-2 text-sm">
        <div><span className="font-semibold">User:</span> {sub.userName || sub.name || '—'}</div>
        <div><span className="font-semibold">Email:</span> {sub.email || '—'}</div>
        <div><span className="font-semibold">Location:</span> {sub.city || sub.location || '—'}</div>
        <div><span className="font-semibold">Category:</span> {sub.category || '—'}</div>
        <div><span className="font-semibold">Status:</span> {sub.status || '—'}</div>
        <div><span className="font-semibold">Created:</span> {sub.createdAt ? new Date(sub.createdAt).toLocaleString() : '—'}</div>
        <div><span className="font-semibold">Story Text:</span></div>
        <div className="p-3 border rounded bg-slate-50 whitespace-pre-wrap text-sm">{sub.body || '—'}</div>
        {sub.mediaUrl && <div><span className="font-semibold">Media:</span> <a href={sub.mediaUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open Media</a></div>}
      </div>
      <div className="mt-6 flex gap-3 flex-wrap">
        {sub.status !== 'approved' && (
          <button
            disabled={actionLoading}
            onClick={()=> handleDecision('approve')}
            className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
          >Approve</button>
        )}
        {sub.status !== 'rejected' && (
          <button
            disabled={actionLoading}
            onClick={()=> handleDecision('reject')}
            className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60"
          >Reject</button>
        )}
      </div>
    </div>
  );
}