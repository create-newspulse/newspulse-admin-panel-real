import type { QueryClient } from '@tanstack/react-query';
import { normalizeError, type NormalizedError } from '@/lib/error';
import type { Article, ArticleRestoreEligibility } from '@/lib/api/articles';

const CONFLICT_MESSAGES = new Set([
  'Slug already exists',
  'An article for this translationGroupId and language already exists',
  'Article group changed. Reload and retry.',
  'Article changed. Reload and retry.',
  'Article lifecycle changed. Reload and retry the edit.',
  'Article save scope changed. Reload and retry.',
  'Article category changed; reload and retry the update',
  'Article changed; reload and retry the topic update',
  'Translation group changed. Reload and retry.',
  'The translation group changed. Review every edition before publishing.',
  'Restore the deleted story before publishing.',
  'Restore the translation group before publishing.',
  'Restore the complete translation group before publishing.',
  'Restore the translation group before generating translations.',
  'Restore the deleted story before editing it.',
  'Restore the deleted story before changing its status.',
  'Restore the deleted story before scheduling.',
  'Only a completely soft-deleted story can be restored.',
  'Only completely soft-deleted stories can be permanently removed.',
  'The translation group has duplicate language records. Resolve them before restoring.',
  'The previous publication is incomplete. Review the story before restoring.',
  'English, Hindi and Gujarati versions must be completed before publishing.',
  'Change the Faith topic on a source Faith & Culture article',
  'Change the Faith topic on the source article to keep translations aligned',
  'Change the author byline on the source article to keep translations aligned',
  'Faith translations require a source Faith & Culture article',
  'Faith topic changes require a source newsroom article',
  'Author byline changes require a source newsroom article',
  'The source story was deleted. Translation was cancelled.',
  'The source story changed. Retry the operation.',
  'The source story changed. Translation was cancelled; retry with the current edition.',
  'Translation changed during generation. Retry the operation.',
]);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function normalizeArticleError(error: unknown, fallback: string): NormalizedError {
  const root = record(error);
  const response = record(root.response);
  const data = record(response.data ?? root.body);
  const normalized = normalizeError(error, fallback);
  const status = response.status ?? root.status;
  const code = data.code ?? data.errorCode ?? root.code;
  if (typeof status === 'number') normalized.status = status;
  if (typeof code === 'string') normalized.code = code;

  if (normalized.status === 409) {
    normalized.message = typeof data.message === 'string' && CONFLICT_MESSAGES.has(data.message)
      ? data.message
      : code === 'SLUG_CONFLICT'
        ? 'Slug already exists'
        : 'The Backend reported an article conflict. Review the latest story before trying again.';
    normalized.retriable = false;
  } else if (normalized.status === 401 || normalized.status === 419) {
    normalized.message = 'Your session has expired. Please sign in again.';
    normalized.authExpired = true;
  } else if (normalized.status === 403) {
    normalized.retriable = false;
    normalized.message = code === 'FOUNDER_REQUIRED'
      ? 'Founder permission is required for this action.'
      : 'Access denied. You do not have permission for this action.';
  } else if (normalized.status !== null && normalized.status >= 500) {
    normalized.message = `${fallback}. The Backend is temporarily unavailable.`;
  } else if (normalized.network || code === 'BACKEND_OFFLINE') {
    normalized.message = `${fallback}. Cannot reach the Backend. Check your connection.`;
    normalized.network = true;
  }
  return normalized;
}

export function articleCmsId(article: Pick<Article, '_id' | 'sourceNewsId'>): string {
  const id = String(article.sourceNewsId || article._id || '').trim();
  if (!id) throw new Error('Missing CMS News ID. Reload the story before publishing.');
  return id;
}

export interface ArticleRestoreAccess {
  canManageNews: boolean;
  canRestoreNews: boolean;
  isFounder: boolean;
}

export function articleRestoreAccessDenial(
  access: ArticleRestoreAccess,
  article: Article | undefined,
): string | null {
  if (!access.canManageNews) return 'Verified Manage News access is required to restore a story.';
  if (!article || (article.status !== 'deleted' && article.status !== 'archived')) {
    return 'The story is no longer available for restoration. Refresh the list.';
  }
  if (access.isFounder && access.canRestoreNews) return null;
  if (article.status === 'archived') {
    return 'Archived-to-draft Restore permissions are not verified. Founder review is required.';
  }
  if (!access.canRestoreNews) return 'Verified configured permanent and effective Restore News permission is required; temporary rights are not sufficient.';
  return null;
}

export function articleRestoreDenial(
  access: ArticleRestoreAccess,
  article: Article | undefined,
  assessment?: ArticleRestoreEligibility,
): string | null {
  const denial = articleRestoreAccessDenial(access, article);
  if (denial || access.isFounder) return denial;
  if (!assessment) return 'Check restore eligibility before restoring this deleted story.';
  if (assessment.articleId !== article?._id) return 'Restore assessment does not match this story. Refresh the list.';
  if (assessment.requiresFounder || assessment.decision === 'founder_required' || assessment.publicCopies.length
    || assessment.members.some(member => member.restoreStatus === 'published' || member.restoreStatus === 'scheduled')) {
    return 'Founder permission is required to restore a previously published or scheduled story.';
  }
  if (assessment.complete !== true || assessment.decision === 'incomplete') return 'Restore assessment is incomplete. Founder review is required.';
  if (assessment.eligible !== true || assessment.decision !== 'eligible') return 'The Backend has blocked Restore for this story. Founder review is required.';
  if (assessment.requiresFounder !== false || assessment.reasonCodes.length
    || !assessment.members.length || !assessment.members.some(member => member.id === article?._id)
    || new Set(assessment.members.map(member => member.id)).size !== assessment.members.length
    || new Set(assessment.members.map(member => member.language)).size !== assessment.members.length
    || assessment.members.some(member => member.historyKnown !== true || member.status !== 'deleted'
      || !['en', 'hi', 'gu'].includes(member.language || '')
      || (member.restoreStatus !== 'draft' && member.restoreStatus !== 'archived'))) {
    return 'Restore assessment is conflicting or incomplete. Founder review is required.';
  }
  return null;
}

export class ArticleRestoreGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleRestoreGuardError';
  }
}

export class ArticleRestoreUnconfirmedError extends Error {
  constructor(public readonly cause: unknown) {
    super('Restore outcome is unconfirmed.');
    this.name = 'ArticleRestoreUnconfirmedError';
  }
}

export function normalizeRestoreError(error: unknown, fallback: string): NormalizedError {
  const unconfirmed = error instanceof ArticleRestoreUnconfirmedError;
  const cause = unconfirmed ? error.cause : error;
  const failure = normalizeArticleError(cause, fallback);
  if (cause instanceof ArticleRestoreGuardError) failure.message = cause.message;
  if (failure.status === 400) failure.message = 'Invalid article ID. Refresh the list before checking Restore.';
  if (failure.status === 404) failure.message = 'The story was not found. Refresh the list before checking Restore.';
  if (failure.status === 409 && failure.code === 'ARTICLE_RESTORE_SCOPE_CHANGED') {
    failure.message = 'The restore scope changed. Refresh the story and check eligibility again.';
  }
  if (unconfirmed) {
    failure.message += ' Restore may have completed. Its outcome is unconfirmed; do not retry. Founder review is required.';
  }
  failure.retriable = false;
  return failure;
}

export class ArticleSaveProgressError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
    this.name = 'ArticleSaveProgressError';
  }
}

export function articleFollowUpWarning(result: unknown): string | null {
  const response = record(result);
  if (record(response.revalidation).ok === false
    || (Array.isArray(response.postCommitWarnings) && response.postCommitWarnings.length > 0)) {
    return 'The change was saved, but a Backend follow-up failed. Refresh the saved state; do not repeat the action.';
  }
  return null;
}

export async function refreshArticleQueries(client: QueryClient, includeDetails = true): Promise<void> {
  // Invalidating an initial pending query alone reuses its pre-mutation request.
  await client.cancelQueries({ queryKey: ['articles', 'logical-counts'] });
  // Counts report their own errors and must not keep article actions pending.
  void client.invalidateQueries({ queryKey: ['articles', 'logical-counts'] }, { throwOnError: false });
  return client.invalidateQueries({
    queryKey: ['articles'],
    predicate: (query) => query.queryKey[1] !== 'logical-counts'
      && (includeDetails || query.queryKey[1] !== 'one'),
  }, { throwOnError: true });
}
