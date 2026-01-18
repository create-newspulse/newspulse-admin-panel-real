import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotify } from '@/components/ui/toast-bridge';
import { useAuth } from '@context/AuthContext';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  approveTranslationOverride,
  approveTranslationJob,
  getTranslationJob,
  listTranslationJobs,
  rejectTranslationJob,
  retryTranslationJob,
  topReasonChips,
  translationJobKey,
  type TranslationJob,
  type TranslationJobStatus,
} from '@/api/translation';
import { AdminApiError } from '@/lib/http/adminFetch';

type Tab = 'broadcast' | 'news';

type Lang = 'en' | 'hi' | 'gu' | '';

type StatusFilter = TranslationJobStatus | 'ALL';

function clampText(s: string, max = 120) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function badgeClasses(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'APPROVED') return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800/40';
  if (s === 'READY') return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800/40';
  if (s === 'REVIEW_REQUIRED') return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/40';
  if (s === 'BLOCKED' || s === 'REJECTED') return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800/40';
  if (s === 'QUEUED') return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-800/40';
  if (s === 'RUNNING' || s === 'PROCESSING') return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-800/40';
  return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-700';
}

function apiErrText(e: unknown, fallback = 'API error') {
  if (e instanceof AdminApiError) {
    if (e.status) return `${fallback}: HTTP ${e.status} — ${e.message}`;
    return `${fallback}: ${e.message || 'Network error'}`;
  }
  const anyErr: any = e as any;
  return `${fallback}: ${anyErr?.message || String(e || '')}`;
}

function tokenizeWithSpaces(s: string): string[] {
  const out: string[] = [];
  const parts = String(s || '').split(/(\s+)/);
  for (const p of parts) {
    if (p === '') continue;
    out.push(p);
  }
  return out;
}

function DiffPreview(props: { a: string; b: string; aLabel?: string; bLabel?: string }) {
  const a = String(props.a || '');
  const b = String(props.b || '');
  if (a.trim() === b.trim()) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">No changes</div>;
  }

  const ta = tokenizeWithSpaces(a);
  const tb = tokenizeWithSpaces(b);
  const max = Math.max(ta.length, tb.length);

  const renderLine = (tokens: string[], other: string[]) => (
    <div className="whitespace-pre-wrap text-sm leading-6">
      {tokens.map((t, i) => {
        const same = t === other[i];
        const isSpace = /^\s+$/.test(t);
        if (isSpace) return <span key={i}>{t}</span>;
        return (
          <span
            key={i}
            className={same ? '' : 'rounded bg-yellow-100 dark:bg-yellow-900/20 px-1'}
          >
            {t}
          </span>
        );
      })}
      {tokens.length < max ? <span className="rounded bg-yellow-100 dark:bg-yellow-900/20 px-1">…</span> : null}
    </div>
  );

  const otherA = tb.slice(0, ta.length);
  const otherB = ta.slice(0, tb.length);

  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{props.aLabel || 'Generated'}</div>
        <div className="text-slate-900 dark:text-slate-100">{renderLine(ta, otherA)}</div>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{props.bLabel || 'Override'}</div>
        <div className="text-slate-900 dark:text-slate-100">{renderLine(tb, otherB)}</div>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">Highlights mark changed tokens (best-effort).</div>
    </div>
  );
}

function JobDetailsModal(props: {
  open: boolean;
  jobId: string;
  onClose: () => void;
  onDidMutate: () => void;
}) {
  const notify = useNotify();
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const isFounder = role === 'founder';
  const canDecide = role === 'founder' || role === 'admin' || role === 'owner';

  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<TranslationJob | null>(null);
  const [activeText, setActiveText] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRetryOpen, setConfirmRetryOpen] = useState(false);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmApproveJobOpen, setConfirmApproveJobOpen] = useState(false);
  const [confirmRejectJobOpen, setConfirmRejectJobOpen] = useState(false);

  const load = useCallback(async () => {
    if (!props.open) return;
    const id = String(props.jobId || '').trim();
    if (!id) return;

    setLoading(true);
    try {
      const data = await getTranslationJob(id);
      setJob(data);
      setActiveText(String(data.generatedText || ''));
      setNotes('');
    } catch (e: any) {
      notifyRef.current.err('Failed to load job', apiErrText(e, 'Job load failed'));
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [props.open, props.jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async () => {
    const id = String(props.jobId || '').trim();
    if (!id) return;

    setConfirmRetryOpen(false);
    setSaving(true);
    try {
      await retryTranslationJob(id);
      notifyRef.current.ok('Retry queued ✅');
      props.onDidMutate();
      await load();
    } catch (e: any) {
      notifyRef.current.err('Retry failed', apiErrText(e, 'Retry failed'));
    } finally {
      setSaving(false);
    }
  };

  const approveOverride = async () => {
    if (!job) return;
    const overrideText = String(activeText || '').trim();
    if (!overrideText) {
      notifyRef.current.err('Override text is empty', 'Enter the final translation text before approving.');
      return;
    }

    setConfirmApproveOpen(false);
    setSaving(true);
    try {
      const targetLang = String(job.targetLang || '').trim() || 'en';
      await approveTranslationOverride({
        jobId: job.id || job._id,
        entityType: job.entityType,
        entityId: job.entityId,
        sourceLang: job.sourceLang,
        targetLang,
        beforeText: String(job.generatedText || ''),
        overrideText,
        notes: String(notes || '').trim() || undefined,
      });
      notifyRef.current.ok('Override approved ✅');
      props.onDidMutate();
      await load();
    } catch (e: any) {
      notifyRef.current.err('Approve failed', apiErrText(e, 'Approve failed'));
    } finally {
      setSaving(false);
    }
  };

  const approveAsIs = async () => {
    const id = String(props.jobId || '').trim();
    if (!id) return;
    setConfirmApproveJobOpen(false);
    setSaving(true);
    try {
      await approveTranslationJob(id, { notes: String(notes || '').trim() || undefined });
      notifyRef.current.ok('Approved ✅');
      props.onDidMutate();
      await load();
    } catch (e: any) {
      notifyRef.current.err('Approve failed', apiErrText(e, 'Approve failed'));
    } finally {
      setSaving(false);
    }
  };

  const rejectJob = async () => {
    const id = String(props.jobId || '').trim();
    if (!id) return;
    setConfirmRejectJobOpen(false);
    setSaving(true);
    try {
      await rejectTranslationJob(id, { notes: String(notes || '').trim() || undefined });
      notifyRef.current.ok('Rejected ✅');
      props.onDidMutate();
      await load();
    } catch (e: any) {
      notifyRef.current.err('Reject failed', apiErrText(e, 'Reject failed'));
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100">Translation Job</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{props.jobId}</div>
          </div>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded border bg-white hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
            onClick={props.onClose}
            disabled={saving}
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-300">Loading…</div>
        ) : !job ? (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-300">No job loaded</div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClasses(job.status || '')}`}>{String(job.status || 'UNKNOWN')}</span>
              {job.qualityScore != null ? (
                <span className="text-xs text-slate-600 dark:text-slate-300">Quality: {Number(job.qualityScore).toFixed(2)}</span>
              ) : null}
              {job.engineUsed ? (
                <span className="text-xs text-slate-600 dark:text-slate-300">Engine: {job.engineUsed}</span>
              ) : null}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {String(job.sourceLang || '—')} → {String(job.targetLang || '—')}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Source</div>
                <div className="p-3 whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">{job.sourceText || '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Generated</div>
                <div className="p-3 whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">{job.generatedText || '—'}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Diff (source ↔ translated)</div>
              <div className="p-3">
                <DiffPreview a={String(job.sourceText || '')} b={String(job.generatedText || '')} aLabel="Source" bLabel="Translated" />
              </div>
              <div className="px-3 pb-3 text-xs text-slate-500 dark:text-slate-400">
                Note: cross-language diffs are best-effort and can look noisy.
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Reasons</div>
              <div className="p-3 flex flex-wrap gap-2">
                {(job.reasons || []).length === 0 ? (
                  <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
                ) : (
                  (job.reasons || []).map((r, idx) => (
                    <span
                      key={`${idx}:${r.code || r.message || ''}`}
                      className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                      title={r.detail || r.message || r.code}
                    >
                      {r.code || r.message || `Reason ${idx + 1}`}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {job.entityType ? `${job.entityType}` : 'Entity'}{job.entityId ? ` • ${job.entityId}` : ''}{job.headline ? ` • ${clampText(job.headline, 80)}` : ''}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-sm px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                  onClick={() => setConfirmRetryOpen(true)}
                  disabled={saving}
                >
                  Retry
                </button>
                {canDecide ? (
                  <>
                    <button
                      type="button"
                      className="text-sm px-3 py-2 rounded border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800/40 dark:bg-slate-950 dark:text-red-200 dark:hover:bg-red-900/10"
                      onClick={() => setConfirmRejectJobOpen(true)}
                      disabled={saving}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      onClick={() => setConfirmApproveJobOpen(true)}
                      disabled={saving}
                    >
                      Approve as-is
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Notes (optional)</div>
              <div className="p-3">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Optional notes for audit log / review history…"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Edit Translation</div>
              <div className="p-3 space-y-2">
                {!canDecide ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">You don’t have permission to approve/edit/reject this job.</div>
                ) : (
                  <>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Diff (generated → edited)</div>
                      <DiffPreview a={String(job.generatedText || '')} b={String(activeText || '')} aLabel="Generated" bLabel="Edited" />
                    </div>
                    <textarea
                      rows={6}
                      value={activeText}
                      onChange={(e) => setActiveText(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      placeholder="Edit the final translation text…"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {isFounder ? 'Founder override uses /override endpoint.' : 'If backend restricts overrides to Founder, this may fail.'}
                      </div>
                      <button
                        type="button"
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                        onClick={() => setConfirmApproveOpen(true)}
                        disabled={saving}
                      >
                        Approve edited
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          open={confirmRetryOpen}
          title="Retry translation job?"
          description="This will re-run the translation pipeline for this job."
          confirmLabel="Retry"
          onConfirm={() => { void retry(); }}
          onCancel={() => setConfirmRetryOpen(false)}
        />

        <ConfirmModal
          open={confirmApproveOpen}
          title="Approve edited translation?"
          description="This will approve the edited translation (override) and record an audit entry (backend)."
          confirmLabel="Approve"
          onConfirm={() => { void approveOverride(); }}
          onCancel={() => setConfirmApproveOpen(false)}
        />

        <ConfirmModal
          open={confirmApproveJobOpen}
          title="Approve translation as-is?"
          description="This will approve the generated translation without edits."
          confirmLabel="Approve"
          onConfirm={() => { void approveAsIs(); }}
          onCancel={() => setConfirmApproveJobOpen(false)}
        />

        <ConfirmModal
          open={confirmRejectJobOpen}
          title="Reject translation?"
          description="This will mark the job as rejected/blocked and keep it out of READY."
          confirmLabel="Reject"
          onConfirm={() => { void rejectJob(); }}
          onCancel={() => setConfirmRejectJobOpen(false)}
        />
      </div>
    </div>
  );
}

export default function TranslationReviewPage() {
  const notify = useNotify();
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

  const [tab, setTab] = useState<Tab>('broadcast');
  const [status, setStatus] = useState<StatusFilter>('BLOCKED');
  const [lang, setLang] = useState<Lang>('');
  const [q, setQ] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<TranslationJob[]>([]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');

  const effectiveEntityType = useMemo(() => {
    if (tab === 'broadcast') return 'broadcast';
    if (tab === 'news') return 'news';
    return '';
  }, [tab]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await listTranslationJobs({
        status: status === 'ALL' ? undefined : status,
        lang: lang || undefined,
        entityType: effectiveEntityType,
        q: q.trim() || undefined,
      });
      setJobs(data);
    } catch (e: any) {
      notifyRef.current.err('Failed to load jobs', apiErrText(e, 'Load failed'));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [effectiveEntityType, lang, q, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDetails = (job: TranslationJob) => {
    const id = String(job.id || job._id || '').trim();
    if (!id) {
      notifyRef.current.err('Missing job id', 'This job has no id/_id.');
      return;
    }
    setSelectedJobId(id);
    setDetailsOpen(true);
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((j) => {
      const hay = [j.entityType, j.entityId, j.headline, j.snippet, j.sourceLang, j.targetLang, j.status, j.engineUsed]
        .map((x) => String(x || '').toLowerCase())
        .join('\n');
      return hay.includes(needle);
    });
  }, [jobs, q]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">🧾 Translation Review</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Filter by status, review diffs, and approve/edit/reject translations.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            disabled={refreshing}
            onClick={() => refresh().catch(() => null)}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={
            tab === 'broadcast'
              ? 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900'
              : 'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
          }
          onClick={() => setTab('broadcast')}
        >
          Broadcast
        </button>
        <button
          type="button"
          className={
            tab === 'news'
              ? 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900'
              : 'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
          }
          onClick={() => setTab('news')}
          title="News tab scaffolding (Phase 2+: backend support needed)"
        >
          News
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="QUEUED">QUEUED</option>
            <option value="RUNNING">RUNNING</option>
            <option value="READY">READY</option>
            <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="ALL">ALL</option>
          </select>

          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            title="Target language"
          >
            <option value="">All langs</option>
            <option value="en">en</option>
            <option value="hi">hi</option>
            <option value="gu">gu</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entity/id/headline/engine…"
            className="w-full sm:w-[360px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">Showing {visible.length} of {jobs.length}</div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-0 dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-300">Loading…</div>
        ) : tab === 'news' ? (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-300">
            News jobs UI is scaffolded; backend needs to emit `entityType=news` jobs for this tab.
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-300">No jobs found</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Entity</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Lang</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Quality</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Engine</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Top reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {visible.map((j) => (
                  <tr
                    key={translationJobKey(j)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40"
                    onClick={() => openDetails(j)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{j.entityType || 'entity'} {j.entityId ? `• ${j.entityId}` : ''}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{clampText(j.headline || j.snippet || j.sourceText || '', 110) || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {String(j.sourceLang || '—')} → {String(j.targetLang || '—')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClasses(j.status || '')}`}>{String(j.status || 'UNKNOWN')}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {j.qualityScore != null ? Number(j.qualityScore).toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{j.engineUsed || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {topReasonChips(j, 4).length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          topReasonChips(j, 4).map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                            >
                              {c}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <JobDetailsModal
        open={detailsOpen}
        jobId={selectedJobId}
        onClose={() => setDetailsOpen(false)}
        onDidMutate={() => { void refresh(); }}
      />
    </div>
  );
}
