import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { getArticleRestoreEligibility, restoreArticle, type Article, type ArticleRestoreEligibility } from '@/lib/api/articles';
import {
  articleRestoreAccessDenial, articleRestoreDenial, ArticleRestoreGuardError, ArticleRestoreUnconfirmedError,
  normalizeRestoreError, type ArticleRestoreAccess,
} from '@/lib/articleLifecycle';

const ASSESSMENT_LIFETIME_MS = 30_000;
type Receipt = { id: string; version: number; checkedAt: number; assessment?: ArticleRestoreEligibility; message?: string };
type Attempt = { state: 'pending' | 'committed' | 'unconfirmed'; deletedAt: string | null };

export function useArticleRestore({ access, rows, viewKey, disabled = false }: {
  access: ArticleRestoreAccess;
  rows: readonly Article[];
  viewKey: string;
  disabled?: boolean;
}) {
  const { user, isAuthenticated } = useAuth();
  const client = useQueryClient();
  const actor = user?.id || user?._id || '';
  const scope = JSON.stringify([
    actor, user?.role, isAuthenticated, access, viewKey, disabled,
    rows.map(row => [row._id, row.status, row.deletedAt, row.updatedAt, row.translationGroupId, row.translationKey, row.language, row.sourceNewsId]),
  ]);
  const revision = useRef({ scope, version: 0 });
  if (revision.current.scope !== scope) revision.current = { scope, version: revision.current.version + 1 };
  const renderVersion = revision.current.version;
  const live = useRef({ access, rows, disabled, actor, isAuthenticated });
  live.current = { access, rows, disabled, actor, isAuthenticated };
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    controller.current?.abort();
    setReceipt(null);
  }, [scope]);
  useEffect(() => {
    for (const row of rows) {
      if (!row.status || row.status === 'deleted') continue;
      const key = ['article-restore-attempt', actor, row._id];
      if (client.getQueryData<Attempt>(key)?.state === 'committed') {
        client.removeQueries({ queryKey: key, exact: true });
      }
    }
  }, [rows, actor, client]);
  useEffect(() => {
    if (!receipt?.assessment) return;
    const timer = window.setTimeout(() => setReceipt(current => current === receipt ? null : current),
      Math.max(0, ASSESSMENT_LIFETIME_MS - (Date.now() - receipt.checkedAt)));
    return () => window.clearTimeout(timer);
  }, [receipt]);

  const articleFor = (id: string) => live.current.rows.find(row => row._id === id);
  const attemptKey = (id: string) => ['article-restore-attempt', actor, id] as const;
  const attemptDenial = (article: Article | undefined): string | null => {
    if (!article) return null;
    const attempt = client.getQueryData<Attempt>(attemptKey(article._id));
    if (!attempt) return null;
    if (attempt.state === 'pending') return 'Restore is already in progress. Do not repeat the action.';
    if (attempt.state === 'unconfirmed') return 'Restore outcome is unconfirmed. Do not retry; Founder review is required.';
    if (article.deletedAt && attempt.deletedAt && article.deletedAt !== attempt.deletedAt) return null;
    return 'Restore already completed. Refresh the list; do not repeat the action.';
  };
  const accessDenial = (id: string): string | null => {
    const current = live.current;
    if (!current.isAuthenticated) return 'Your session has expired. Please sign in again.';
    if (!current.actor && !current.access.isFounder) return 'The active account identity could not be verified. Sign in again before restoring.';
    if (current.disabled) return 'Wait for the current article list before checking Restore.';
    const article = articleFor(id);
    return articleRestoreAccessDenial(current.access, article)
      || (article?.status !== 'deleted' ? 'The story is no longer deleted. Refresh the list before restoring.' : null);
  };
  const denial = (article: Article | undefined): string | null => {
    const reason = accessDenial(article?._id || '') || attemptDenial(article);
    if (reason || live.current.access.isFounder) return reason;
    const current = receipt && receipt.id === article?._id && receipt.version === revision.current.version
      && Date.now() - receipt.checkedAt < ASSESSMENT_LIFETIME_MS ? receipt : null;
    return current?.message || articleRestoreDenial(live.current.access, article, current?.assessment);
  };
  const stillCurrent = (version: number) => mounted.current && revision.current.version === version;
  const finish = (request: AbortController) => {
    if (controller.current === request) controller.current = null;
    inFlight.current = false;
    if (mounted.current) setBusy(false);
  };

  const check = async (id: string) => {
    if (inFlight.current) return;
    if (!stillCurrent(renderVersion)) return;
    const reason = accessDenial(id) || attemptDenial(articleFor(id));
    if (reason) { toast.error(reason); return; }
    inFlight.current = true;
    setBusy(true);
    setReceipt(null);
    const version = revision.current.version;
    const request = new AbortController();
    controller.current = request;
    try {
      const assessment = await getArticleRestoreEligibility(id, request.signal);
      if (!stillCurrent(version)) return;
      const message = articleRestoreDenial(live.current.access, articleFor(id), assessment);
      setReceipt({ id, version, checkedAt: Date.now(), assessment });
      if (message) toast.error(message);
    } catch (error: unknown) {
      if (!stillCurrent(version)) return;
      const message = normalizeRestoreError(error, 'Could not verify Restore eligibility').message;
      setReceipt({ id, version, checkedAt: Date.now(), message });
      toast.error(message);
    } finally {
      finish(request);
    }
  };

  const restore = async (id: string, expectedVersion = renderVersion) => {
    if (!stillCurrent(renderVersion) || !stillCurrent(expectedVersion)) {
      throw new ArticleRestoreGuardError('The active account, permissions or story changed. Check Restore again.');
    }
    if (inFlight.current) throw new ArticleRestoreGuardError('Restore verification is already in progress.');
    const reason = denial(articleFor(id));
    if (reason) throw new ArticleRestoreGuardError(reason);
    inFlight.current = true;
    setBusy(true);
    setReceipt(null);
    const version = revision.current.version;
    const request = new AbortController();
    controller.current = request;
    let members = [id];
    try {
      if (!live.current.access.isFounder) {
        const assessment = await getArticleRestoreEligibility(id, request.signal);
        if (!stillCurrent(version)) throw new ArticleRestoreGuardError('The active account, permissions or story changed. Check Restore again.');
        const changed = accessDenial(id) || articleRestoreDenial(live.current.access, articleFor(id), assessment);
        if (changed) throw new ArticleRestoreGuardError(changed);
        members = assessment.members.map(member => member.id);
      }
      if (!stillCurrent(version)) throw new ArticleRestoreGuardError('The active account, permissions or story changed. Check Restore again.');
      const changed = accessDenial(id) || attemptDenial(articleFor(id));
      if (changed) throw new ArticleRestoreGuardError(changed);
      const deletionTimes = new Map(live.current.rows.map(row => [row._id, row.deletedAt || null]));

      // Only mutation outcomes survive navigation. Eligibility responses never enter the query cache.
      const recordAttempt = (state: Attempt['state']) => members.forEach(memberId => {
        const key = attemptKey(memberId);
        client.setQueryDefaults(key, { gcTime: Infinity });
        client.setQueryData<Attempt>(key, { state, deletedAt: deletionTimes.get(memberId) || null });
      });
      recordAttempt('pending');
      try {
        const result = await restoreArticle(id);
        members = [...new Set([...members, ...(result.changedIds || [])])];
        recordAttempt('committed');
        return result;
      } catch (error: unknown) {
        const failure = normalizeRestoreError(error, 'Failed to restore story');
        const unconfirmed = ![400, 401, 403, 404, 409, 419, 422, 423, 429].includes(failure.status ?? 0);
        if (unconfirmed) recordAttempt('unconfirmed');
        else members.forEach(memberId => client.removeQueries({ queryKey: attemptKey(memberId), exact: true }));
        if (stillCurrent(version) && !accessDenial(id)) {
          try {
            const assessment = await getArticleRestoreEligibility(id, request.signal);
            if (stillCurrent(version)) {
              const message = articleRestoreDenial(live.current.access, articleFor(id), assessment)
                || 'The Restore attempt failed. Check eligibility again before an explicit retry.';
              setReceipt({ id, version, checkedAt: Date.now(), message });
            }
          } catch (refreshError: unknown) {
            if (stillCurrent(version)) {
              const message = normalizeRestoreError(refreshError, 'Could not refresh Restore eligibility').message;
              setReceipt({ id, version, checkedAt: Date.now(), message });
              toast.error(message);
            }
          }
        }
        throw unconfirmed ? new ArticleRestoreUnconfirmedError(error) : error;
      }
    } finally {
      finish(request);
    }
  };

  return {
    busy, check, restore, denial, contextVersion: renderVersion,
    canCheck: (article: Article) => !access.isFounder && article.status === 'deleted'
      && !accessDenial(article._id) && !attemptDenial(article),
  };
}
