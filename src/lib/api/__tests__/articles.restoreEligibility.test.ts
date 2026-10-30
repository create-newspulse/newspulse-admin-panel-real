import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getArticleRestoreEligibility, type ArticleRestoreEligibility } from '../articles';
import { articleRestoreDenial, normalizeRestoreError } from '@/lib/articleLifecycle';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: mocks }));

function assessment(overrides: Partial<ArticleRestoreEligibility> = {}): ArticleRestoreEligibility {
  return {
    articleId: 'news-en', eligible: true, decision: 'eligible', complete: true, requiresFounder: false,
    reasonCodes: [], members: [{ id: 'news-en', language: 'en', status: 'deleted', restoreStatus: 'draft', historyKnown: true }],
    publicCopies: [], ...overrides,
  };
}
const envelope = (data: unknown) => ({ ok: true, success: true, status: 200, data });
const staff = { canManageNews: true, canRestoreNews: true, isFounder: false };
const article = { _id: 'news-en', title: 'Synthetic story', status: 'deleted' as const };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({ data: envelope(assessment()) });
});

describe('Restore eligibility read contract', () => {
  it('uses the existing authenticated client, encoded CMS ID and uncached bounded GET', async () => {
    const id = 'news /en';
    const data = assessment({ articleId: id });
    const signal = new AbortController().signal;
    mocks.get.mockResolvedValue({ data: envelope(data) });
    expect(await getArticleRestoreEligibility(id, signal)).toEqual(data);
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('articles/news%20%2Fen/restore-eligibility', {
      signal, timeout: 10_000, headers: { 'Cache-Control': 'no-store, no-cache', Pragma: 'no-cache' },
    });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('does not cache an earlier eligible result', async () => {
    await getArticleRestoreEligibility('news-en');
    mocks.get.mockResolvedValue({ data: envelope(assessment({ eligible: false, decision: 'blocked' })) });
    expect((await getArticleRestoreEligibility('news-en')).eligible).toBe(false);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it.each(['', ' ', ' news-en', 'news-en '])('rejects invalid ID %j without a request', async id => {
    await expect(getArticleRestoreEligibility(id)).rejects.toThrow(/Invalid article ID/);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 409, 503, 500])('preserves HTTP %s without fallback reads or mutations', async status => {
    const error = { response: { status, data: { code: 'RESTORE_ELIGIBILITY_FAILED' } } };
    mocks.get.mockRejectedValue(error);
    await expect(getArticleRestoreEligibility('news-en')).rejects.toBe(error);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it.each([new Error('Network error'), { code: 'ECONNABORTED' }, { code: 'ERR_CANCELED' }])(
    'does not turn a transport failure into eligibility: %j', async error => {
      mocks.get.mockRejectedValue(error);
      await expect(getArticleRestoreEligibility('news-en')).rejects.toBe(error);
      expect(mocks.get).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    undefined, null, {}, '<html>upstream failure</html>',
    { ...envelope(assessment()), ok: false },
    { ...envelope(assessment()), success: false },
    { ...envelope(assessment()), status: 503 },
    envelope({ ...assessment(), articleId: 'different-id' }),
    envelope({ ...assessment(), eligible: 'true' }),
    envelope({ ...assessment(), complete: 1 }),
    envelope({ ...assessment(), requiresFounder: 'false' }),
    envelope({ ...assessment(), decision: 'allowed' }),
    envelope({ ...assessment(), reasonCodes: undefined }),
    envelope({ ...assessment(), members: undefined }),
    envelope({ ...assessment(), publicCopies: undefined }),
    envelope({ ...assessment(), members: [{ id: 'news-en' }] }),
  ])('fails closed on a malformed or mismatched HTTP 200 response: %j', async body => {
    mocks.get.mockResolvedValue({ data: body });
    await expect(getArticleRestoreEligibility('news-en')).rejects.toThrow(/invalid or mismatched assessment/);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

describe('Staff Restore assessment decision', () => {
  it.each(['draft', 'archived'])('allows a verified deleted group restoring to %s', restoreStatus => {
    const data = assessment({ members: [
      { id: 'news-en', language: 'en', status: 'deleted', restoreStatus, historyKnown: true },
      { id: 'news-hi', language: 'hi', status: 'deleted', restoreStatus, historyKnown: true },
      { id: 'news-gu', language: 'gu', status: 'deleted', restoreStatus, historyKnown: true },
    ] });
    expect(articleRestoreDenial(staff, article, data)).toBeNull();
  });

  it.each([
    { eligible: false },
    { complete: false },
    { decision: 'blocked' },
    { decision: 'incomplete' },
    { decision: 'founder_required' },
    { requiresFounder: true },
    { reasonCodes: ['CONFLICT'] },
    { members: [] },
    { members: [{ ...assessment().members[0], id: 'another-id' }] },
    { members: [assessment().members[0], assessment().members[0]] },
    { members: [assessment().members[0], { ...assessment().members[0], id: 'news-hi' }] },
    { members: [{ ...assessment().members[0], historyKnown: false }] },
    { members: [{ ...assessment().members[0], status: 'draft' }] },
    { members: [{ ...assessment().members[0], restoreStatus: 'published' }] },
    { members: [{ ...assessment().members[0], restoreStatus: 'scheduled' }] },
    { members: [{ ...assessment().members[0], restoreStatus: null }] },
    { members: [{ ...assessment().members[0], language: null }] },
    { publicCopies: [{ id: 'public-copy', sourceNewsId: 'news-en' }] },
  ] satisfies Partial<ArticleRestoreEligibility>[])('denies incomplete, protected or contradictory evidence: %j', overrides => {
    expect(articleRestoreDenial(staff, article, assessment(overrides))).not.toBeNull();
  });

  it('uses authoritative group evidence, not the visible row history', () => {
    const data = assessment({ members: [
      ...assessment().members,
      { id: 'hidden-gu', language: 'gu', status: 'deleted', restoreStatus: 'published', historyKnown: true },
    ] });
    expect(articleRestoreDenial(staff, { ...article, deletedFromStatus: 'draft' }, data)).toMatch(/Founder permission/);
    expect(articleRestoreDenial(staff, { ...article, deletedFromStatus: 'draft' })).toMatch(/Check restore/);
  });

  it('does not broaden the archived-to-draft route even with eligible evidence', () => {
    expect(articleRestoreDenial(staff, { ...article, status: 'archived' }, assessment())).toMatch(/Founder review/);
  });

  it('retains the Founder boundary independently of staff assessment', () => {
    expect(articleRestoreDenial({ ...staff, isFounder: true }, article)).toBeNull();
    expect(articleRestoreDenial({ ...staff, isFounder: true }, { ...article, status: 'archived' })).toBeNull();
    expect(articleRestoreDenial({ ...staff, isFounder: true }, { ...article, status: 'draft' })).not.toBeNull();
  });
});

describe('Restore-specific safe errors', () => {
  it.each([
    [400, 'INVALID_ARTICLE_ID', /Invalid article ID/],
    [401, 'UNAUTHORIZED', /session has expired/],
    [403, 'ARTICLE_RESTORE_FORBIDDEN', /Access denied/],
    [403, 'ACCOUNT_LOCKED', /Access denied/],
    [404, 'ARTICLE_NOT_FOUND', /not found/],
    [409, 'ARTICLE_RESTORE_SCOPE_CHANGED', /restore scope changed/],
    [503, 'RESTORE_ELIGIBILITY_UNAVAILABLE', /temporarily unavailable/],
    [500, 'RESTORE_ELIGIBILITY_FAILED', /temporarily unavailable/],
  ])('reports HTTP %s / %s without disclosing diagnostics', (status, code, message) => {
    const failure = normalizeRestoreError({ response: { status, data: { code, message: 'Private diagnostic' } } }, 'Restore check failed');
    expect(failure).toMatchObject({ status, code, retriable: false, message: expect.stringMatching(message) });
    expect(failure.message).not.toContain('Private');
  });
});
