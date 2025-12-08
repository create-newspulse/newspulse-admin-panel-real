import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchCommunitySubmissionById } from '@/api/adminCommunityReporterApi';
import { CommunitySubmission } from '@/types/CommunitySubmission';
import { adminApi } from '@/lib/adminApi';
import { useNotify } from '@/components/ui/toast-bridge';


export default function CommunityReporterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromReporterStoriesKey: string | undefined = (location.state as any)?.reporterKey;
  const fromReporterStoriesName: string | undefined = (location.state as any)?.reporterName;
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

  function goBack() {
    // Prefer returning to Reporter Stories listing if context is available
    if (fromReporterStoriesKey) {
      const key = fromReporterStoriesKey.trim();
      const name = (fromReporterStoriesName || '').trim();
      const q = new URLSearchParams();
      q.set('reporterKey', key);
      if (name) q.set('name', name);
      navigate(`/community/reporter-stories?${q.toString()}`, { state: { reporterKey: key, reporterName: name } });
      return;
    }
    navigate('/admin/community-reporter');
  }

  if (id === 'undefined') return <div className="max-w-xl"><p className="text-red-600 mb-4">Invalid submission ID.</p><button onClick={goBack} className="px-3 py-1 rounded bg-slate-600 text-white">Back</button></div>;
  if (loading) return <div>Loading...</div>;
  if (error && !submission) return <div className="max-w-xl"><p className="text-red-600 mb-4">{error}</p><button onClick={goBack} className="px-3 py-1 rounded bg-slate-600 text-white">Back</button></div>;
  if (!submission) return null;

  return (
    <div className="max-w-5xl">
      <button onClick={goBack} className="mb-4 px-3 py-1 rounded bg-slate-600 text-white">← Back to Reporter stories</button>
      <h1 className="text-2xl font-bold mb-2">{submission.headline || 'Untitled Submission'}</h1>
      {error && <div className="mb-3 text-sm bg-red-100 text-red-700 px-3 py-2 rounded border border-red-200">{error}</div>}
      <div className="border rounded bg-white p-3 mb-6">
        <h3 className="text-sm font-semibold mb-3">Submission Details</h3>
        <div className="space-y-2 text-sm">
          {(() => {
            const preferred = (submission as any).reporterName || submission.userName || submission.name || '';
            const looksLikeId = typeof preferred === 'string' && (/^[a-f0-9]{24}$/i.test(preferred) || /^\d{10,}$/i.test(preferred));
            const fallback = (submission.email || '').split('@')[0] || '—';
            const display = preferred && !looksLikeId ? preferred : fallback;
            return <div><span className="font-semibold">User:</span> {display}</div>;
          })()}
          <div><span className="font-semibold">Email:</span> {submission.email || '—'}</div>
          <div><span className="font-semibold">Location:</span> {(() => {
            const parts = [submission.city, submission.state, submission.district, submission.country].filter(Boolean);
            return parts.length ? parts.join(', ') : (submission.city || submission.location || '—');
          })()}</div>
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

      {/* Location & Contact (internal only) */}
      <div className="border rounded bg-white p-3 mb-6">
        <h3 className="text-sm font-semibold mb-3">Location & Contact (Internal)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="font-semibold">City / Town</div>
            <div className="mt-1">{submission.city || '—'}</div>
          </div>
          <div>
            <div className="font-semibold">State / Region</div>
            <div className="mt-1">{submission.state || '—'}</div>
          </div>
          <div>
            <div className="font-semibold">Country</div>
            <div className="mt-1">{submission.country || '—'}</div>
          </div>
          <div>
            <div className="font-semibold">District / Area</div>
            <div className="mt-1">{submission.district || '—'}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="font-semibold">Reporter Name</div>
            <div className="mt-1">{submission.contactName || (submission as any).reporterName || submission.userName || submission.name || '—'}</div>
          </div>
          <div>
            <div className="font-semibold">Email</div>
            <div className="mt-1">{submission.contactEmail || submission.email || '—'}</div>
          </div>
          <div>
            <div className="font-semibold">Phone / WhatsApp</div>
            <div className="mt-1">{submission.contactPhone || '—'}</div>
          </div>
          <div>
            <div className="font-semibold">Preferred Method</div>
            <div className="mt-1">{submission.contactMethod || '—'}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {submission.contactOk ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Consent: story follow-up</span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">No follow-up consent</span>
          )}
          {submission.futureContactOk ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Consent: future stories</span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">No future contact consent</span>
          )}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Internal only – do not publish contact details publicly.</p>
      </div>

      {/* AI Review Section */}
      <div className="border rounded bg-white p-3 mb-6">
        <h3 className="text-sm font-semibold mb-3">AI Review</h3>
        {(!('aiTitle' in (submission as any)) && !('aiHeadline' in (submission as any)) && !('aiBody' in (submission as any))) && (
          <div className="text-xs text-slate-500">AI review not available. Treat as manual review.</div>
        )}
        {(() => {
          const aiTitle = (submission as any).aiTitle ?? (submission as any).aiHeadline ?? '';
          const aiBody = (submission as any).aiBody ?? '';
          const riskScoreRaw = (submission as any).riskScore;
          const riskScore = typeof riskScoreRaw === 'number' ? Math.max(0, Math.min(100, riskScoreRaw)) : null;
          const flags: string[] = Array.isArray((submission as any).flags) ? (submission as any).flags : [];
          const policyNotes: string | null = (submission as any).policyNotes ?? null;

          const risk = (() => {
            if (riskScore === null) return { label: 'Not reviewed', className: 'bg-slate-100 text-slate-600 border border-slate-200' };
            if (riskScore <= 30) return { label: `Low (${riskScore})`, className: 'bg-green-100 text-green-700 border border-green-200' };
            if (riskScore <= 70) return { label: `Medium (${riskScore})`, className: 'bg-amber-100 text-amber-800 border border-amber-200' };
            return { label: `High (${riskScore})`, className: 'bg-red-100 text-red-700 border border-red-200' };
          })();

          const friendlyFlag = (f: string) => {
            switch (f) {
              case 'mentions_minor': return 'Mentions a minor';
              case 'strong_opinion': return 'Strong opinion / emotional tone';
              case 'privacy_risk': return 'Possible privacy risk';
              case 'ai_error': return 'AI error – manual review needed';
              default: return f.replaceAll('_', ' ');
            }
          };

          return (
            <div className="space-y-3">
              {aiTitle ? (
                <div>
                  <label className="block text-xs text-slate-600 mb-1">AI Suggested Headline</label>
                  <input value={aiTitle} readOnly className="w-full border rounded px-2 py-1 text-sm bg-emerald-50/40" />
                </div>
              ) : null}
              {aiBody ? (
                <div>
                  <label className="block text-xs text-slate-600 mb-1">AI Suggested Body</label>
                  <textarea value={aiBody} readOnly rows={8} className="w-full border rounded px-2 py-1 text-sm bg-emerald-50/40" />
                </div>
              ) : null}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${risk.className}`}>{risk.label}</span>
                {flags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {flags.map((f, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200">{friendlyFlag(f)}</span>
                    ))}
                  </div>
                )}
              </div>
              {policyNotes && (
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded p-2">{policyNotes}</p>
              )}
            </div>
          );
        })()}
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