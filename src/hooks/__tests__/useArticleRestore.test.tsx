import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useArticleRestore } from '../useArticleRestore';
import type { ArticleMutationResponse, ArticleRestoreEligibility } from '@/lib/api/articles';
import { normalizeRestoreError } from '@/lib/articleLifecycle';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'synthetic-staff', role: 'editor' }, isAuthenticated: true },
  get: vi.fn(), restore: vi.fn(), error: vi.fn(),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/api/articles', () => ({ getArticleRestoreEligibility: mocks.get, restoreArticle: mocks.restore }));
vi.mock('react-hot-toast', () => ({ default: { error: mocks.error } }));

type Props = Parameters<typeof useArticleRestore>[0];
const clients: QueryClient[] = [];
const article = {
  _id: 'news-en', title: 'Synthetic story', status: 'deleted' as const,
  deletedAt: '2026-01-15T10:00:00Z', translationGroupId: 'synthetic-group',
};
const props = (): Props => ({
  access: { canManageNews: true, canRestoreNews: true, isFounder: false },
  rows: [article], viewKey: 'deleted',
});
function eligible(id = 'news-en'): ArticleRestoreEligibility {
  return {
    articleId: id, eligible: true, decision: 'eligible', complete: true, requiresFounder: false,
    reasonCodes: [], members: [{ id, language: 'en', status: 'deleted', restoreStatus: 'draft', historyKnown: true }],
    publicCopies: [],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function mount(initialProps = props(), existingClient?: QueryClient) {
  const client = existingClient || new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  if (!existingClient) clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook((input: Props) => useArticleRestore(input), { wrapper, initialProps }), client };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.user = { id: 'synthetic-staff', role: 'editor' };
  mocks.auth.isAuthenticated = true;
  mocks.get.mockImplementation(async (id: string) => eligible(id));
  mocks.restore.mockResolvedValue({ ok: true, changedIds: ['news-en'], restoredStatuses: ['draft'] });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  vi.useRealTimers();
});

describe('Bounded staff Restore checks', () => {
  it('does not read on mount; requires a user check and a fresh action-time check before one POST', async () => {
    const { result, client } = mount();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(result.current.denial(article)).toMatch(/Check restore/);
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(/Check restore/); });
    expect(mocks.restore).not.toHaveBeenCalled();
    await act(async () => { await result.current.check(article._id); });
    expect(result.current.denial(article)).toBeNull();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    await act(async () => { await result.current.restore(article._id); });
    expect(mocks.get.mock.calls.map(([id]) => id)).toEqual(['news-en', 'news-en']);
    expect(mocks.restore).toHaveBeenCalledExactlyOnceWith('news-en');
    expect(client.getQueryData(['article-restore-attempt', 'synthetic-staff', 'news-en']))
      .toEqual({ state: 'committed', deletedAt: article.deletedAt });
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(/already completed/); });
    expect(mocks.restore).toHaveBeenCalledTimes(1);
  });

  it('keeps only one selected assessment instead of checking every row', async () => {
    const second = { ...article, _id: 'other-news' };
    const { result } = mount({ ...props(), rows: [article, second] });
    await act(async () => { await result.current.check(article._id); });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(result.current.denial(second)).not.toBeNull();
    await act(async () => { await result.current.check(second._id); });
    expect(result.current.denial(second)).toBeNull();
    expect(result.current.denial(article)).toMatch(/Check restore/);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it('expires the actionable receipt at 30 seconds without an automatic request', async () => {
    vi.useFakeTimers();
    const { result } = mount();
    await act(async () => { await result.current.check(article._id); });
    act(() => { vi.advanceTimersByTime(29_999); });
    expect(result.current.denial(article)).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.denial(article)).toMatch(/Check restore/);
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(); });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it.each([
    { canManageNews: false, canRestoreNews: true, isFounder: false },
    { canManageNews: true, canRestoreNews: false, isFounder: false },
  ])('does not even assess an unauthorized caller %j', async access => {
    const { result } = mount({ ...props(), access });
    await act(async () => { await result.current.check(article._id); });
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(); });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });

  it.each([
    { eligible: false },
    { complete: false },
    { decision: 'blocked' },
    { decision: 'incomplete' },
    { decision: 'founder_required', requiresFounder: true },
  ] satisfies Partial<ArticleRestoreEligibility>[])('never enables Restore on HTTP 200 with %j', async change => {
    mocks.get.mockResolvedValue({ ...eligible(), ...change });
    const { result } = mount();
    await act(async () => { await result.current.check(article._id); });
    expect(result.current.denial(article)).not.toBeNull();
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(); });
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it.each(['initial', 'action'])('handles each GET failure at the %s check without POST', async phase => {
    for (const error of [
      ...[400, 401, 403, 404, 409, 503, 500].map(status => ({ response: { status, data: {} } })),
      new Error('Network error'), { code: 'ECONNABORTED' },
    ]) {
      const { result, unmount } = mount();
      mocks.get.mockResolvedValue(eligible());
      if (phase === 'action') await act(async () => { await result.current.check(article._id); });
      mocks.get.mockRejectedValueOnce(error);
      if (phase === 'initial') await act(async () => { await result.current.check(article._id); });
      else await act(async () => { await expect(result.current.restore(article._id)).rejects.toBe(error); });
      expect(result.current.denial(article)).not.toBeNull();
      expect(mocks.restore).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('does not POST when the second assessment changes to denied', async () => {
    const { result } = mount();
    await act(async () => { await result.current.check(article._id); });
    mocks.get.mockResolvedValue({ ...eligible(), eligible: false, decision: 'founder_required', requiresFounder: true });
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(/Founder permission/); });
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(result.current.denial(article)).not.toBeNull();
  });
});

describe('Restore races and stale contexts', () => {
  it('serializes repeated assessment and Restore clicks synchronously', async () => {
    const read = deferred<ArticleRestoreEligibility>();
    mocks.get.mockReturnValue(read.promise);
    const { result } = mount();
    let checking!: Promise<void>;
    act(() => {
      checking = result.current.check(article._id);
      void result.current.check(article._id);
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await act(async () => { read.resolve(eligible()); await checking; });
    const secondRead = deferred<ArticleRestoreEligibility>();
    mocks.get.mockReturnValue(secondRead.promise);
    let restoring!: Promise<ArticleMutationResponse>;
    act(() => { restoring = result.current.restore(article._id); });
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(/in progress/); });
    await act(async () => { secondRead.resolve(eligible()); await restoring; });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.restore).toHaveBeenCalledTimes(1);
  });

  it.each(['account', 'permission', 'module', 'row', 'view', 'status', 'refresh', 'logout'] as const)(
    'rejects a late action-time response after a %s change', async change => {
      const input = props();
      const { result, rerender } = mount(input);
      await act(async () => { await result.current.check(article._id); });
      const read = deferred<ArticleRestoreEligibility>();
      mocks.get.mockReturnValue(read.promise);
      let restoring!: Promise<ArticleMutationResponse>;
      act(() => { restoring = result.current.restore(article._id); });
      const rejected = expect(restoring).rejects.toThrow(/changed/);
      const next = { ...input, access: { ...input.access } };
      if (change === 'account') mocks.auth.user.id = 'other-staff';
      if (change === 'permission') next.access.canRestoreNews = false;
      if (change === 'module') next.access.canManageNews = false;
      if (change === 'row') next.rows = [{ ...article, _id: 'replacement-id' }];
      if (change === 'view') next.viewKey = 'another-page';
      if (change === 'status') next.rows = [{ ...article, status: 'draft' }];
      if (change === 'refresh') next.disabled = true;
      if (change === 'logout') mocks.auth.isAuthenticated = false;
      rerender(next);
      expect(mocks.get.mock.calls.at(-1)?.[1].aborted).toBe(true);
      await act(async () => { read.resolve(eligible()); await rejected; });
      expect(mocks.restore).not.toHaveBeenCalled();
      expect(result.current.denial(article)).not.toBeNull();
    },
  );

  it('does not accept an A-to-B-to-A late receipt or a stale click handler', async () => {
    const initial = props();
    const { result, rerender } = mount(initial);
    const read = deferred<ArticleRestoreEligibility>();
    mocks.get.mockReturnValue(read.promise);
    let checking!: Promise<void>;
    const staleRestore = result.current.restore;
    act(() => { checking = result.current.check(article._id); });
    rerender({ ...initial, viewKey: 'other' });
    rerender(initial);
    await act(async () => { read.resolve(eligible()); await checking; });
    expect(result.current.denial(article)).toMatch(/Check restore/);
    await act(async () => { await expect(staleRestore(article._id)).rejects.toThrow(/changed/); });
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('aborts on unmount and never mutates after a late eligible response', async () => {
    const { result, unmount } = mount();
    await act(async () => { await result.current.check(article._id); });
    const read = deferred<ArticleRestoreEligibility>();
    mocks.get.mockReturnValue(read.promise);
    let restoring!: Promise<ArticleMutationResponse>;
    act(() => { restoring = result.current.restore(article._id); });
    const rejected = expect(restoring).rejects.toThrow(/changed/);
    unmount();
    expect(mocks.get.mock.calls.at(-1)?.[1].aborted).toBe(true);
    await act(async () => { read.resolve(eligible()); await rejected; });
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});

describe('Restore mutation outcomes', () => {
  it.each([400, 401, 403, 404, 409])('refreshes eligibility after rejected POST %s without replaying it', async status => {
    const { result } = mount();
    await act(async () => { await result.current.check(article._id); });
    const error = { response: { status, data: {} } };
    mocks.restore.mockRejectedValueOnce(error);
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toBe(error); });
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledTimes(3);
    expect(result.current.denial(article)).not.toBeNull();
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(); });
    expect(mocks.restore).toHaveBeenCalledTimes(1);
  });

  it.each([
    { response: { status: 500, data: {} } },
    { response: { status: 503, data: {} } },
    { code: 'ECONNABORTED' },
    new Error('Network error'),
    new Error('Invalid article operation response'),
  ])('keeps ambiguous POST outcomes blocked across navigation even if GET is eligible: %j', async error => {
    const mounted = mount();
    await act(async () => { await mounted.result.current.check(article._id); });
    mocks.restore.mockRejectedValueOnce(error);
    await act(async () => {
      try {
        await mounted.result.current.restore(article._id);
        expect.fail('Expected an unconfirmed outcome');
      } catch (failure: unknown) {
        expect(normalizeRestoreError(failure, 'Restore failed').message).toMatch(/may have completed.*do not retry/);
      }
    });
    expect(mocks.get).toHaveBeenCalledTimes(3);
    expect(mounted.result.current.denial(article)).toMatch(/unconfirmed/);
    mounted.unmount();
    const next = mount(props(), mounted.client);
    expect(next.result.current.denial(article)).toMatch(/unconfirmed/);
    await act(async () => { await expect(next.result.current.restore(article._id)).rejects.toThrow(/unconfirmed/); });
    expect(mocks.restore).toHaveBeenCalledTimes(1);
  });

  it('keeps the original POST error when the follow-up GET also fails', async () => {
    const { result } = mount();
    await act(async () => { await result.current.check(article._id); });
    const rejected = { response: { status: 403, data: { code: 'ARTICLE_RESTORE_FORBIDDEN' } } };
    mocks.restore.mockRejectedValue(rejected);
    mocks.get.mockResolvedValueOnce(eligible()).mockRejectedValueOnce({ response: { status: 503, data: {} } });
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toBe(rejected); });
    expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/refresh Restore eligibility.*temporarily unavailable/));
    expect(result.current.denial(article)).toMatch(/temporarily unavailable/);
    expect(mocks.restore).toHaveBeenCalledTimes(1);
  });

  it('preserves Founder Restore without requiring staff eligibility and blocks a stale repeat', async () => {
    mocks.auth.user.role = 'founder';
    const input = { ...props(), access: { ...props().access, isFounder: true } };
    const { result, rerender } = mount(input);
    expect(result.current.denial(article)).toBeNull();
    const response = { ok: true, restoredStatuses: ['published' as const] };
    mocks.restore.mockResolvedValue(response);
    await act(async () => { expect(await result.current.restore(article._id)).toBe(response); });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(result.current.denial(article)).toMatch(/already completed/);
    const newDeletion = { ...article, deletedAt: '2026-02-01T10:00:00Z' };
    rerender({ ...input, rows: [newDeletion] });
    expect(result.current.denial(newDeletion)).toBeNull();
  });

  it('does not send deleted-News POST Restore for a stale archived row, even for Founder', async () => {
    mocks.auth.user.role = 'founder';
    const { result } = mount({
      ...props(), access: { ...props().access, isFounder: true }, rows: [{ ...article, status: 'archived' }],
    });
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(/no longer deleted/); });
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 409])('preserves explicit Founder retry after rejected POST %s without a staff-check prerequisite', async status => {
    mocks.auth.user.role = 'founder';
    const { result } = mount({ ...props(), access: { ...props().access, isFounder: true } });
    const error = { response: { status, data: {} } };
    mocks.restore.mockRejectedValueOnce(error);
    mocks.get.mockResolvedValue({
      ...eligible(), eligible: false, decision: 'founder_required', requiresFounder: true,
    });
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toBe(error); });
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(result.current.canCheck(article)).toBe(false);
    expect(result.current.denial(article)).toBeNull();
    await act(async () => { await result.current.restore(article._id); });
    expect(mocks.restore).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it.each([500, 503])('still blocks Founder replay after an unconfirmed POST %s', async status => {
    mocks.auth.user.role = 'founder';
    const { result } = mount({ ...props(), access: { ...props().access, isFounder: true } });
    mocks.restore.mockRejectedValueOnce({ response: { status, data: {} } });
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(/unconfirmed/); });
    expect(result.current.denial(article)).toMatch(/unconfirmed/);
    await act(async () => { await expect(result.current.restore(article._id)).rejects.toThrow(/unconfirmed/); });
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('releases a committed marker after the list reflects restoration, preserving later legitimate restores', async () => {
    mocks.auth.user.role = 'founder';
    const input = { ...props(), access: { ...props().access, isFounder: true } };
    const { result, rerender } = mount(input);
    await act(async () => { await result.current.restore(article._id); });
    rerender({ ...input, rows: [{ ...article, status: 'draft' }] });
    rerender(input);
    expect(result.current.denial(article)).toBeNull();
    await act(async () => { await result.current.restore(article._id); });
    expect(mocks.restore).toHaveBeenCalledTimes(2);
  });
});
