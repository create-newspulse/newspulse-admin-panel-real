import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { getArticle, listArticles, type Article } from '@/lib/api/articles';
import { useAuth } from '@/context/AuthContext';
import {
  addInternalComment,
  listInternalComments,
  listWorkflowEvents,
  mapArticleToStage,
  publishFromWorkflow,
  setWorkflowLocked,
  setWorkflowStage,
  type InternalComment,
  type WorkflowEvent,
  type WorkflowStageKey,
  type WorkflowState,
} from '@/lib/api/workflow';

const STAGES: WorkflowStageKey[] = ['Draft', 'CopyEdit', 'LegalReview', 'EditorApproval', 'FounderApproval', 'Scheduled'];

const STAGE_LABEL: Record<WorkflowStageKey, string> = {
  Draft: 'Draft',
  CopyEdit: 'Copy Edit',
  LegalReview: 'Legal Review',
  EditorApproval: 'Editor Approval',
  FounderApproval: 'Founder Approval',
  Scheduled: 'Scheduled',
};

const SLA_HOURS: Record<WorkflowStageKey, number> = {
  Draft: Number(import.meta.env.VITE_WORKFLOW_SLA_DRAFT_HOURS || 24),
  CopyEdit: Number(import.meta.env.VITE_WORKFLOW_SLA_COPYEDIT_HOURS || 8),
  LegalReview: Number(import.meta.env.VITE_WORKFLOW_SLA_LEGAL_HOURS || 12),
  EditorApproval: Number(import.meta.env.VITE_WORKFLOW_SLA_EDITOR_HOURS || 8),
  FounderApproval: Number(import.meta.env.VITE_WORKFLOW_SLA_FOUNDER_HOURS || 24),
  Scheduled: Number(import.meta.env.VITE_WORKFLOW_SLA_SCHEDULED_HOURS || 240),
};

function safeIso(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalMinutes = Math.floor(ms / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (totalHours > 0) return `${totalHours}h ${minutes}m`;
  return `${totalMinutes}m`;
}

function deriveRiskLevel(trustScore?: number | null): 'Low' | 'Medium' | 'High' | 'Unknown' {
  if (trustScore == null || !Number.isFinite(trustScore)) return 'Unknown';
  if (trustScore >= 80) return 'Low';
  if (trustScore >= 50) return 'Medium';
  return 'High';
}

function roleCaps(roleRaw: any) {
  const role = String(roleRaw || '').toLowerCase();
  const isFounder = role === 'founder';
  const isEditor = isFounder || role === 'admin' || role === 'editor';
  const isStaff = !isEditor;
  return { role, isFounder, isEditor, isStaff };
}

function canMoveToStage(caps: ReturnType<typeof roleCaps>, from: WorkflowStageKey, to: WorkflowStageKey): { ok: boolean; reason?: string } {
  if (caps.isStaff) {
    const allowed = new Set<WorkflowStageKey>(['Draft', 'CopyEdit']);
    if (!allowed.has(from) || !allowed.has(to)) return { ok: false, reason: 'Staff: Draft/CopyEdit only' };
  }
  if (caps.isEditor && !caps.isFounder) {
    if (from === 'FounderApproval' || to === 'FounderApproval') return { ok: false, reason: 'Editor: cannot use Founder Approval stage' };
  }
  return { ok: true };
}

function nextStageFor(caps: ReturnType<typeof roleCaps>, stage: WorkflowStageKey): WorkflowStageKey | null {
  if (stage === 'Scheduled') return null;
  if (stage === 'EditorApproval' && caps.isEditor && !caps.isFounder) return 'Scheduled';
  const idx = STAGES.indexOf(stage);
  return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
}

function prevStageFor(caps: ReturnType<typeof roleCaps>, stage: WorkflowStageKey): WorkflowStageKey | null {
  if (stage === 'Draft') return null;
  if (stage === 'Scheduled' && caps.isEditor && !caps.isFounder) return 'EditorApproval';
  const idx = STAGES.indexOf(stage);
  return idx > 0 ? STAGES[idx - 1] : null;
}

function stageTimestamp(article: Article, state?: WorkflowState | null): string | null {
  return (
    safeIso(state?.stageUpdatedAt)
    || safeIso((article as any)?.workflow?.stageUpdatedAt)
    || safeIso(article.updatedAt)
    || safeIso(article.createdAt)
    || null
  );
}

function isLocked(article: Article, state?: WorkflowState | null): boolean {
  const a = (article as any)?.workflow?.locked;
  return !!(state?.locked ?? a);
}

export default function EditorialWorkflowEngine() {
  const { user } = useAuth();
  const caps = roleCaps(user?.role);

  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [onlyFounder, setOnlyFounder] = useState(false);
  const [backendNotReady, setBackendNotReady] = useState(false);

  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFull, setActiveFull] = useState<Article | null>(null);
  const [stateById, setStateById] = useState<Record<string, WorkflowState | undefined>>({});
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [comments, setComments] = useState<InternalComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [publishChannel, setPublishChannel] = useState('web');

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listArticles({ status: 'all', page: 1, limit: 200, sort: '-updatedAt' });
      const rows: Article[] = (res as any)?.rows || [];
      const filtered = (Array.isArray(rows) ? rows : []).filter((a) => {
        const st = String(a.status || '').toLowerCase();
        return st !== 'deleted' && st !== 'archived' && st !== 'published';
      });
      setItems(filtered);
      setBackendNotReady(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to load review queue');
      toast.error(e?.message || 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadActive() {
      if (!activeId) {
        setActiveFull(null);
        setEvents([]);
        setComments([]);
        return;
      }
      try {
        const [a, ev, cm] = await Promise.all([
          getArticle(activeId),
          listWorkflowEvents(activeId).catch(() => []),
          listInternalComments(activeId).catch(() => []),
        ]);
        if (cancelled) return;
        setActiveFull(a);
        setEvents(ev);
        setComments(cm);
      } catch (e: any) {
        if (cancelled) return;
        toast.error(e?.message || 'Failed to load article');
      }
    }
    loadActive();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const now = Date.now();
  const enriched = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items
      .filter((a) => {
        if (!query) return true;
        const t = String(a.title || '').toLowerCase();
        const id = String(a._id || '').toLowerCase();
        return t.includes(query) || id.includes(query);
      })
      .map((a) => {
        const stage = mapArticleToStage({
          status: a.status,
          workflowStage: (a as any)?.workflow?.stage,
          scheduledAt: a.scheduledAt,
        });
        const state = stateById[a._id];
        const stageAt = stageTimestamp(a, state);
        const ms = stageAt ? now - new Date(stageAt).getTime() : NaN;
        const stuck = Number.isFinite(ms) && ms > (SLA_HOURS[stage] * 60 * 60 * 1000);
        return { article: a, stage, state, stageAt, ms, stuck };
      });
  }, [items, q, now, stateById]);

  const byStage = useMemo(() => {
    const map: Record<WorkflowStageKey, typeof enriched> = {
      Draft: [],
      CopyEdit: [],
      LegalReview: [],
      EditorApproval: [],
      FounderApproval: [],
      Scheduled: [],
    };
    enriched.forEach((x) => map[x.stage].push(x));
    return map;
  }, [enriched]);

  const simpleDrafts = useMemo(() => {
    // Drafts-to-review = everything not scheduled.
    const rows = enriched.filter((x) => x.stage !== 'Scheduled');
    if (!onlyFounder) return rows;
    // In Simple Mode, filter the Draft list to only founder-required items.
    return rows.filter((x) => x.stage === 'FounderApproval');
  }, [enriched, onlyFounder]);

  const simpleScheduled = useMemo(() => enriched.filter((x) => x.stage === 'Scheduled'), [enriched]);

  async function move(articleId: string, from: WorkflowStageKey, to: WorkflowStageKey) {
    const a = items.find((x) => x._id === articleId);
    if (!a) return;

    const locked = isLocked(a, stateById[articleId]);
    if (locked && !caps.isFounder) {
      toast.error('Story is locked (founder-only)');
      return;
    }

    const gate = canMoveToStage(caps, from, to);
    if (!gate.ok) {
      toast.error(gate.reason || 'Not allowed');
      return;
    }

    setBusyAction(`stage:${articleId}`);
    try {
      const st = await setWorkflowStage(articleId, to);
      setStateById((prev) => ({ ...prev, [articleId]: st }));
      toast.success(`Moved to ${STAGE_LABEL[to]}`);
      if (activeId === articleId) setEvents(await listWorkflowEvents(articleId).catch(() => []));
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setBackendNotReady(true);
        toast.error('Backend endpoint not ready');
        return;
      }
      toast.error(e?.response?.data?.message || e?.message || 'Move failed');
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleLock(articleId: string, nextLocked: boolean) {
    setBusyAction(`lock:${articleId}`);
    try {
      const st = await setWorkflowLocked(articleId, nextLocked);
      setStateById((prev) => ({ ...prev, [articleId]: st }));
      toast.success(nextLocked ? 'Locked' : 'Unlocked');
      if (activeId === articleId) setEvents(await listWorkflowEvents(articleId).catch(() => []));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Lock change failed');
    } finally {
      setBusyAction(null);
    }
  }

  async function submitComment() {
    if (!activeId) return;
    const msg = commentDraft.trim();
    if (!msg) return;

    setBusyAction(`comment:${activeId}`);
    try {
      await addInternalComment(activeId, msg);
      setCommentDraft('');
      const cm = await listInternalComments(activeId).catch(() => []);
      setComments(cm);
      const ev = await listWorkflowEvents(activeId).catch(() => []);
      setEvents(ev);
      toast.success('Comment added');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to add comment');
    } finally {
      setBusyAction(null);
    }
  }

  async function publishActive() {
    if (!activeId) return;
    setBusyAction(`publish:${activeId}`);
    try {
      await publishFromWorkflow(activeId, publishChannel);
      toast.success('Published');
      await refresh();
      setActiveId(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Publish failed');
    } finally {
      setBusyAction(null);
    }
  }

  const activeStage: WorkflowStageKey | null = useMemo(() => {
    if (!activeId) return null;
    const a = items.find((x) => x._id === activeId);
    if (!a) return null;
    return mapArticleToStage({ status: a.status, workflowStage: (a as any)?.workflow?.stage, scheduledAt: a.scheduledAt });
  }, [activeId, items]);

  const activeLocked = useMemo(() => {
    if (!activeId) return false;
    const a = items.find((x) => x._id === activeId);
    if (!a) return false;
    return isLocked(a, stateById[activeId]);
  }, [activeId, items, stateById]);

  const activeRisk = deriveRiskLevel(activeFull?.trustScore ?? null);
  const activeImg = (
    (activeFull as any)?.coverImage?.url ||
    (typeof (activeFull as any)?.coverImage === 'string' ? (activeFull as any)?.coverImage : null) ||
    activeFull?.imageUrl ||
    (activeFull as any)?.coverImageUrl ||
    null
  ) as string | null;
  const activeSnippet = String(activeFull?.content || '').slice(0, 650);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-white">Review Queue (Advanced)</div>
          <div className="text-sm text-slate-600 dark:text-slate-300">This is the approval pipeline. Only stories in this pipeline need review before going live.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyFounder((v) => !v)}
            className={
              'rounded-md border px-3 py-2 text-sm font-semibold ' +
              (onlyFounder
                ? 'border-amber-600 bg-amber-600 text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800')
            }
          >
            Only Founder Approval
          </button>

          <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Simple</span>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'simple' ? 'advanced' : 'simple'))}
              className={
                'relative inline-flex h-5 w-10 items-center rounded-full transition ' +
                (mode === 'advanced' ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700')
              }
              aria-label="Toggle advanced mode"
            >
              <span
                className={
                  'inline-block h-4 w-4 transform rounded-full bg-white transition ' +
                  (mode === 'advanced' ? 'translate-x-5' : 'translate-x-1')
                }
              />
            </button>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Advanced</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <details className="text-sm text-slate-700 dark:text-slate-200">
          <summary className="cursor-pointer select-none font-semibold text-slate-900 dark:text-slate-100">What is this?</summary>
          <div className="mt-2 space-y-1">
            <div>• Used for team approvals</div>
            <div>• Used for PTI/legal review stages</div>
            <div>• Used for Community Reporter moderation</div>
          </div>
        </details>
      </div>

      {backendNotReady ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          Backend endpoint not ready — some workflow actions may be unavailable.
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Board</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by title or id…"
                  className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {(mode === 'advanced'
                ? STAGES
                : (['Draft', 'Scheduled'] as WorkflowStageKey[])
              ).map((stage) => {
                const isSimpleDrafts = mode === 'simple' && stage === 'Draft';
                const isSimpleScheduled = mode === 'simple' && stage === 'Scheduled';

                let col = mode === 'advanced' ? byStage[stage] : [];
                if (isSimpleDrafts) col = simpleDrafts as any;
                if (isSimpleScheduled) col = simpleScheduled as any;

                if (mode === 'advanced' && onlyFounder) {
                  // In Advanced Mode, highlight founder column and filter everything else.
                  col = stage === 'FounderApproval' ? (byStage[stage] as any) : ([] as any);
                }

                const empty = !loading && col.length === 0;
                const colLabel = mode === 'simple' && stage === 'Draft'
                  ? 'Drafts to Review'
                  : mode === 'simple' && stage === 'Scheduled'
                    ? 'Scheduled'
                    : STAGE_LABEL[stage];

                const highlightFounderCol = mode === 'advanced' && onlyFounder && stage === 'FounderApproval';

                return (
                  <div key={stage} className="min-w-[260px] max-w-[260px]">
                    <div className="flex items-center justify-between">
                      <div className={
                        'text-sm font-semibold ' +
                        (highlightFounderCol
                          ? 'text-amber-800 dark:text-amber-200'
                          : 'text-slate-900 dark:text-slate-100')
                      }>
                        {colLabel}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{loading ? '…' : col.length}</div>
                    </div>

                    <div className={
                      'mt-2 space-y-2 rounded-lg ' +
                      (highlightFounderCol ? 'border border-amber-300 bg-amber-50/40 p-2 dark:border-amber-700 dark:bg-amber-900/10' : '')
                    }>
                      {loading ? (
                        <>
                          {[0, 1, 2].map((k) => (
                            <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                              <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                            </div>
                          ))}
                        </>
                      ) : empty ? (
                        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                          No items in {colLabel}.
                        </div>
                      ) : (
                        col.map(({ article, stage: curStage, ms, stuck }) => {
                          const locked = isLocked(article, stateById[article._id]);
                          const active = activeId === article._id;
                          const trust = article.trustScore;
                          const risk = deriveRiskLevel(trust ?? null);

                          const next = nextStageFor(caps, curStage);
                          const prev = prevStageFor(caps, curStage);
                          const nextGate = next ? canMoveToStage(caps, curStage, next) : { ok: false };
                          const prevGate = prev ? canMoveToStage(caps, curStage, prev) : { ok: false };

                          return (
                            <div
                              key={article._id}
                              className={
                                'rounded-lg border p-3 ' +
                                (active
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/25'
                                  : stuck
                                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20'
                                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950')
                              }
                            >
                              <button
                                type="button"
                                onClick={() => setActiveId(article._id)}
                                className="w-full text-left"
                              >
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{article.title}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                  <span>#{article._id.slice(-6)}</span>
                                  {locked ? (
                                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900">Locked</span>
                                  ) : null}
                                  {article.ptiCompliance ? (
                                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900">PTI: {String(article.ptiCompliance)}</span>
                                  ) : null}
                                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900">Risk: {risk}</span>
                                </div>
                                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Time in stage: {formatDuration(ms)}</div>
                              </button>

                              <div className="mt-2 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  disabled={!prev || busyAction === `stage:${article._id}` || (prev && !prevGate.ok)}
                                  onClick={() => prev && move(article._id, curStage, prev)}
                                  className={
                                    'rounded-md border px-2 py-1 text-xs ' +
                                    (!prev || (prev && !prevGate.ok)
                                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900')
                                  }
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  disabled={!next || busyAction === `stage:${article._id}` || (next && !nextGate.ok) || (locked && !caps.isFounder)}
                                  onClick={() => next && move(article._id, curStage, next)}
                                  className={
                                    'rounded-md border px-2 py-1 text-xs ' +
                                    (!next || (next && !nextGate.ok) || (locked && !caps.isFounder)
                                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                                      : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500')
                                  }
                                >
                                  Approve &amp; Move Next
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}

              {mode === 'simple' ? (
                <div className="min-w-[260px] max-w-[260px]">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Published Log</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">—</div>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      View publish activity in Push History.
                      <div className="mt-2">
                        <Link
                          to="/push-history"
                          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                        >
                          Open Push History
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Inspector</div>

            {!activeId ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                Select an article to view details.
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">{activeFull?.title || 'Loading…'}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Article ID: {activeId}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    Stage: {activeStage ? STAGE_LABEL[activeStage] : '—'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    PTI: {activeFull?.ptiCompliance ? String(activeFull.ptiCompliance) : 'Unknown'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    Trust: {activeFull?.trustScore != null ? String(activeFull.trustScore) : '—'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    Risk: {activeRisk}
                  </span>
                  {activeLocked ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
                      Locked
                    </span>
                  ) : null}
                </div>

                {activeImg ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
                    <img alt="Cover" src={activeImg} className="h-40 w-full rounded object-cover" />
                  </div>
                ) : null}

                {activeFull?.summary ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Summary</div>
                    <div className="mt-1 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{activeFull.summary}</div>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Content snippet</div>
                  <div className="mt-1 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
                    {activeSnippet ? `${activeSnippet}${String(activeFull?.content || '').length > activeSnippet.length ? '…' : ''}` : '—'}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Permissions</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Role: {caps.role || 'unknown'}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {caps.isFounder
                      ? 'Founder: lock/unlock, delete all push history, final approve to publish.'
                      : caps.isEditor
                        ? 'Editor: move stages except Founder Approval.'
                        : 'Staff: Draft/CopyEdit only.'}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Lock</div>
                    <button
                      type="button"
                      disabled={!caps.isFounder || busyAction === `lock:${activeId}`}
                      onClick={() => toggleLock(activeId, !activeLocked)}
                      className={
                        'rounded-md border px-3 py-2 text-sm ' +
                        (!caps.isFounder
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                          : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900')
                      }
                    >
                      {activeLocked ? 'Unlock' : 'Lock'}
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Founder-only. Lock blocks non-founder stage moves.</div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">History timeline</div>
                  {events.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">No history yet.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {events.slice(0, 15).map((e) => (
                        <div key={e.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-800 dark:bg-slate-950">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{e.action}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(e.at).toLocaleString()}</div>
                          </div>
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {e.actor?.email || e.actor?.name || 'Unknown user'}
                            {e.fromStage || e.toStage ? ` • ${e.fromStage || '—'} → ${e.toStage || '—'}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Internal comments</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Add an internal comment…"
                      className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={busyAction === `comment:${activeId}` || commentDraft.trim().length === 0}
                      onClick={submitComment}
                      className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                  {comments.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">No comments.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {comments.slice(0, 10).map((c) => (
                        <div key={c.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-800 dark:bg-slate-950">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-slate-600 dark:text-slate-300">{c.actor?.email || c.actor?.name || 'Unknown user'}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(c.at).toLocaleString()}</div>
                          </div>
                          <div className="mt-1 text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{c.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Publish</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Founder-only</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={publishChannel}
                      onChange={(e) => setPublishChannel(e.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      disabled={!caps.isFounder}
                    >
                      <option value="web">web</option>
                      <option value="app">app</option>
                      <option value="push">push</option>
                    </select>
                    <button
                      type="button"
                      disabled={!caps.isFounder || busyAction === `publish:${activeId}`}
                      onClick={publishActive}
                      className={
                        'rounded-md border px-3 py-2 text-sm font-semibold ' +
                        (!caps.isFounder
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                          : 'border-red-600 bg-red-600 text-white hover:bg-red-500')
                      }
                    >
                      Final approve & publish
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Logs a push event from the publish action.</div>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
