import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCommunitySubmissionById } from '@/api/adminCommunityReporterApi';
import { CommunitySubmission } from '@/types/CommunitySubmission';
import { adminApi } from '@/lib/adminApi';
import { useNotify } from '@/components/ui/toast-bridge';


export default function CommunityReporterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [submission, setSubmission] = useState<CommunitySubmission | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // Local toast state removed; we use global notify toasts.
  const notify = useNotify();

  interface CommunityApproveResponse {
    ok: boolean;
    success?: boolean;
    submission: CommunitySubmission;
    draftArticle?: any | null;
    article?: any | null;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id || id === 'undefined') return;
      setLoading(true); setError(null);
      try {
        const s = await fetchCommunitySubmissionById(String(id));
        if (cancelled) return;
        setSubmission(s);
      } catch (e:any) {
        if (cancelled) return;
        const msg = String(e?.message || 'Failed to load submission');
        const is404 = msg.includes('HTTP 404');
        const is401 = msg.includes('HTTP 401');
        setError(is404 ? 'Submission not found.' : is401 ? 'Please login again.' : 'Failed to load submission.');
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
      const res = await adminApi.post<CommunityApproveResponse>(`/api/admin/community-reporter/submissions/${id}/decision`, { decision });
      const data = res.data as CommunityApproveResponse;

      if (!data || !data.submission) {
        throw new Error('Invalid response from server');
      }

      const updated = data.submission;
      const linkedArticleId = (updated as any).linkedArticleId ?? null;
      setSubmission(prev => prev ? { ...prev, ...updated } : updated);

      if (decision === 'approve') {
        const articleLike = data.draftArticle ?? data.article ?? null;
        if (articleLike && articleLike._id) {
          const title = (articleLike.title || '').trim();
          notify.ok(
            'Story approved',
            title ? `Draft created in Manage News (Draft tab): ${title}.` : 'Draft created in Manage News (Draft tab).'
          );
        } else if (linkedArticleId) {
          notify.info('Story approved. Already linked to an existing news draft.');
        } else {
          notify.ok('Story approved');
        }
      } else {
        notify.ok('Story updated', 'Submission rejected.');
      }

      navigate('/admin/community-reporter');
    } catch (e:any) {
      setError('Failed to update submission. Please try again.');
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
    <div className="max-w-5xl">
      <button onClick={goBack} className="mb-4 px-3 py-1 rounded bg-slate-600 text-white">← Back to Queue</button>
      <h1 className="text-2xl font-bold mb-2">{submission.headline || 'Untitled Submission'}</h1>
      {error && <div className="mb-3 text-sm bg-red-100 text-red-700 px-3 py-2 rounded border border-red-200">{error}</div>}
      <div className="border rounded bg-white p-3 mb-6">
        <h3 className="text-sm font-semibold mb-3">Submission Details</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-semibold">User:</span> {submission.userName || submission.name || '—'}</div>
          <div><span className="font-semibold">Email:</span> {submission.email || '—'}</div>
          <div><span className="font-semibold">Location:</span> {submission.city || submission.location || '—'}</div>
          <div><span className="font-semibold">Category:</span> {submission.category || '—'}</div>
          <div><span className="font-semibold">Status:</span> {submission.status || '—'}</div>
          <div><span className="font-semibold">Created:</span> {submission.createdAt ? new Date(submission.createdAt).toLocaleString() : '—'}</div>
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Headline</label>
            <input value={submission.headline ?? ''} readOnly className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Body</label>
            <textarea value={submission.body ?? ''} readOnly rows={10} className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3 flex-wrap">
        {String(submission.status || '').toUpperCase() !== 'APPROVED' && (
          <button
            disabled={actionLoading}
            onClick={()=> handleDecision('approve')}
            className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
          >Approve</button>
        )}
        {String(submission.status || '').toUpperCase() !== 'REJECTED' && (
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