import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '@/lib/adminApi';

// Raw API type
interface CommunitySubmissionApi {
  _id: string;
  name?: string;
  userName?: string;
  email?: string;
  location?: string;
  city?: string;
  category?: string;
  headline?: string;
  body?: string;
  mediaLink?: string;
  mediaUrl?: string;
  aiHeadline?: string;
  aiBody?: string;
  riskScore?: number;
  flags?: string[];
  rejectReason?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Normalized UI type
interface CommunitySubmission {
  id: string;
  name?: string;
  userName?: string;
  email?: string;
  location?: string;
  city?: string;
  category?: string;
  headline?: string;
  body?: string;
  mediaLink?: string;
  mediaUrl?: string;
  aiHeadline?: string;
  aiBody?: string;
  riskScore?: number;
  flags?: string[];
  rejectReason?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function CommunityReporterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [submission, setSubmission] = useState<CommunitySubmission | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string|null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id || id === 'undefined') return; // guard against literal 'undefined'
      setLoading(true); setError(null);
      try {
        const attemptPaths = [
          `/api/admin/community-reporter/submissions/${id}`,
          `/api/admin/community-reporter/submission/${id}`,
          `/api/admin/community-reporter/submissions?id=${id}`,
          // legacy fallbacks
          `/api/admin/community/submissions/${id}`,
          `/api/admin/community/submission/${id}`
        ];
        let found: CommunitySubmissionApi | null = null;
        let lastErr: any = null;
        for (const p of attemptPaths) {
          try {
            const r = await adminApi.get(p);
            const raw = r.data as any;
            const itemApi = (raw?.submission ?? raw) as CommunitySubmissionApi | undefined;
            if (itemApi && itemApi._id) {
              found = itemApi;
              break;
            }
          } catch (e:any) {
            lastErr = e;
            const st = e?.response?.status;
            // continue only on 404/400, break on auth or server errors
            if (st && st !== 404 && st !== 400) break;
          }
        }
        if (cancelled) return;
        if (!found) {
          setSubmission(null);
          const status = lastErr?.response?.status;
          setError(status === 404 ? 'Submission not found.' : 'Failed to load submission.');
        } else {
          const mapped: CommunitySubmission = { ...found, id: found._id };
          setSubmission(mapped);
          if (import.meta.env.DEV) console.debug('[CommunityReporterDetail] loaded submission', mapped.id);
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

  async function handleDecision(decision: 'approve' | 'reject') {
    if (!id || id === 'undefined') return;
    setActionLoading(true); setError(null);
    try {
      await adminApi.post(`/api/admin/community-reporter/submissions/${id}/decision`, { decision });
      // Update local status using backend convention (convert to uppercase for display if needed)
      setSubmission(prev => prev ? { ...prev, status: decision.toUpperCase() } : prev);
      setToast(decision === 'approve' ? 'Submission approved.' : 'Submission rejected.');
      setTimeout(()=> setToast(null), 3500);
      // After decision, navigate back to queue for clarity
      navigate('/admin/community-reporter');
    } catch (e:any) {
      const msg = e?.response?.data?.message || e.message || 'Action failed';
      // Fallback: try uppercase decision if lowercase failed
      if (/decision/.test(e?.config?.url || '') && (decision === 'approve' || decision === 'reject')) {
        try {
          const upper = decision.toUpperCase();
          await adminApi.post(`/api/admin/community-reporter/submissions/${id}/decision`, { decision: upper });
          setSubmission(prev => prev ? { ...prev, status: upper } : prev);
          setToast(decision === 'approve' ? 'Submission approved.' : 'Submission rejected.');
          setTimeout(()=> setToast(null), 3500);
          navigate('/admin/community-reporter');
          return;
        } catch {}
      }
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  function goBack() { navigate('/admin/community-reporter'); }

  if (id === 'undefined') return <div className="max-w-xl"><p className="text-red-600 mb-4">Invalid submission ID.</p><button onClick={goBack} className="px-3 py-1 rounded bg-slate-600 text-white">Back</button></div>;
  if (loading) return <div>Loading...</div>;
  if (error && !submission) return <div className="max-w-xl"><p className="text-red-600 mb-4">{error}</p><button onClick={goBack} className="px-3 py-1 rounded bg-slate-600 text-white">Back</button></div>;
  if (!submission) return null;

  return (
    <div className="max-w-3xl">
      <button onClick={goBack} className="mb-4 px-3 py-1 rounded bg-slate-600 text-white">← Back to Queue</button>
      <h1 className="text-2xl font-bold mb-2">{submission.headline || 'Untitled Submission'}</h1>
      {toast && <div className="mb-3 text-sm bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">{toast}</div>}
      {error && <div className="mb-3 text-sm bg-red-100 text-red-700 px-3 py-2 rounded border border-red-200">{error}</div>}
      <div className="space-y-2 text-sm">
        <div><span className="font-semibold">User:</span> {submission.userName || submission.name || '—'}</div>
        <div><span className="font-semibold">Email:</span> {submission.email || '—'}</div>
        <div><span className="font-semibold">Location:</span> {submission.city || submission.location || '—'}</div>
        <div><span className="font-semibold">Category:</span> {submission.category || '—'}</div>
        <div><span className="font-semibold">Status:</span> {submission.status || '—'}</div>
        <div><span className="font-semibold">Created:</span> {submission.createdAt ? new Date(submission.createdAt).toLocaleString() : '—'}</div>
        <div><span className="font-semibold">Story Text:</span></div>
        <div className="p-3 border rounded bg-slate-50 whitespace-pre-wrap text-sm">{submission.body || '—'}</div>
        {(submission.mediaUrl || submission.mediaLink) && <div><span className="font-semibold">Media:</span> <a href={submission.mediaUrl || submission.mediaLink} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open Media</a></div>}
      </div>
      <div className="mt-6 flex gap-3 flex-wrap">
        {submission.status !== 'APPROVED' && submission.status !== 'approve' && (
          <button
            disabled={actionLoading}
            onClick={()=> handleDecision('approve')}
            className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
          >Approve</button>
        )}
        {submission.status !== 'REJECTED' && submission.status !== 'reject' && (
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