import type { QueryClient } from '@tanstack/react-query';
import { normalizeError, type NormalizedError } from '@/lib/error';

const CONFLICT_MESSAGES = new Set([
  'Slug already exists',
  'An article for this translationGroupId and language already exists',
  'Article group changed. Reload and retry.',
  'Article changed. Reload and retry.',
  'Article lifecycle changed. Reload and retry the edit.',
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

export function articleFollowUpWarning(result: unknown): string | null {
  const response = record(result);
  if (record(response.revalidation).ok === false
    || (Array.isArray(response.postCommitWarnings) && response.postCommitWarnings.length > 0)) {
    return 'The change was saved, but a Backend follow-up failed. Refresh the saved state; do not repeat the action.';
  }
  return null;
}

export function refreshArticleQueries(client: QueryClient, includeDetails = true): Promise<void> {
  return client.invalidateQueries({
    queryKey: ['articles'],
    predicate: (query) => includeDetails || query.queryKey[1] !== 'one',
  }, { throwOnError: true });
}
