import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { articleFollowUpWarning, normalizeArticleError, refreshArticleQueries } from '@/lib/articleLifecycle';

describe('article-scoped lifecycle feedback', () => {
  it.each([
    'Article group changed. Reload and retry.',
    'Restore the deleted story before changing its status.',
    'Only a completely soft-deleted story can be restored.',
    'The translation group has duplicate language records. Resolve them before restoring.',
    'The previous publication is incomplete. Review the story before restoring.',
    'Only completely soft-deleted stories can be permanently removed.',
    'Article lifecycle changed. Reload and retry the edit.',
    'Article changed. Reload and retry.',
    'Slug already exists',
    'Restore the deleted story before publishing.',
    'Restore the translation group before publishing.',
    'Restore the complete translation group before publishing.',
    'Translation group changed. Reload and retry.',
    'The translation group changed. Review every edition before publishing.',
    'English, Hindi and Gujarati versions must be completed before publishing.',
    'The source story was deleted. Translation was cancelled.',
    'The source story changed. Retry the operation.',
    'The source story changed. Translation was cancelled; retry with the current edition.',
    'Restore the translation group before generating translations.',
    'Translation changed during generation. Retry the operation.',
    'Restore the deleted story before editing it.',
    'An article for this translationGroupId and language already exists',
    'Faith topic changes require a source newsroom article',
    'Author byline changes require a source newsroom article',
    'Change the Faith topic on a source Faith & Culture article',
    'Article category changed; reload and retry the update',
    'Change the Faith topic on the source article to keep translations aligned',
    'Change the author byline on the source article to keep translations aligned',
    'Article changed; reload and retry the topic update',
    'Restore the deleted story before scheduling.',
    'Faith translations require a source Faith & Culture article',
  ])('preserves the confirmed conflict message: %s', (message) => {
    const error = { response: { status: 409, data: { message } } };
    expect(normalizeArticleError(error, 'Save failed')).toMatchObject({ status: 409, message, retriable: false });
  });

  it.each([undefined, 'DatabaseError: private diagnostic\n at internal.ts:12'])(
    'recognizes a duplicate slug by the confirmed code without exposing diagnostics: %s',
    (message) => {
      const error = { response: { status: 409, data: { code: 'SLUG_CONFLICT', message } } };
      expect(normalizeArticleError(error, 'Save failed')).toMatchObject({
        status: 409,
        code: 'SLUG_CONFLICT',
        message: 'Slug already exists',
        retriable: false,
      });
    },
  );

  it('preserves a confirmed conflict message from the existing status/body error shape', () => {
    const message = 'Restore the deleted story before changing its status.';
    expect(normalizeArticleError({ status: 409, body: { message } }, 'Save failed'))
      .toMatchObject({ status: 409, message, retriable: false });
  });

  it.each([
    { message: 'DatabaseError: private diagnostic\n at internal.ts:12' },
    { message: 'Article group changed. Reload and retry.\n at internal.ts:12' },
    { message: 'Article group changed. Reload and retry. Private diagnostic' },
    { message: 'Article group changed. Reload and retry' },
    { message: 'Complete every edition before restoring.' },
    { message: undefined },
    { message: null },
    { message: 409 },
    { message: { message: 'Article group changed. Reload and retry.' } },
    { message: ['Article group changed. Reload and retry.'] },
  ])('uses the safe conflict fallback for an unverified or malformed message: %j', ({ message }) => {
    const error = { response: { status: 409, data: { message } } };
    const result = normalizeArticleError(error, 'Save failed');
    expect(result).toMatchObject({
      status: 409,
      message: 'The Backend reported an article conflict. Review the latest story before trying again.',
      retriable: false,
    });
  });

  it.each([
    [400, 'Load failed'],
    [401, 'Your session has expired. Please sign in again.'],
    [419, 'Your session has expired. Please sign in again.'],
    [403, 'Access denied. You do not have permission for this action.'],
    [429, 'Too many requests. Please try again later.'],
    [503, 'Load failed. The Backend is temporarily unavailable.'],
  ])('preserves HTTP %s behavior rather than applying the conflict allowlist', (status, message) => {
    const error = { response: { status, data: { message: 'Restore the deleted story before changing its status.' } } };
    expect(normalizeArticleError(error, 'Load failed')).toMatchObject({ status, message });
  });

  it('distinguishes a network failure from an empty result', () => {
    expect(normalizeArticleError({ code: 'BACKEND_OFFLINE', message: 'Backend offline' }, 'Load failed'))
      .toMatchObject({ network: true, message: 'Load failed. Cannot reach the Backend. Check your connection.' });
  });

  it('warns about a committed follow-up failure without advising a mutation retry', () => {
    expect(articleFollowUpWarning({ committed: true, revalidation: { ok: false } })).toContain('do not repeat');
    expect(articleFollowUpWarning({ postCommitWarnings: [{ code: 'ARTICLE_FOLLOW_UP_FAILED', message: 'Private diagnostic' }] })).not.toContain('Private');
    expect(articleFollowUpWarning({ ok: true })).toBeNull();
  });

  it('invalidates article lists and existing count queries without clearing unrelated caches', async () => {
    const client = new QueryClient();
    client.setQueryData(['articles', 'list'], []);
    client.setQueryData(['articles', 'meta'], { total: 20 });
    client.setQueryData(['articles', 'one', 'story-1'], { _id: 'story-1' });
    client.setQueryData(['unrelated-module'], { untouched: true });
    await refreshArticleQueries(client, false);
    expect(client.getQueryState(['articles', 'list'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['articles', 'meta'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['articles', 'one', 'story-1'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['unrelated-module'])?.isInvalidated).toBe(false);
    client.clear();
  });
});
