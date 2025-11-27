import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, cleanupOldLowPriorityCommunityStories } from '@/lib/adminApi';
import { normalizeError, appendError } from '@/lib/error';
import { fetchCommunityReporterSubmissions } from '@/api/adminCommunityReporterApi';
import { debug } from '@/lib/debug';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/components/ui/toast-bridge';
import {
  CommunitySubmissionPriority,
  CommunitySubmissionApi,
  CommunityDecisionResponse
} from '@/types/api';
import { CommunitySubmission } from '@/types/CommunitySubmission';

function formatPriorityLabel(priority?: CommunitySubmissionPriority){
  // Function to format priority labels
  if (priority === 'FOUNDER_REVIEW') return '🔴 Founder Review';
  if (priority === 'EDITOR_REVIEW') return '🟡 Editor Review';
  if (priority === 'LOW_PRIORITY') return '🟢 Low Priority';
  return '—';
}

function priorityRank(priority?: CommunitySubmissionPriority){
  if (priority === 'FOUNDER_REVIEW') return 1;
  if (priority === 'EDITOR_REVIEW') return 2;
  if (priority === 'LOW_PRIORITY') return 3;
  return 99;
}

export default function CommunityReporterPage(){
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [actionId, setActionId] = useState<string|null>(null);
  const [viewMode, setViewMode] = useState<'pending'|'rejected'>('pending');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | CommunitySubmissionPriority>('ALL');
  const loadedRef = useRef(false);
  const navigate = useNavigate();
  const { isFounder } = useAuth();
  const notify = useNotify();
  const [isCleaning, setIsCleaning] = useState(false);

  // Helper to map raw API submission to strict Phase-1 CommunitySubmission type
  function mapRaw(raw: CommunitySubmissionApi): CommunitySubmission {
    return {
      id: String((raw as any).id || raw._id || (raw as any).ID || (raw as any).uuid || 'missing-id'),
      headline: raw.headline ?? '',
      body: raw.body ?? '',
      category: raw.category ?? '',
      location: raw.location ?? raw.city ?? '',
      city: raw.city ?? undefined,
      status: (() => {
        const s = String(raw.status || 'pending').toLowerCase();
        return (s === 'pending' || s === 'approved' || s === 'rejected' || s === 'trash') ? s : 'pending';
      })() as CommunitySubmission['status'],
      priority: raw.priority,
      linkedArticleId: raw.linkedArticleId ?? null,
      createdAt: raw.createdAt,
      userName: raw.userName,
      name: raw.name,
      email: raw.email,
    };
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (loadedRef.current) return;
      loadedRef.current = true;
      setLoading(true); setError(null);
      try {
        const raw = await fetchCommunityReporterSubmissions();
        debug('[CommunityReporterPage] submissions raw', raw);
        const list: CommunitySubmissionApi[] = Array.isArray(raw?.submissions) ? raw.submissions : [];
        setSubmissions(list.map(mapRaw));
      } catch (e:any) {
        if (cancelled) return;
        const n = normalizeError(e, 'Failed to load submissions.');
        setError(n.authExpired ? 'Session expired. Please login again.' : n.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function fetchSubmissions(){
    try {
      const raw = await fetchCommunityReporterSubmissions();
      debug('[CommunityReporterPage] refresh raw', raw);
      const list: CommunitySubmissionApi[] = Array.isArray(raw?.submissions) ? raw.submissions : [];
      setSubmissions(list.map(mapRaw));
    } catch(e:any) {
      const n = normalizeError(e, 'Failed to load submissions.');
      setError(n.authExpired ? 'Session expired. Please login again.' : n.message);
    }
  }

  const handleView = (submission: CommunitySubmission) => {
    if (!submission.id || submission.id === 'missing-id') return;
    navigate(`/admin/community-reporter/${submission.id}`);
  };

  // Removed unused DraftArticleSummary type; we rely on backend-provided article payload

  // Removed unused DecisionResponse type; approve flow now uses CommunityApproveResponse

  const handleDecision = async (submissionId: string, decision: 'approve' | 'reject') => {
    setActionId(submissionId); setError(null);
    try {
      const res = await adminApi.post<CommunityDecisionResponse>(
        `/api/admin/community-reporter/submissions/${submissionId}/decision`,
        { decision }
      );
      const data = res.data as CommunityDecisionResponse;

      if (!data || !data.submission) {
        throw new Error('Invalid response from server');
      }

      // Normalize submission (handles id/status)
      const normalizedSubmission = mapRaw(data.submission as CommunitySubmissionApi);
      const linkedArticleId = normalizedSubmission.linkedArticleId ?? null;

      // Update local cache with full submission payload
      setSubmissions(prev => prev.map(s =>
        s.id === submissionId
          ? {
              ...s,
              ...normalizedSubmission,
            }
          : s
      ));

      // Always keep list in sync with backend
      await fetchSubmissions();

      if (data.action === 'approve') {
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
      } else if (data.action === 'reject') {
        notify.ok('Story updated', 'Submission rejected.');
      }
    } catch (e:any) {
      const n = normalizeError(e, 'Action failed');
      setError(prev => appendError(prev, n));
      notify.err('Action failed', n.message);
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
      const n = normalizeError(e, 'Restore failed');
      setError(prev => appendError(prev, n));
    } finally {
      setActionId(null);
    }
  };

  const handleCleanup = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    try {
      const res = await cleanupOldLowPriorityCommunityStories();
      const deleted = Number(res?.deletedCount || 0);
      if (deleted > 0) {
        notify.ok('Cleanup complete', `Deleted ${deleted} old low-priority stories (older than 30 days).`);
      } else {
        notify.info('No old low-priority stories to clean.');
      }
      await fetchSubmissions();
    } catch (e:any) {
      const n = normalizeError(e, 'Cleanup failed. Please try again.');
      setError(prev => appendError(prev, n));
      notify.err('Cleanup failed', n.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const filteredSubmissions = submissions
    .filter(s => {
      const status = String(s.status || '').toLowerCase();
      if (viewMode === 'pending') return status === 'pending';
      if (viewMode === 'rejected') return status === 'rejected';
      return true;
    })
    .filter(s => priorityFilter === 'ALL' ? true : s.priority === priorityFilter)
    .slice()
    .sort((a, b) => {
      const prioDiff = priorityRank(a.priority) - priorityRank(b.priority);
      if (prioDiff !== 0) return prioDiff;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">🧑‍🤝‍🧑 Community Reporter Queue</h1>
      <div className="mb-4 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
        <button
          className={`px-3 py-1 rounded text-sm ${viewMode==='pending' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          onClick={()=> setViewMode('pending')}
        >Pending Review</button>
        <button
          className={`px-3 py-1 rounded text-sm ${viewMode==='rejected' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          onClick={()=> setViewMode('rejected')}
        >Rejected / Trash</button>
        <div className="flex items-center gap-1 ml-4 flex-wrap">
          <span className="text-xs text-slate-600 mr-1">Priority:</span>
          <button
            type="button"
            onClick={()=> setPriorityFilter('ALL')}
            className={`px-2 py-1 text-xs rounded border ${priorityFilter==='ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
          >All</button>
          <button
            type="button"
            onClick={()=> setPriorityFilter('FOUNDER_REVIEW')}
            className={`px-2 py-1 text-xs rounded border ${priorityFilter==='FOUNDER_REVIEW' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            title="High priority – founder should review first"
          >🔴 Founder</button>
          <button
            type="button"
            onClick={()=> setPriorityFilter('EDITOR_REVIEW')}
            className={`px-2 py-1 text-xs rounded border ${priorityFilter==='EDITOR_REVIEW' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            title="Medium priority – editor can review"
          >🟡 Editor</button>
          <button
            type="button"
            onClick={()=> setPriorityFilter('LOW_PRIORITY')}
            className={`px-2 py-1 text-xs rounded border ${priorityFilter==='LOW_PRIORITY' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            title="Low priority – safe to review later"
          >🟢 Low</button>
        </div>
        </div>
        {isFounder && (
          <button
            type="button"
            onClick={handleCleanup}
            disabled={isCleaning}
            className="px-3 py-1 rounded text-xs border bg-white text-slate-700 border-slate-300 hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap mt-2 sm:mt-0"
            title="Delete old low-priority stories (safe housekeeping)"
          >{isCleaning ? 'Cleaning…' : 'Clean old low-priority stories'}</button>
        )}
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
            <th className="p-2 text-left">Priority</th>
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
              <td className="p-2" title={s.priority || ''}>{formatPriorityLabel(s.priority)}</td>
              <td className="p-2 font-medium">
                <div className="flex items-center gap-2 flex-wrap">
                  <span title={s.status}>{s.status || '—'}</span>
                  {s.linkedArticleId && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200"
                      title="Draft created in Manage News"
                    >
                      Draft linked
                    </span>
                  )}
                </div>
              </td>
              <td className="p-2" title={s.createdAt}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
              <td className="p-2">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={()=> handleView(s)} className="px-3 py-1 text-xs rounded bg-blue-600 text-white" disabled={!s.id || s.id==='missing-id'}>View</button>
                  {s.linkedArticleId && (
                    <button
                      onClick={() => navigate(`/admin/articles/${s.linkedArticleId}/edit`)}
                      className="px-3 py-1 text-xs rounded bg-emerald-600 text-white"
                      title="Open linked draft in editor"
                    >Open Draft</button>
                  )}
                  {viewMode === 'pending' && String(s.status || '').toUpperCase() !== 'APPROVED' && (
                    <button
                      disabled={actionId === s.id || !s.id || s.id==='missing-id'}
                      onClick={()=> handleDecision(s.id, 'approve')}
                      className="px-3 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-60"
                    >Approve</button>
                  )}
                  {viewMode === 'pending' && String(s.status || '').toUpperCase() !== 'REJECTED' && (
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
              <td colSpan={8} className="p-4 text-center text-slate-500">No submissions found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
