import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, cleanupOldLowPriorityCommunityStories } from '@/lib/adminApi';
import { normalizeError, appendError } from '@/lib/error';
import { fetchCommunityReporterSubmissions, listCommunityReporterQueue, restoreCommunitySubmission, hardDeleteCommunitySubmission } from '@/api/adminCommunityReporterApi';
import { debug } from '@/lib/debug';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/components/ui/toast-bridge';
import {
  CommunitySubmissionPriority,
  CommunitySubmissionApi,
  CommunityDecisionResponse
} from '@/types/api';
import { CommunitySubmission } from '@/types/CommunitySubmission';
import { getAgeGroup, toneToBadgeClasses } from '@/lib/communityReporterUtils';
import ReporterProfileDrawer from '@/components/community/ReporterProfileDrawer';
import { Star } from 'lucide-react';
import { listReporterContacts as listReporterContactsDirectory } from '@/lib/api/reporterDirectory';

/*
 * Community Reporter Queue (admin)
 * File: src/pages/admin/CommunityReporterPage.tsx
 * Submission type: CommunitySubmission (src/types/CommunitySubmission.ts)
 * Data fetch: fetchCommunityReporterSubmissions() from src/api/adminCommunityReporterApi.ts
 * Enhancements: Reporter composite cell (name + age group badge + location)
 */

function formatPriorityLabel(priority?: CommunitySubmissionPriority){
  // Function to format priority labels
  if (priority === 'FOUNDER_REVIEW') return '🔴 Founder Review';
  if (priority === 'EDITOR_REVIEW') return '🟡 Editor Review';
  if (priority === 'LOW_PRIORITY') return '🟢 Low Priority';
  return '—';
}

// Priority rank helper no longer used in sorting; keep for future enhancements
// Removed to avoid unused variable warning

export default function CommunityReporterPage(){
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
  // New UI state additions
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'FLAGGED'>('ALL');
  const [aiPickOnly, setAiPickOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'ALL'|'COMMUNITY'|'VERIFIED_JOURNALISTS'>('ALL');
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSubmission, setProfileSubmission] = useState<CommunitySubmission | null>(null);

  const contactsIndexRef = useRef<Map<string, string>>(new Map());
  const contactsLoadedRef = useRef(false);
  const contactsLoadPromiseRef = useRef<Promise<Map<string, string>> | null>(null);

  function normalizePhone(p?: string | null): string {
    const digits = String(p || '').replace(/\D/g, '');
    if (!digits) return '';
    // Prefer last 10 digits for matching, but keep full when shorter.
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  async function ensureContactsIndexLoaded(): Promise<Map<string, string>> {
    if (contactsLoadedRef.current) return contactsIndexRef.current;
    if (contactsLoadPromiseRef.current) return contactsLoadPromiseRef.current;

    contactsLoadPromiseRef.current = (async () => {
      try {
        const res = await listReporterContactsDirectory({ page: 1, limit: 500 } as any);
        const rows = (res as any)?.rows ?? (res as any)?.items ?? [];
        const idx = new Map<string, string>();
        for (const r of rows) {
          const name = String((r as any)?.name || '').trim();
          if (!name) continue;
          const email = String((r as any)?.email || '').trim().toLowerCase();
          const phone = normalizePhone((r as any)?.phone);
          if (email) idx.set(`e:${email}`, name);
          if (phone) idx.set(`p:${phone}`, name);
          const id = String((r as any)?.id || (r as any)?._id || (r as any)?.reporterKey || '').trim();
          if (id) idx.set(`id:${id}`, name);
        }
        contactsIndexRef.current = idx;
        contactsLoadedRef.current = true;
        return idx;
      } catch {
        // Optional enrichment only; never block the queue.
        contactsLoadedRef.current = true;
        contactsIndexRef.current = new Map();
        return contactsIndexRef.current;
      } finally {
        contactsLoadPromiseRef.current = null;
      }
    })();

    return contactsLoadPromiseRef.current;
  }

  async function enrichReporterNamesIfPossible(list: CommunitySubmission[]): Promise<CommunitySubmission[]> {
    const needs = list.some(s => !s.reporterName && (!!s.email || !!s.contactEmail || !!s.contactPhone || !!s.contactName || !!s.name || !!s.userName));
    if (!needs) return list;

    const idx = await ensureContactsIndexLoaded();
    if (!idx.size) return list;

    return list.map((s) => {
      if (s.reporterName) return s;
      const email = String((s.email || s.contactEmail || '')).trim().toLowerCase();
      const phone = normalizePhone((s as any).phone || s.contactPhone);
      const id = String((s as any).reporterKey || (s as any).userId || '').trim();
      const name = (email && idx.get(`e:${email}`)) || (phone && idx.get(`p:${phone}`)) || (id && idx.get(`id:${id}`)) || '';
      return name ? { ...s, reporterName: name } : s;
    });
  }

  // Helper to map raw API submission to strict Phase-1 CommunitySubmission type
  function norm(val: any, prefer?: 'city'|'state'|'country'): string {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      const city = (val.city && typeof val.city === 'string') ? val.city : '';
      const state = (val.state && typeof val.state === 'string') ? val.state : '';
      const country = (val.country && typeof val.country === 'string') ? val.country : '';
      if (prefer === 'city') return city;
      if (prefer === 'state') return state;
      if (prefer === 'country') return country;
      const parts = [city, state, country].filter(Boolean);
      return parts.join(', ');
    }
    try { return String(val); } catch { return ''; }
  }
  function mapRaw(raw: CommunitySubmissionApi): CommunitySubmission {
    const statusNorm = (() => {
      const s = String(raw.status || 'pending').toLowerCase();
      return (s === 'pending' || s === 'approved' || s === 'rejected' || s === 'trash') ? s : 'pending';
    })() as CommunitySubmission['status'];
    const reporterName = (
      raw.userName
      || raw.name
      || (raw as any).contactName
      || (raw as any).reporterName
      || (raw as any).reporter?.name
      || (raw as any).reporter?.userName
      || (raw as any).user?.name
      || (raw as any).user?.userName
      || ''
    ).trim() || undefined;
    // Age extraction (number if possible)
    const ageRaw: any = (raw as any).age ?? (raw as any).reporterAge ?? undefined;
    const ageNum = typeof ageRaw === 'number' ? ageRaw : (typeof ageRaw === 'string' ? Number(ageRaw) : undefined);
    const reporterAge = (typeof ageNum === 'number' && !Number.isNaN(ageNum)) ? ageNum : undefined;
    const explicitGroup: string | undefined = (raw as any).ageGroup || (raw as any).reporterAgeGroup || undefined;
    const city = norm((raw as any).city ?? (raw as any).town, 'city');
    const state = norm((raw as any).state ?? (raw as any).region, 'state');
    const country = norm((raw as any).country, 'country');
    const district = (raw as any).district || (raw as any).area || '';
    const contactName = (raw as any).contactName || undefined;
    const contactEmail = (raw as any).contactEmail || undefined;
    const contactPhone = (raw as any).contactPhone || undefined;
    const contactMethod = (raw as any).contactMethod || undefined;
    const contactOk = (raw as any).contactOk === true || (raw as any).contactOk === 'true';
    const futureContactOk = (raw as any).futureContactOk === true || (raw as any).futureContactOk === 'true';
    const locParts = [city, state, country].map(p => String(p || '').trim()).filter(Boolean);
    const joinedLoc = locParts.join(', ');
    const reporterLocation = joinedLoc || norm((raw as any).location ?? (raw as any).city);
    const agInfo = getAgeGroup(reporterAge, explicitGroup);
    return {
      id: String((raw as any).id || raw._id || (raw as any).ID || (raw as any).uuid || 'missing-id'),
      headline: raw.headline ?? '',
      body: raw.body ?? '',
      category: raw.category ?? '',
      location: reporterLocation || '',
      city: city || undefined,
      state: state || undefined,
      country: country || undefined,
      district: district || undefined,
      status: statusNorm,
      priority: raw.priority,
      linkedArticleId: raw.linkedArticleId ?? null,
      createdAt: raw.createdAt,
      userName: raw.userName,
      name: raw.name,
      email: raw.email,
      contactName,
      contactEmail,
      contactPhone,
      contactMethod,
      contactOk: contactOk || undefined,
      futureContactOk: futureContactOk || undefined,
      reporterName,
      reporterAge,
      reporterAgeGroup: agInfo.label,
      reporterLocation,
      // AI review fields (support legacy naming fallbacks)
      aiTitle: (raw as any).aiTitle ?? (raw as any).aiHeadline ?? null,
      aiBody: (raw as any).aiBody ?? (raw as any).aiText ?? null,
      riskScore: (typeof (raw as any).riskScore === 'number') ? (raw as any).riskScore : undefined,
      flags: Array.isArray((raw as any).flags) ? (raw as any).flags : undefined,
      policyNotes: (raw as any).policyNotes ?? undefined,
      aiHighlighted: (raw as any).aiHighlighted === true || (raw as any).aiHighlighted === 'true',
      aiTrendingScore: typeof (raw as any).aiTrendingScore === 'number' ? (raw as any).aiTrendingScore : undefined,
      ptiComplianceStatus: (raw as any).ptiComplianceStatus ?? undefined,
      trustScore: typeof (raw as any).trustScore === 'number' ? (raw as any).trustScore : undefined,
    };
  }

  // React Query based loading for submissions with server-side filters.
  const sourceBackend = sourceFilter === 'COMMUNITY' ? 'community' : sourceFilter === 'VERIFIED_JOURNALISTS' ? 'journalists' : undefined;
  const { isLoading, isError } = (window as any).useQueueQueryHook || {};

  // Inline lightweight custom hook behavior without external abstraction.
  const [internalLoading, setInternalLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setInternalLoading(true);
      setError(null);
      try {
        const raw = await listCommunityReporterQueue({
          status: viewMode === 'pending' ? 'pending' : 'rejected',
          priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
          risk: riskFilter === 'ALL' ? undefined : riskFilter,
          source: sourceBackend,
          aiPickOnly,
        });
        const list: CommunitySubmissionApi[] = Array.isArray(raw?.submissions) ? raw.submissions : [];
        const mapped = list.map(mapRaw);
        const enriched = await enrichReporterNamesIfPossible(mapped);
        setSubmissions(enriched);
      } catch (e:any) {
        const n = normalizeError(e, 'Failed to load submissions.');
        setError(n.authExpired ? 'Session expired. Please login again.' : n.message);
        if (import.meta.env.DEV) debug('[CommunityReporterPage] fetch error status', e?.response?.status);
      } finally {
        if (!cancelled) setInternalLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [viewMode, priorityFilter, riskFilter, sourceFilter, aiPickOnly]);

  async function fetchSubmissions(){
    // Manual refresh (e.g. cleanup or explicit reload) using same param mapping.
    try {
      const raw = await listCommunityReporterQueue({
        status: viewMode === 'pending' ? 'pending' : 'rejected',
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        risk: riskFilter === 'ALL' ? undefined : riskFilter,
        source: sourceBackend,
        aiPickOnly,
      });
      debug('[CommunityReporterPage] refresh raw', raw);
      const list: CommunitySubmissionApi[] = Array.isArray(raw?.submissions) ? raw.submissions : [];
      const mapped = list.map(mapRaw);
      const enriched = await enrichReporterNamesIfPossible(mapped);
      setSubmissions(enriched);
    } catch(e:any) {
      const n = normalizeError(e, 'Failed to load submissions.');
      setError(n.authExpired ? 'Session expired. Please login again.' : n.message);
    }
  }

  const handleView = (submission: CommunitySubmission) => {
    if (!submission.id || submission.id === 'missing-id') return;
    const name = submission.reporterName || submission.userName || submission.name || '';
    try {
      if (name) sessionStorage.setItem(`cr:${submission.id}:name`, name);
      if (submission.headline) sessionStorage.setItem(`cr:${submission.id}:headline`, submission.headline);
    } catch {}
    navigate(`/admin/community-reporter/${submission.id}` as any, { state: { reporterName: name, submissionId: submission.id, headline: submission.headline } } as any);
  };

  // Removed unused DraftArticleSummary type; we rely on backend-provided article payload

  // Removed unused DecisionResponse type; approve flow now uses CommunityApproveResponse

  const handleDecision = async (submissionId: string, decision: 'approve' | 'reject') => {
    setActionId(submissionId); setError(null);
    try {
      const res = await adminApi.post<CommunityDecisionResponse>(
        `/community-reporter/submissions/${submissionId}/decision`,
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
      await restoreCommunitySubmission(submissionId);
      // Remove from rejected list locally; move to pending view if user switches tabs
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'pending' } : s));
      // Optionally trigger a soft refresh to keep counts in sync
      await fetchSubmissions();
    } catch (e:any) {
      const n = normalizeError(e, 'Restore failed');
      setError(prev => appendError(prev, n));
    } finally {
      setActionId(null);
    }
  };

  const handleHardDelete = async (submissionId: string) => {
    const ok = window.confirm('Are you sure? This will permanently delete this submission and cannot be undone.');
    if (!ok) return;
    setActionId(submissionId); setError(null);
    try {
      await hardDeleteCommunitySubmission(submissionId);
      // Optimistically remove from local list
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      await fetchSubmissions();
      notify.ok('Deleted forever');
    } catch (e:any) {
      const n = normalizeError(e, 'Delete failed');
      setError(prev => appendError(prev, n));
      notify.err('Delete failed', n.message);
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

  // Risk tier helper
  function getRiskTier(s: CommunitySubmission): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
    const score = typeof s.riskScore === 'number' ? s.riskScore : NaN;
    if (Number.isNaN(score)) return 'UNKNOWN';
    if (score <= 30) return 'LOW';
    if (score <= 70) return 'MEDIUM';
    return 'HIGH';
  }

  const filteredSubmissions = useMemo(() => {
    // Adjust default sort for pending: verified journalist first
    const sorted = submissions.slice().sort((a, b) => {
      const aVerifiedJournalist = ((a as any).sourceType === 'journalist') && ((a as any).reporterVerificationLevel === 'verified');
      const bVerifiedJournalist = ((b as any).sourceType === 'journalist') && ((b as any).reporterVerificationLevel === 'verified');
      if (aVerifiedJournalist && !bVerifiedJournalist) return -1;
      if (!aVerifiedJournalist && bVerifiedJournalist) return 1;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime; // Newest first
    });
    return sorted
      .filter(s => {
        const status = String(s.status || '').toLowerCase();
        if (viewMode === 'pending') return status === 'pending';
        if (viewMode === 'rejected') return status === 'rejected';
        return true;
      })
      .filter(s => priorityFilter === 'ALL' ? true : s.priority === priorityFilter)
      .filter(s => {
        if (riskFilter === 'ALL') return true;
        if (riskFilter === 'FLAGGED') return Array.isArray(s.flags) && s.flags.length > 0;
        const tier = getRiskTier(s);
        return tier === riskFilter;
      })
      .filter(s => {
        if (sourceFilter === 'ALL') return true;
        const src = (s as any).sourceType as 'community'|'journalist'|undefined;
        const v = (s as any).reporterVerificationLevel as 'unverified'|'pending'|'verified'|undefined;
        if (sourceFilter === 'COMMUNITY') return (src !== 'journalist') || (v !== 'verified');
        // VERIFIED_JOURNALISTS
        return src === 'journalist' && v === 'verified';
      })
      .filter(s => aiPickOnly ? (s.aiHighlighted || (typeof s.aiTrendingScore === 'number' && s.aiTrendingScore > 0)) : true)
      .slice();
  }, [submissions, viewMode, priorityFilter, riskFilter, aiPickOnly, sourceFilter]);

  // Pending list for review mode
  const reviewPendingList = useMemo(() => filteredSubmissions.filter(s => s.status === 'pending'), [filteredSubmissions]);
  const currentReviewItem = reviewPendingList[reviewIndex];

  async function handleReviewAction(action: 'approve' | 'reject' | 'skip') {
    if (!currentReviewItem) return;
    if (action === 'skip') {
      setReviewIndex(i => i + 1);
      return;
    }
    await handleDecision(currentReviewItem.id, action === 'approve' ? 'approve' : 'reject');
    setReviewIndex(i => i + 1);
  }

  function openReporterProfile(s: CommunitySubmission) {
    setProfileSubmission(s);
    setProfileOpen(true);
  }

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
        {/* Risk filter bar */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-slate-600 mr-1">Risk:</span>
          {(['ALL','LOW','MEDIUM','HIGH','FLAGGED'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRiskFilter(r)}
              className={`px-2 py-1 text-xs rounded border ${riskFilter===r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300'}`}
              title={r==='FLAGGED' ? 'Stories with AI policy flags' : r==='ALL' ? 'Show all risk tiers' : `${r.charAt(0)+r.slice(1).toLowerCase()} risk stories`}
            >{r==='ALL' ? 'All' : r==='FLAGGED' ? 'Flagged' : r.charAt(0)+r.slice(1).toLowerCase()}</button>
          ))}
        </div>
        {/* Source filter bar */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-slate-600 mr-1">Source:</span>
          {(['ALL','COMMUNITY','VERIFIED_JOURNALISTS'] as const).map(sv => (
            <button
              key={sv}
              type="button"
              onClick={() => setSourceFilter(sv)}
              className={`px-2 py-1 text-xs rounded border ${sourceFilter===sv ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-700 border-slate-300'}`}
              title={sv==='VERIFIED_JOURNALISTS' ? 'Only verified journalist submissions' : sv==='COMMUNITY' ? 'Community reporters' : 'Show all sources'}
            >{sv==='ALL' ? 'All' : sv==='COMMUNITY' ? 'Community' : 'Verified journalists'}</button>
          ))}
        </div>
        {/* AI Pick toggle */}
        <label className="flex items-center gap-2 text-xs text-slate-600 ml-2">
          <input type="checkbox" checked={aiPickOnly} onChange={e=> setAiPickOnly(e.target.checked)} /> AI Picks only
        </label>
        {/* Review Mode button */}
        {!reviewMode && (
          <button
            type="button"
            onClick={()=> { setReviewMode(true); setReviewIndex(0); }}
            disabled={filteredSubmissions.filter(s=> s.status==='pending').length===0}
            className="px-3 py-1 rounded text-xs border bg-white text-slate-700 border-slate-300 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
            title="Sequentially review pending stories"
          >Start Review Mode</button>
        )}
        {reviewMode && (
          <button
            type="button"
            onClick={()=> setReviewMode(false)}
            className="px-3 py-1 rounded text-xs border bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
            title="Exit review mode"
          >Exit Review Mode</button>
        )}
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
      {/* Review Mode Panel */}
      {reviewMode && (
        <div className="mb-6 rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          {currentReviewItem ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold truncate max-w-[640px]" title={currentReviewItem.headline}>{currentReviewItem.headline || 'Untitled story'}</h2>
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200" title="Reporter">{currentReviewItem.reporterName || currentReviewItem.userName || currentReviewItem.name || 'Unknown reporter'}</span>
                    {typeof currentReviewItem.riskScore === 'number' && (
                      <span className={`px-2 py-0.5 rounded border text-[10px] ${(() => { const tier = getRiskTier(currentReviewItem); if (tier==='LOW') return 'bg-emerald-100 text-emerald-700 border-emerald-200'; if (tier==='MEDIUM') return 'bg-amber-100 text-amber-700 border-amber-200'; if (tier==='HIGH') return 'bg-red-100 text-red-700 border-red-200'; return 'bg-slate-100 text-slate-600 border-slate-200'; })()}`}
                        title={`Risk tier: ${getRiskTier(currentReviewItem)} (${currentReviewItem.riskScore})`}
                      >Risk {getRiskTier(currentReviewItem)} {currentReviewItem.riskScore}</span>
                    )}
                    {Array.isArray(currentReviewItem.flags) && currentReviewItem.flags.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[10px]" title={currentReviewItem.flags.join(', ')}>🚩 {currentReviewItem.flags.length} flag(s)</span>
                    )}
                    {currentReviewItem.aiHighlighted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px]" title="Highlighted by AI">
                        <Star className="w-3 h-3" /> AI Pick
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={()=> openReporterProfile(currentReviewItem)}
                  className="px-3 py-1.5 rounded text-xs border bg-white hover:bg-slate-50"
                >View Reporter</button>
              </div>
              <div className="text-sm max-h-[300px] overflow-auto whitespace-pre-wrap border rounded p-3 bg-slate-50" title="Story body">
                {currentReviewItem.body || 'No body provided.'}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={actionId === currentReviewItem.id}
                  onClick={()=> handleReviewAction('approve')}
                  className="px-4 py-1.5 text-sm rounded bg-green-600 text-white disabled:opacity-50"
                >Approve & Next</button>
                <button
                  disabled={actionId === currentReviewItem.id}
                  onClick={()=> handleReviewAction('reject')}
                  className="px-4 py-1.5 text-sm rounded bg-red-600 text-white disabled:opacity-50"
                >Reject & Next</button>
                <button
                  disabled={actionId === currentReviewItem.id}
                  onClick={()=> handleReviewAction('skip')}
                  className="px-4 py-1.5 text-sm rounded bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                >Skip</button>
                <div className="ml-auto text-xs text-slate-600 flex items-center gap-2">
                  <span>{reviewIndex + 1} / {reviewPendingList.length}</span>
                  <button
                    type="button"
                    onClick={()=> { setReviewIndex(0); }}
                    className="px-2 py-1 rounded border bg-white hover:bg-slate-50"
                    title="Restart from first pending story"
                  >Restart</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">No more pending stories match current filters. <button type="button" onClick={()=> setReviewMode(false)} className="underline">Exit review mode</button></div>
          )}
        </div>
      )}
      {internalLoading && <div className="mb-3 text-sm bg-slate-100 text-slate-700 px-3 py-2 rounded border border-slate-200">Loading…</div>}
      {error && !internalLoading && (
        <div className="mb-3 text-sm bg-red-100 text-red-700 px-3 py-2 rounded border border-red-200">
          Failed to load Community Reporter Queue. {error}
        </div>
      )}
      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Headline</th>
            <th className="p-2 text-left">Reporter</th>
            <th className="p-2 text-left">Location</th>
            <th className="p-2 text-left">Contact</th>
            <th className="p-2 text-left">Category</th>
            <th className="p-2 text-left">Priority</th>
            <th className="p-2 text-left">AI Risk</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Created At</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSubmissions.map(s => {
            const tier = getRiskTier(s);
            const isFlagged = Array.isArray(s.flags) && s.flags.length > 0;
            const rowHighlight = tier === 'MEDIUM' ? 'bg-amber-50' : tier === 'HIGH' ? 'bg-red-50' : '';
            return (
            <tr key={s.id} className={`border-t hover:bg-slate-50 ${rowHighlight}`}> 
              <td className="p-2 max-w-[220px] truncate" title={s.headline}>{s.headline || '—'}</td>
              <td className="p-2" title={s.reporterName || s.userName || s.name || 'Unknown reporter'}>
                <div className="flex flex-col gap-1 max-w-[240px]">
                  <span className="font-medium truncate">{s.reporterName || s.userName || s.name || 'Unknown reporter'}</span>
                  <div className="flex flex-wrap gap-1 items-center">
                    {/* Age group badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${toneToBadgeClasses((() => {
                        const grp = s.reporterAgeGroup || 'Age not provided';
                        if (grp.startsWith('Under 13')) return 'danger';
                        if (grp.startsWith('13–17')) return 'warning';
                        if (grp.startsWith('18+')) return 'success';
                        return 'neutral';
                      })())}`}
                      title={s.reporterAgeGroup}
                    >{s.reporterAgeGroup || 'Age not provided'}</span>
                    {s.reporterLocation && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200 max-w-[160px] truncate"
                        title={s.reporterLocation}
                      >{s.reporterLocation}</span>
                    )}
                    {/* Source chips */}
                    {(() => {
                      const sourceType = (s as any).sourceType as 'community'|'journalist'|undefined;
                      const v = (s as any).reporterVerificationLevel as 'community_default'|'pending'|'verified'|'limited'|'revoked'|'unverified'|undefined;
                      if (sourceType === 'journalist' && v === 'verified') {
                        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200" title="Verified Journalist">Verified Journalist ✅</span>;
                      }
                      if (sourceType === 'journalist' && (v === 'pending' || v === 'limited' || v === 'revoked' || v === 'unverified')) {
                        const label = v==='pending' ? 'pending' : v==='limited' ? 'limited' : v==='revoked' ? 'revoked' : 'unverified';
                        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-200" title={`Journalist (${label})`}>Journalist ({label})</span>;
                      }
                      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 border border-purple-200" title="Community Reporter">Community Reporter</span>;
                    })()}
                    {typeof (s as any).ethicsStrikes === 'number' && (s as any).ethicsStrikes > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-200" title={`Ethics strikes: ${(s as any).ethicsStrikes}`}>⚠ {(s as any).ethicsStrikes}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="p-2" title={norm(s.city || s.location)}>{norm(s.city || s.location) || '—'}</td>
              <td className="p-2" title={(s.contactEmail || s.contactPhone) ? `${s.contactEmail || ''} ${s.contactPhone || ''}`.trim() : ''}>
                <div className="flex flex-col gap-1 max-w-[180px]">
                  {s.contactName && <span className="truncate" title={s.contactName}>{s.contactName}</span>}
                  {(s.contactEmail || s.contactPhone) ? (
                    <span className="text-[11px] text-slate-600 truncate" title={`${s.contactEmail || ''} ${s.contactPhone || ''}`.trim()}>
                      {(s.contactEmail || '').trim()}{s.contactEmail && s.contactPhone ? ' · ' : ''}{(s.contactPhone || '').trim()}
                    </span>
                  ) : <span className="text-[11px] text-slate-400">—</span>}
                  {s.contactMethod && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200 w-max" title="Preferred contact method">{s.contactMethod}</span>}
                </div>
              </td>
              <td className="p-2" title={s.category}>{s.category || '—'}</td>
              <td className="p-2" title={s.priority || ''}>{formatPriorityLabel(s.priority)}</td>
              <td className="p-2">
                {typeof s.riskScore === 'number' ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const score = Math.max(0, Math.min(100, Number(s.riskScore || 0)));
                      const tierObj = tier === 'LOW' ? { label: 'Low', tone: 'success' } : tier === 'MEDIUM' ? { label: 'Medium', tone: 'warning' } : tier === 'HIGH' ? { label: 'High', tone: 'danger' } : { label: '—', tone: 'neutral' };
                      const flagsText = isFlagged ? (s.flags || []).join(', ') : 'No policy flags';
                      return (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${toneToBadgeClasses(tierObj.tone as any)}`}
                          title={`Risk: ${tierObj.label} (${score})\n${flagsText}`}
                        >{tierObj.label} <span className="ml-1 opacity-70">{score}</span></span>
                      );
                    })()}
                    {isFlagged && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-200"
                        title={(s.flags || []).join(', ')}
                      >🚩 {(s.flags || []).length} flags</span>
                    )}
                    {(s.aiHighlighted || (typeof s.aiTrendingScore === 'number' && s.aiTrendingScore > 0)) && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200"
                        title={`AI Pick${typeof s.aiTrendingScore === 'number' ? ` · trending score ${s.aiTrendingScore}` : ''}`}
                      ><Star className="w-3 h-3" /> AI Pick</span>
                    )}
                  </div>
                ) : <span className="text-slate-400">—</span>}
              </td>
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
                  {s.ptiComplianceStatus && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${s.ptiComplianceStatus==='pass' ? 'bg-green-100 text-green-700 border-green-200' : s.ptiComplianceStatus==='fail' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}
                      title={`PTI Compliance: ${s.ptiComplianceStatus}`}
                    >PTI {s.ptiComplianceStatus}</span>
                  )}
                  {typeof s.trustScore === 'number' && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200"
                      title={`Trust score: ${s.trustScore}`}
                    >Trust {s.trustScore}</span>
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
                    <>
                      <button
                        disabled={actionId === s.id}
                        onClick={()=> handleRestore(s.id)}
                        className="px-3 py-1 text-xs rounded bg-yellow-600 text-white disabled:opacity-60"
                      >Restore</button>
                      <button
                        disabled={actionId === s.id}
                        onClick={()=> handleHardDelete(s.id)}
                        className="px-3 py-1 text-xs rounded bg-red-700 text-white disabled:opacity-60"
                        title="Permanently remove"
                      >Delete forever</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );})}
          {!internalLoading && !error && filteredSubmissions.length === 0 && (
            <tr>
              <td colSpan={10} className="p-4 text-center text-slate-500">No stories found.</td>
            </tr>
          )}
        </tbody>
      </table>
      <ReporterProfileDrawer
        open={profileOpen}
        reporter={profileSubmission ? {
          id: profileSubmission.id,
          reporterKey: profileSubmission.email || profileSubmission.contactEmail || profileSubmission.contactPhone || profileSubmission.id,
            name: profileSubmission.reporterName || profileSubmission.userName || profileSubmission.name || null,
            email: profileSubmission.email || profileSubmission.contactEmail || null,
            phone: profileSubmission.contactPhone || null,
            city: profileSubmission.city || null,
            state: profileSubmission.state || null,
            country: profileSubmission.country || null,
            notes: undefined,
            totalStories: 0,
            pendingStories: 0,
            approvedStories: 0,
            lastStoryAt: profileSubmission.createdAt || new Date().toISOString()
        } : null}
        onClose={()=> { setProfileOpen(false); setProfileSubmission(null); }}
        onOpenStories={(key)=> {
          const qs = new URLSearchParams();
          if (key) qs.set('reporterKey', key);
          const name = profileSubmission?.reporterName || profileSubmission?.userName || profileSubmission?.name || '';
          if (name) qs.set('name', name);
          navigate(`/community/reporter-stories?${qs.toString()}`, { state: { reporterKey: key, reporterName: name } });
        }}
        onOpenQueue={(key)=> {
          navigate(`/community/reporter?reporterKey=${encodeURIComponent(key)}`);
          setProfileOpen(false);
        }}
      />
    </div>
  );
}
