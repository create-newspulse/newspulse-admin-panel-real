import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article } from '@/lib/api/articles';
import { applyLegacyEditionVariant, backendGenerationReceipt, backendTranslationStatus, editionLanguages, legacyEditionVariants, sourceEditLanguageCases } from '@/tests/articleEditionFixtures';

const mocks = vi.hoisted(() => ({
  get: vi.fn<(url: string) => Promise<{ data: unknown }>>(),
  post: vi.fn(),
}));

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: {
    get: mocks.get,
    post: mocks.post,
  },
}));

import { articleEditionLanguage, createCommunityArticle, createdArticleCmsId, generateMissingArticleTranslations, getArticleTranslationEditions, normalizeArticleLanguageCode, requeueArticleTranslations } from '@/lib/api/articles';

const missingEdition = { present: false, presence: 'missing', articleId: null, childArticleId: null };

function apiError(status: number, message: string) {
  const error: any = new Error(message);
  error.response = { status, data: { message } };
  return error;
}

describe('article translation generation API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ data: { ok: true } });
  });

  it.each(editionLanguages)('preserves the Backend generation receipt for a %s source', async language => {
    const targets = editionLanguages.filter(code => code !== language);
    const receipt = backendGenerationReceipt(language, 'initialized-group', targets,
      Object.fromEntries(targets.map(code => [code, `created-${code}`])));
    mocks.post.mockResolvedValue({ data: receipt });
    expect(await generateMissingArticleTranslations(`source-${language}`, { targetLanguages: targets })).toEqual(receipt);
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(`articles/source-${language}/translations/generate`, {
      targetLanguages: targets, overwrite: false,
    });
  });

  describe('acknowledged new-source identity', () => {
    const expected = { language: 'gu' as const, translationGroupId: 'new-group' };

    it('uses the accepted create payload for omitted metadata without requiring discovery access', () => {
      expect(createdArticleCmsId({ _id: 'created-source', title: 'New source' }, expected)).toBe('created-source');
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each(['gu', 'hi', 'en'] as const)('accepts consistent %s source identity', language => {
      expect(createdArticleCmsId({
        _id: 'created-source', sourceNewsId: 'created-source', title: 'New source',
        language, lang: language, sourceLanguage: language, translationGroupId: 'new-group', translationKey: 'new-group',
      }, { ...expected, language })).toBe('created-source');
    });

    it.each(editionLanguages)('accepts a Backend-assigned group for a verified new %s canonical source', language => {
      const article = {
        _id: `created-${language}`, id: `created-${language}`, title: 'New source', status: 'draft' as const,
        lang: language, language, originalLang: language, sourceLanguage: language,
        sourceArticleId: `created-${language}`, translationGroupId: 'backend-assigned-group',
      };
      expect(createdArticleCmsId(article, { language, translationGroupId: null })).toBe(article._id);
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([
      { translationMeta: { sourceArticleId: 'created-source', sourceLanguage: 'gu', targetLanguage: 'gu' } },
      { sourceArticle: { id: 'created-source', lang: 'gu', translationGroupId: 'backend-assigned-group' } },
    ])('accepts independently verified nested canonical source metadata %j', metadata => {
      expect(createdArticleCmsId({
        _id: 'created-source', title: 'New source', lang: 'gu', translationGroupId: 'backend-assigned-group', ...metadata,
      }, { language: 'gu', translationGroupId: null })).toBe('created-source');
    });

    it.each([
      { _id: undefined }, { _id: ' public-copy ' }, { id: 'other-id' }, { sourceNewsId: 'different-cms-id' },
      { lang: 'hi' }, { language: 'en' }, { originalLang: 'en' }, { sourceLanguage: 'hi' },
      { lang: undefined, language: undefined, originalLang: undefined },
      { sourceArticleId: 'other-source' }, { sourceArticleId: '' }, { sourceArticleId: {} }, { sourceArticleId: undefined },
      { translationMeta: { sourceArticleId: 'other-source' } }, { translationMeta: { sourceLanguage: 'en' } },
      { translationMeta: { targetLanguage: 'hi' } }, { translationMeta: [] },
      { sourceArticle: { _id: 'created-source', id: 'different-source' } },
      { sourceArticle: { id: 'created-source', sourceArticleId: 'different-source' } },
      { sourceArticle: { id: 'created-source', sourceLanguage: 'en' } },
      { sourceArticle: { id: 'created-source', translationGroupId: 'other-group' } },
      { sourceArticle: { id: 'created-source', translationMeta: { sourceArticleId: 'other-source' } } },
      { translationGroupId: {} }, { translationGroupId: ' undefined ' }, { translationGroupId: 'null' },
      { translationKey: 'different-group' }, { translationKey: 'backend-assigned-group ' },
    ])('rejects conflicting or insufficient identity when adopting an assigned group: %j', patch => {
      expect(() => Reflect.apply(createdArticleCmsId, undefined, [{
        _id: 'created-source', id: 'created-source', title: 'New source', lang: 'gu', sourceLanguage: 'gu',
        sourceArticleId: 'created-source', translationGroupId: 'backend-assigned-group', ...patch,
      }, { language: 'gu', translationGroupId: null }])).toThrow();
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([
      { _id: undefined }, { _id: '' }, { _id: 123 }, { _id: {} }, { _id: '../other' },
      { sourceNewsId: 'unrelated-source' }, { language: 'hi' }, { lang: 'gu', language: 'en' },
      { translationGroupId: 'other-group' }, { translationGroupId: null }, { translationGroupId: {} },
      { translationKey: 'other-group' }, { sourceLanguage: 'hi' },
      { sourceArticle: { _id: 'unrelated-source' } },
      { sourceArticle: { _id: 'created-source', translationGroupId: 'other-group' } },
    ])('rejects a contradictory or unusable created source %j', patch => {
      expect(() => Reflect.apply(createdArticleCmsId, undefined, [
        { _id: 'created-source', title: 'New source', ...patch }, expected,
      ])).toThrow();
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    });
  });

  describe('authorized language edition discovery', () => {
    let articles: Record<string, Record<string, unknown>>;
    let perLang: Record<string, unknown>;

    beforeEach(() => {
      vi.clearAllMocks();
      articles = Object.fromEntries(['en', 'hi', 'gu'].map(language => [`story-a-${language}`, {
        _id: `story-a-${language}`, title: `Story A ${language}`, lang: language, language,
        translationGroupId: 'group-a', slug: `original-${language}`,
        publishedAt: '2026-01-15T10:00:00.000Z', imageUrl: '/original.jpg',
      }]));
      perLang = Object.fromEntries(['en', 'hi', 'gu'].map(language => [language, { articleId: `story-a-${language}` }]));
      mocks.get.mockImplementation(async url => {
        if (url === 'articles/story-a-en/translation-status') return { data: { data: { perLang } } };
        const id = decodeURIComponent(url.slice('articles/'.length));
        if (!articles[id]) throw { response: { status: 404, data: {} } };
        return { data: { article: { ...articles[id] } } };
      });
    });

    it('reads only the anchored status and exact authorized editions, without list filtering', async () => {
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions).toMatchObject({ anchorId: 'story-a-en', translationGroupId: 'group-a' });
      expect(editions.rows.map(row => row._id)).toEqual(['story-a-en', 'story-a-hi', 'story-a-gu']);
      expect(mocks.get.mock.calls.map(([url]) => url)).toEqual([
        'articles/story-a-en', 'articles/story-a-en/translation-status', 'articles/story-a-hi', 'articles/story-a-gu',
      ]);
      expect(editions.rows[1]).toMatchObject({
        slug: 'original-hi', publishedAt: '2026-01-15T10:00:00.000Z', imageUrl: '/original.jpg',
      });
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each(editionLanguages)('opens a verified historical published %s edition without inventing a generation source', async language => {
      const id = `story-a-${language}`;
      const anchor: Record<string, unknown> = { ...articles[id], status: 'published' };
      const slots = Object.fromEntries(editionLanguages.map(lang => [lang, {
        lang, present: lang === language ? true : null, presence: lang === language ? 'present' : null,
        isSource: false, isTranslatedChild: false, sourceArticleId: null, childArticleId: null,
        articleId: lang === language ? id : null,
      }]));
      const languageStates = {
        baseLang: null, sourceArticleId: null, sourceArticle: null, siblingArticles: [],
        groupArticles: [{ id, lang: language, isSource: false }], presentLanguages: [language],
        translatedChildLanguages: [], missingLanguages: [], perLang: slots,
      };
      mocks.get.mockImplementation(async url => {
        if (url === `articles/${id}`) return { data: { article: anchor } };
        if (url === `articles/${id}/translation-status`) return {
          data: { ok: true, success: true, data: {
            id, baseLang: null, translationGroupKey: 'group-a', languageStates, perLang: slots,
          } },
        };
        throw new Error('Historical editing must not fetch unverified editions');
      });

      const editions = await getArticleTranslationEditions(id);
      expect(editions.rows).toHaveLength(1);
      expect(editions.rows[0]).toMatchObject({
        _id: id, title: anchor.title, slug: anchor.slug, publishedAt: anchor.publishedAt, status: 'published',
      });
      expect(editions.missingLanguages).toEqual([]);
      expect(editions.canonicalSourceId).toBeNull();
      expect(editions.generationSourceId).toBeNull();
      expect(editions.generationUnavailableReason).toMatch(/unverified/);
      expect(mocks.get.mock.calls.map(([url]) => url)).toEqual([`articles/${id}`, `articles/${id}/translation-status`]);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([undefined, null, {}, { articleId: null }, { state: 'pending' }])(
      'treats an incomplete HI entry %j as unverified, not permission to select or create it',
      async entry => {
        perLang.hi = entry;
        const editions = await getArticleTranslationEditions('story-a-en');
        expect(editions.rows.map(row => row.lang)).toEqual(['en', 'gu']);
        expect(mocks.get).not.toHaveBeenCalledWith('articles/story-a-hi');
        expect(mocks.post).not.toHaveBeenCalled();
      },
    );

    it('does not infer absence from an omitted language key', async () => {
      delete perLang.hi;
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions.rows.map(row => row.lang)).toEqual(['en', 'gu']);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([123, false, {}, [], '', ' ', ' story-a-hi', 'story-a-hi ', '../other', 'id?other', 'id\\other'])(
      'rejects invalid returned article ID %j without coercion',
      async articleId => {
        perLang.hi = { articleId };
        await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/Invalid or ambiguous/);
        expect(mocks.get).toHaveBeenCalledTimes(2);
        expect(mocks.post).not.toHaveBeenCalled();
      },
    );

    it.each(['', ' ', '../other', 'id?other'])('rejects invalid anchor ID %j before reading', async id => {
      await expect(getArticleTranslationEditions(id)).rejects.toThrow(/valid CMS article ID/);
      expect(mocks.get).not.toHaveBeenCalled();
    });

    it.each([null, {}, { articleId: null }, { articleId: 'different-en' }])('requires the status to identify the anchor (%j)', async entry => {
      perLang.en = entry;
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/did not verify the current article/);
      expect(mocks.get).toHaveBeenCalledTimes(2);
    });

    it('rejects duplicate IDs assigned to different language slots', async () => {
      perLang.hi = { articleId: 'story-a-en' };
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/ambiguous/);
    });

    it.each([
      { _id: 'different-hi' },
      { sourceNewsId: 'different-hi' },
      { _id: {} },
      { lang: 'gu', language: 'gu' },
      { lang: 'hi', language: 'en' },
      { lang: 'unknown', language: 'unknown' },
      { lang: 5, language: 'hi' },
      { translationGroupId: 'group-b' },
      { translationGroupId: null },
      { translationGroupId: {} },
      { translationGroupId: 'group-a ' },
    ])('rejects mismatched detail identity %j without using unrelated records', async patch => {
      articles['story-a-hi'] = { ...articles['story-a-hi'], ...patch };
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/identity|Invalid/);
      expect(mocks.get.mock.calls.every(([url]) => url !== 'articles')).toBe(true);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it('rejects an anchor detail with a different CMS ID', async () => {
      articles['story-a-en']._id = 'unrelated-en';
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/requested article identity/);
      expect(mocks.get).toHaveBeenCalledTimes(1);
    });

    it('preserves explicit CMS identity without substituting a public-copy ID', async () => {
      articles['story-a-en']._id = 'public-copy';
      articles['story-a-en'].sourceNewsId = 'story-a-en';
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions.anchorId).toBe('story-a-en');
      expect(editions.rows[0]).toMatchObject({ _id: 'public-copy', sourceNewsId: 'story-a-en' });
      expect(mocks.get).not.toHaveBeenCalledWith('articles/public-copy');
    });

    it('cannot link separate records when the anchor has no group identity', async () => {
      Object.values(articles).forEach(article => { delete article.translationGroupId; });
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/does not match this story/);
    });

    it('can verify only a standalone anchor without claiming its other editions are absent', async () => {
      delete articles['story-a-en'].translationGroupId;
      perLang = { en: { articleId: 'story-a-en' } };
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions).toMatchObject({ anchorId: 'story-a-en', translationGroupId: null });
      expect(editions.rows).toHaveLength(1);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each(['pending', 'failed', 'ready'])('recognizes verified absence independently of stored status %s', async status => {
      articles['story-a-en'].sourceLanguage = 'en';
      perLang.gu = { ...missingEdition, status };
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions).toMatchObject({
        missingLanguages: ['gu'], generationSourceId: 'story-a-en', generationUnavailableReason: null,
        translationStates: { gu: status },
      });
      expect(editions.rows.map(row => row.lang)).toEqual(['en', 'hi']);
      expect(mocks.get).not.toHaveBeenCalledWith('articles/story-a-gu');
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each(['pending', 'failed', 'ready'])('does not confuse a present edition with its stored status %s', async status => {
      perLang.hi = { present: true, presence: 'present', articleId: 'story-a-hi', childArticleId: 'story-a-hi', status };
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions.missingLanguages).toEqual([]);
      expect(editions.rows.map(row => row.lang)).toEqual(['en', 'hi', 'gu']);
    });

    it.each(['present', 'presence', 'articleId', 'childArticleId'])('requires the complete absence marker, including %s', async key => {
      const incomplete: Record<string, unknown> = { ...missingEdition };
      delete incomplete[key];
      perLang.gu = incomplete;
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions.missingLanguages).toEqual([]);
      expect(editions.generationSourceId).toBeNull();
      expect(editions.generationUnavailableReason).toMatch(/Duplicate editions cannot be ruled out/);
    });

    it.each([
      { ...missingEdition, articleId: 'story-a-gu' },
      { ...missingEdition, childArticleId: 'story-a-gu' },
      { ...missingEdition, present: true },
      { articleId: 'story-a-gu', childArticleId: 'other-gu' },
      { articleId: 'story-a-gu', childArticleId: 123 },
      { articleId: 'story-a-gu', presence: 'duplicate' },
      { articleId: 'story-a-gu', lang: 'hi' },
      [{ articleId: 'story-a-gu' }, { articleId: 'other-gu' }],
    ])('rejects contradictory or duplicate edition evidence %j', async entry => {
      perLang.gu = entry;
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/Invalid or ambiguous/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each(['story-a-en', 'story-a-hi'])('rejects conflicting translationKey on %s', async id => {
      articles[id].translationKey = 'other-group';
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/translationKey and translationGroupId conflict/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it('accepts agreeing group keys and resolves the canonical source from a linked-language anchor', async () => {
      Object.values(articles).forEach(article => {
        article.sourceLanguage = 'en';
        article.translationKey = 'group-a';
      });
      perLang.gu = { ...missingEdition };
      const get = mocks.get.getMockImplementation()!;
      mocks.get.mockImplementation(async url => url === 'articles/story-a-hi/translation-status'
        ? { data: { data: { perLang } } } : get(url));
      const editions = await getArticleTranslationEditions('story-a-hi');
      expect(editions).toMatchObject({
        anchorId: 'story-a-hi', generationSourceId: 'story-a-en', missingLanguages: ['gu'], generationUnavailableReason: null,
      });
    });

    it.each([
      {},
      { sourceLanguage: 'unknown' },
      { sourceLanguage: 'gu' },
      { sourceLanguage: 'en', originalLanguage: 'hi' },
      { sourceLanguage: 'en', sourceArticle: { _id: 'unrelated-en' } },
      { sourceLanguage: 'en', sourceArticle: { _id: 'unrelated-en', sourceNewsId: 'story-a-en' } },
      { sourceLanguage: 'en', sourceArticle: { _id: 'story-a-hi' } },
      { sourceLanguage: 'en', sourceArticle: { _id: 'story-a-en', lang: 'hi' } },
    ])('fails closed for uncertain canonical source metadata %j', async metadata => {
      Object.assign(articles['story-a-en'], metadata);
      perLang.gu = { ...missingEdition };
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions.missingLanguages).toEqual(['gu']);
      expect(editions.generationSourceId).toBeNull();
      expect(editions.generationUnavailableReason).toMatch(/source/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it('does not invent a generation source for an ungrouped story', async () => {
      articles['story-a-en'].sourceLanguage = 'en';
      delete articles['story-a-en'].translationGroupId;
      perLang.hi = { ...missingEdition };
      perLang.gu = { ...missingEdition };
      const editions = await getArticleTranslationEditions('story-a-en');
      expect(editions.missingLanguages).toEqual(['hi', 'gu']);
      expect(editions.generationSourceId).toBeNull();
      expect(editions.generationUnavailableReason).toMatch(/Duplicate editions cannot be ruled out/);
    });

    it('rejects duplicate record aliases even when CMS IDs differ', async () => {
      articles['story-a-hi']._id = 'story-a-en';
      articles['story-a-hi'].sourceNewsId = 'story-a-hi';
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/Duplicate language edition identities/);
    });

    it.each([
      { translationGroupId: 'other-group' },
      { translationGroupId: 'group-a', translationKey: 'other-group' },
    ])('rejects conflicting group metadata in the status response %j', async metadata => {
      const get = mocks.get.getMockImplementation()!;
      mocks.get.mockImplementation(async url => url.endsWith('/translation-status')
        ? { data: { data: { perLang, ...metadata } } } : get(url));
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/group identity|conflict/);
    });

    it('rejects another group claiming an otherwise exact missing-edition marker', async () => {
      perLang.gu = { ...missingEdition, translationGroupId: 'other-group' };
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/group identity/);
    });

    it('does not ignore conflicting canonical source metadata from translation status', async () => {
      articles['story-a-en'].sourceLanguage = 'en';
      perLang.gu = { ...missingEdition };
      const get = mocks.get.getMockImplementation()!;
      mocks.get.mockImplementation(async url => url.endsWith('/translation-status')
        ? { data: { data: { perLang, sourceLanguage: 'hi' } } } : get(url));
      expect(await getArticleTranslationEditions('story-a-en')).toMatchObject({
        generationSourceId: null, generationUnavailableReason: expect.stringContaining('canonical source identity'),
      });
    });

    it.each([{ ok: false }, { success: false }, { status: 503 }])('rejects an unsuccessful status envelope despite populated data %j', async flags => {
      const get = mocks.get.getMockImplementation()!;
      mocks.get.mockImplementation(async url => url.endsWith('/translation-status')
        ? { data: { ...flags, data: { perLang } } } : get(url));
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/could not be verified/);
    });

    it.each([{}, { data: {} }, { data: { perLang: [] } }, { data: { perLang: 'invalid' } }])(
      'rejects an unsupported status envelope %j',
      async body => {
        const get = mocks.get.getMockImplementation()!;
        mocks.get.mockImplementation(async url => url.endsWith('/translation-status') ? { data: body } : get(url));
        await expect(getArticleTranslationEditions('story-a-en')).rejects.toThrow(/could not be verified/);
      },
    );

    it.each([
      [401, 'translation-status'], [403, 'translation-status'], [409, 'translation-status'], [503, 'translation-status'],
      [401, 'story-a-hi'], [403, 'story-a-hi'], [409, 'story-a-hi'], [503, 'story-a-hi'],
    ])('propagates HTTP %s from %s without requiring body flags or falling back', async (status, suffix) => {
      const error = { response: { status, data: {} } };
      const get = mocks.get.getMockImplementation()!;
      mocks.get.mockImplementation(async url => {
        if (url.endsWith(String(suffix))) throw error;
        return get(url);
      });
      await expect(getArticleTranslationEditions('story-a-en')).rejects.toBe(error);
      expect(mocks.get.mock.calls.every(([url]) => url !== 'articles')).toBe(true);
      expect(mocks.post).not.toHaveBeenCalled();
    });
  });

  describe('Backend-shaped edition identity', () => {
    let articles: Record<string, Article>;
    let status: ReturnType<typeof backendTranslationStatus>;

    function configure(sourceLanguage: typeof editionLanguages[number], editLanguage: typeof editionLanguages[number]) {
      articles = Object.fromEntries(editionLanguages.map(language => [`story-a-${language}`, {
        _id: `story-a-${language}`, title: `Saved ${language} edition`, lang: language, language,
        originalLang: language, sourceLanguage, sourceArticleId: `story-a-${sourceLanguage}`,
        translationGroupId: 'group-a', translationKey: 'group-a', status: 'published',
        slug: `original-${language}`, publishedAt: '2026-01-15T10:00:00.000Z',
      }]));
      status = backendTranslationStatus(articles[`story-a-${editLanguage}`], Object.values(articles));
      mocks.get.mockImplementation(async url => {
        if (url === `articles/story-a-${editLanguage}/translation-status`) return { data: status };
        const article = articles[url.slice('articles/'.length)];
        if (!article) throw new Error('Unexpected article read');
        return { data: { ok: true, success: true, article: { ...article } } };
      });
    }

    beforeEach(() => configure('gu', 'hi'));

    it.each(sourceEditLanguageCases)('verifies $sourceLanguage source from the $editLanguage edition', async ({ sourceLanguage, editLanguage }) => {
      configure(sourceLanguage, editLanguage);
      expect(status.data).toMatchObject({
        id: `story-a-${editLanguage}`, baseLang: sourceLanguage,
        languageStates: { sourceArticleId: `story-a-${sourceLanguage}`, sourceArticle: { id: `story-a-${sourceLanguage}`, lang: sourceLanguage } },
      });
      expect(status.data.perLang[sourceLanguage]).toMatchObject({ presence: 'source', articleId: `story-a-${sourceLanguage}`, childArticleId: null });
      for (const language of editionLanguages.filter(code => code !== sourceLanguage)) {
        expect(status.data.perLang[language]).toMatchObject({ presence: 'translated', sourceArticleId: null, articleId: `story-a-${language}`, childArticleId: `story-a-${language}` });
      }
      const before = structuredClone(articles);
      const editions = await getArticleTranslationEditions(`story-a-${editLanguage}`);
      expect(editions).toMatchObject({
        anchorId: `story-a-${editLanguage}`, translationGroupId: 'group-a',
        generationSourceId: `story-a-${sourceLanguage}`, generationUnavailableReason: null, missingLanguages: [],
      });
      expect(editions.rows.map(row => row._id).sort()).toEqual(Object.keys(articles).sort());
      expect(articles).toEqual(before);
      expect(mocks.get.mock.calls.map(([url]) => url)).toEqual([
        `articles/story-a-${editLanguage}`, `articles/story-a-${editLanguage}/translation-status`,
        ...['en', 'hi', 'gu'].filter(language => language !== editLanguage).map(language => `articles/story-a-${language}`),
      ]);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each(sourceEditLanguageCases)('retains the older anchor-relative contract for $sourceLanguage/$editLanguage', async ({ sourceLanguage, editLanguage }) => {
      configure(sourceLanguage, editLanguage);
      status = backendTranslationStatus(articles[`story-a-${editLanguage}`], Object.values(articles), { anchorRelative: true });
      expect(status.data.baseLang).toBe(editLanguage);
      expect(await getArticleTranslationEditions(`story-a-${editLanguage}`)).toMatchObject({
        canonicalSourceId: `story-a-${sourceLanguage}`, generationSourceId: `story-a-${sourceLanguage}`,
      });
    });

    it.each(sourceEditLanguageCases.flatMap(combination => [true, false].map(omitPresence => ({ ...combination, omitPresence }))))(
      'retains legacy presence labels with nested status for $sourceLanguage/$editLanguage (omitted: $omitPresence)',
      async ({ sourceLanguage, editLanguage, omitPresence }) => {
        configure(sourceLanguage, editLanguage);
        status = backendTranslationStatus(articles[`story-a-${editLanguage}`], Object.values(articles), { anchorRelative: true });
        Object.values(status.data.perLang).forEach(entry => {
          if (omitPresence) Reflect.deleteProperty(entry, 'presence');
          else entry.presence = 'present';
        });
        expect(await getArticleTranslationEditions(`story-a-${editLanguage}`)).toMatchObject({
          canonicalSourceId: `story-a-${sourceLanguage}`, generationSourceId: `story-a-${sourceLanguage}`,
        });
      },
    );

    it.each(sourceEditLanguageCases.flatMap(combination => legacyEditionVariants.map(variant => ({ ...combination, variant }))))(
      'verifies legacy $variant for $sourceLanguage source / $editLanguage edition without inventing metadata',
      async ({ sourceLanguage, editLanguage, variant }) => {
        configure(sourceLanguage, editLanguage);
        applyLegacyEditionVariant(Object.values(articles), sourceLanguage, variant);
        const before = structuredClone(articles);
        status = backendTranslationStatus(articles[`story-a-${editLanguage}`], Object.values(articles));
        const editions = await getArticleTranslationEditions(`story-a-${editLanguage}`);
        expect(editions.canonicalSourceId).toBe(`story-a-${sourceLanguage}`);
        expect(editions.rows.map(row => [row._id, row.lang]).sort()).toEqual(
          editionLanguages.map(language => [`story-a-${language}`, language]).sort(),
        );
        for (const row of editions.rows) {
          expect(row.translationGroupId).toBe(before[row._id].translationGroupId);
          expect(row.translationKey).toBe(before[row._id].translationKey);
          expect(row.sourceArticleId).toBe(before[row._id].sourceArticleId);
          expect(row.translationMeta).toEqual(before[row._id].translationMeta);
        }
        expect(editions.generationSourceId).toBe(`story-a-${sourceLanguage}`);
        expect(editions.generationUnavailableReason).toBeNull();
        expect(articles).toEqual(before);
        expect(mocks.post).not.toHaveBeenCalled();
      },
    );

    it.each(['absent', 'placeholder'] as const)('does not treat %s groups as membership proof without CMS source links', async variant => {
      Object.values(articles).forEach(article => {
        delete article.sourceArticleId;
        article.translationGroupId = variant === 'placeholder' ? 'null' : undefined;
        article.translationKey = variant === 'placeholder' ? 'undefined' : undefined;
      });
      status = backendTranslationStatus(articles['story-a-hi'], Object.values(articles));
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/source identity.*unverified/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it('does not adopt a group-less child through nested-only linkage', async () => {
      applyLegacyEditionVariant(Object.values(articles), 'gu', 'all-missing-groups');
      articles['story-a-hi'].translationMeta = { sourceArticleId: 'story-a-gu' };
      delete articles['story-a-hi'].sourceArticleId;
      status = backendTranslationStatus(articles['story-a-hi'], Object.values(articles));
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/authoritative CMS source linkage/);
    });

    it.each(['sourceArticleId', 'sourceArticle', 'perLang'] as const)('rejects conflicting nested status %s', async field => {
      if (field === 'sourceArticleId') status.data.languageStates.sourceArticleId = 'story-a-en';
      if (field === 'sourceArticle') status.data.languageStates.sourceArticle.id = 'story-a-en';
      if (field === 'perLang') status.data.languageStates.perLang.hi.articleId = 'story-a-en';
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/[Nn]ested/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([
      { sourceArticleId: 'story-a-en' },
      { sourceLanguage: 'hi' },
      { translationMeta: { sourceArticleId: 'story-a-en' } },
      { translationMeta: { sourceLanguage: 'English' } },
    ])('fails closed for conflicting legacy canonical metadata %j', async patch => {
      applyLegacyEditionVariant(Object.values(articles), 'gu', 'all-missing-groups');
      Object.assign(articles['story-a-hi'], patch);
      status = backendTranslationStatus(articles['story-a-hi'], Object.values(articles));
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/source identity.*unverified/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it('rejects conflicting native/target languages even when originalLang agrees with the source', async () => {
      articles['story-a-hi'].originalLang = 'gu';
      articles['story-a-hi'].translationMeta = { targetLanguage: 'Gujarati', sourceArticleId: 'story-a-gu' };
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/inconsistent.*language/);
    });

    it.each(['lang', 'language', 'targetLanguage'] as const)('does not silently fill an invalid whitespace-only %s', async field => {
      if (field === 'targetLanguage') articles['story-a-hi'].translationMeta = { targetLanguage: ' ' };
      else articles['story-a-hi'][field] = ' ';
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/inconsistent.*language/);
    });

    it('uses verified nested CMS identity for generation, but rejects a conflicting nested ID', async () => {
      applyLegacyEditionVariant(Object.values(articles), 'gu', 'nested-canonical-metadata');
      delete articles['story-a-en'];
      status = backendTranslationStatus(articles['story-a-hi'], Object.values(articles));
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: 'story-a-gu', missingLanguages: ['en'], generationUnavailableReason: null,
      });
      articles['story-a-hi'].translationMeta = { sourceArticleId: 'unrelated-source', sourceLanguage: 'gu' };
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: null, generationUnavailableReason: expect.stringContaining('verified CMS edition'),
      });
    });

    it('does not accept a source reference with conflicting id aliases', async () => {
      articles['story-a-hi'].sourceArticle = { id: 'story-a-gu', _id: 'story-a-en', lang: 'gu' };
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({ generationSourceId: null });
    });

    it('accepts an independently corroborated source summary using its Backend id field', async () => {
      articles['story-a-hi'].sourceArticle = { id: 'story-a-gu', lang: 'Gujarati' };
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({ generationSourceId: 'story-a-gu' });
    });

    it('resolves scalar CMS sourceArticleId without treating per-edition originalLang as a source claim', async () => {
      Object.values(articles).forEach(article => { delete article.sourceLanguage; });
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: 'story-a-gu', generationUnavailableReason: null,
      });
    });

    it('validates sourceArticleId against the CMS alias, never a public-copy ID', async () => {
      articles['story-a-gu'] = { ...articles['story-a-gu'], _id: 'public-copy-gu', sourceNewsId: 'story-a-gu' };
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({ generationSourceId: 'story-a-gu' });
      articles['story-a-hi'].sourceArticleId = 'public-copy-gu';
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: null, generationUnavailableReason: expect.stringContaining('CMS edition'),
      });
      expect(mocks.get).not.toHaveBeenCalledWith('articles/public-copy-gu');
    });

    it.each(['', ' ', '../other', 'unrelated-id', 'group-a', 123, {}])('blocks generation with invalid or foreign sourceArticleId %j', async sourceArticleId => {
      Object.assign(articles['story-a-hi'], { sourceArticleId });
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: null, generationUnavailableReason: expect.stringContaining('source article ID'),
      });
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it('rejects disagreeing canonical source IDs even when both are members of the group', async () => {
      articles['story-a-hi'].sourceArticleId = 'story-a-en';
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: null, generationUnavailableReason: expect.stringContaining('uncertain'),
      });
    });

    it('does not accept an agreed CMS source ID with a conflicting canonical language', async () => {
      Object.values(articles).forEach(article => { article.sourceLanguage = 'en'; });
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: null, generationUnavailableReason: expect.stringContaining('inconsistent'),
      });
    });

    it('does not guess the canonical source from an anchor-relative source marker or differing originalLang values', async () => {
      Object.values(articles).forEach(article => { delete article.sourceArticleId; delete article.sourceLanguage; });
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: null, generationUnavailableReason: expect.stringContaining('uncertain'),
      });
    });

    it('retains agreeing legacy originalLang-only canonical evidence', async () => {
      Object.values(articles).forEach(article => {
        delete article.sourceArticleId;
        delete article.sourceLanguage;
        article.originalLang = 'gu';
      });
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({ generationSourceId: 'story-a-gu' });
    });

    it.each([
      { articleId: null }, { articleId: 'story-a-gu' }, { childArticleId: 'unrelated-id' },
      { sourceArticleId: 'unrelated-id' }, { presence: 'duplicate' }, { present: false },
      { isSource: true }, { isTranslatedChild: false },
    ])('rejects conflicting translated slot evidence %j', async patch => {
      Object.assign(status.data.perLang.hi, patch);
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/ambiguous/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([
      { sourceArticleId: 'story-a-hi' }, { isSource: false }, { isTranslatedChild: true },
    ])('rejects conflicting canonical source slot evidence %j', async patch => {
      Object.assign(status.data.perLang.gu, patch);
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/ambiguous/);
    });

    it('rejects multiple source slots instead of arbitrarily choosing one', async () => {
      Object.assign(status.data.perLang.hi, { presence: 'source', sourceArticleId: 'story-a-hi', isSource: true, isTranslatedChild: false });
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/ambiguous/);
    });

    it.each([
      { id: 'unrelated-id' }, { id: null }, { translationGroupKey: 'other-group' },
      { translationGroupKey: null }, { baseLang: 'hi' },
    ])('rejects conflicting status anchor metadata %j', async patch => {
      Object.assign(status.data, patch);
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/match/);
    });

    it('requires a real missing slot, not a source ID hidden behind an absence marker', async () => {
      Object.assign(status.data.perLang.en, missingEdition, { sourceArticleId: 'story-a-en' });
      await expect(getArticleTranslationEditions('story-a-hi')).rejects.toThrow(/ambiguous/);
    });

    it('verifies missing languages using the real Backend response without creating or reading the absent edition', async () => {
      delete articles['story-a-en'];
      status = backendTranslationStatus(articles['story-a-hi'], Object.values(articles));
      expect(await getArticleTranslationEditions('story-a-hi')).toMatchObject({
        generationSourceId: 'story-a-gu', missingLanguages: ['en'], generationUnavailableReason: null,
      });
      expect(mocks.get).not.toHaveBeenCalledWith('articles/story-a-en');
      expect(mocks.post).not.toHaveBeenCalled();
    });
  });

  describe('Backend language normalization', () => {
    it.each([
      ['gu', 'gu'], ['GU-IN', 'gu'], ['gu_IN', 'gu'], ['Gujarati', 'gu'], ['Gujrati', 'gu'], ['guj', 'gu'], ['ગુજરાતી', 'gu'],
      ['hi', 'hi'], ['HI-IN', 'hi'], ['hi_IN', 'hi'], ['Hindi', 'hi'], ['hin', 'hi'], ['हिंदी', 'hi'],
      ['en', 'en'], ['EN-US', 'en'], ['en_IN', 'en'], ['English', 'en'], ['eng', 'en'],
    ])('normalizes %s only to %s', (value, expected) => {
      expect(normalizeArticleLanguageCode(value)).toBe(expected);
      expect(articleEditionLanguage({ originalLang: value })).toBe(expected);
    });

    it.each([undefined, null, {}, 123, '', 'xx', 'Marathi'])('does not default unsupported identity language %j', value => {
      expect(normalizeArticleLanguageCode(value)).toBeNull();
    });
  });

  describe('verified missing-edition generation contract', () => {
    it('uses the CMS endpoint, targetLanguages and overwrite:false, with no legacy fallback', async () => {
      await generateMissingArticleTranslations('cms source', { targetLanguages: ['gu'] });
      expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
        'articles/cms%20source/translations/generate', { targetLanguages: ['gu'], overwrite: false },
      );
    });

    it.each(['', ' ', '../other', 'id?other', 'id\\other'])('rejects invalid source ID %j before writing', async id => {
      await expect(generateMissingArticleTranslations(id, { targetLanguages: ['gu'] })).rejects.toThrow(/valid CMS source ID/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([[], ['gu', 'gu'], ['fr'], ['GU'], [123], null])('rejects invalid target languages %j before writing', async languages => {
      await expect(Reflect.apply(generateMissingArticleTranslations, undefined, ['source', { targetLanguages: languages }]))
        .rejects.toThrow(/valid, distinct/);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([401, 403, 409, 503])('surfaces generation HTTP %s without retrying or falling back', async status => {
      const error = apiError(status, 'Generation denied or unavailable');
      mocks.post.mockRejectedValueOnce(error);
      await expect(generateMissingArticleTranslations('source', { targetLanguages: ['gu'] })).rejects.toBe(error);
      expect(mocks.post).toHaveBeenCalledTimes(1);
    });

    it.each([null, {}, { ok: false, status: 403 }, { success: false, status: 409 }])(
      'does not acknowledge an unavailable or rejected generation response %j', async data => {
        mocks.post.mockResolvedValueOnce({ data });
        await expect(generateMissingArticleTranslations('source', { targetLanguages: ['gu'] })).rejects.toThrow();
        expect(mocks.post).toHaveBeenCalledTimes(1);
      },
    );
  });

  it.each([
    { sourceLanguage: 'gu', languages: ['en'] },
    { sourceLanguage: 'gu', languages: ['hi'] },
    { sourceLanguage: 'hi', languages: ['gu'] },
    { sourceLanguage: 'en', languages: ['gu'] },
    { sourceLanguage: 'gu', languages: ['hi', 'en'] },
    { sourceLanguage: 'en', languages: ['hi', 'gu'] },
  ])('serializes only requested targets for $sourceLanguage -> $languages', async ({ sourceLanguage, languages }) => {
    const selected = [...languages];
    await requeueArticleTranslations(`source ${sourceLanguage}`, { languages: selected });

    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      `admin/articles/source%20${sourceLanguage}/translations/generate`, { targetLanguages: languages },
    );
    expect(selected).toEqual(languages);
    expect(mocks.get).not.toHaveBeenCalled();
    const path = String(mocks.post.mock.calls[0][0]);
    expect(path).not.toContain('queue-translations');
    expect(path).not.toContain('requeue-translations');
  });

  it('does not authorize overwrites or alter acknowledged existing edition identities', async () => {
    const receipt = backendGenerationReceipt('gu', 'existing-group', ['en'], {}, {
      en: { id: 'existing-en-edition', reason: 'human_edited' },
    });
    const before = structuredClone(receipt);
    mocks.post.mockResolvedValueOnce({ data: receipt });

    expect(await requeueArticleTranslations('existing-gu-source', { languages: ['en'] })).toEqual(before);
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      'admin/articles/existing-gu-source/translations/generate', { targetLanguages: ['en'] },
    );
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('overwrite');
    expect(receipt).toEqual(before);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it.each([undefined, {}])('preserves the existing default only when targets are omitted: %j', async opts => {
    await requeueArticleTranslations('article-2', opts);

    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('admin/articles/article-2/translations/generate', undefined);
  });

  it.each([{ codes: [] }, { codes: ['zz'] }, { codes: ['gu', 'gu'] }])('never converts invalid News Table targets to generate-all: $codes', async ({ codes }) => {
    await expect(requeueArticleTranslations('article-2', { languages: codes })).rejects.toThrow(/valid, distinct/);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('preserves Community draft attribution and its receipt without publishing, translating or retrying', async () => {
    const receipt = { ok: true, status: 201, article: { _id: 'community-cms', status: 'draft' } };
    mocks.post.mockResolvedValueOnce({ data: receipt });
    await expect(createCommunityArticle({ title: 'Community draft', summary: 'Summary', status: 'draft' })).resolves.toEqual(receipt);
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('articles', {
      title: 'Community draft', summary: 'Summary', description: 'Summary', status: 'draft',
      isCommunity: true, source: 'community-reporter', origin: 'community-reporter',
    });
    const denied = apiError(403, 'Forbidden');
    mocks.post.mockRejectedValueOnce(denied);
    await expect(createCommunityArticle({ title: 'Not authorized' })).rejects.toBe(denied);
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [409, 'Translation group conflict'],
    [503, 'Translation service unavailable'],
    [400, 'Select at least one target language'],
    [500, 'Translation generation failed'],
  ])('surfaces backend status %s without fallback endpoints', async (status, message) => {
    mocks.post.mockRejectedValueOnce(apiError(status, message));

    await expect(requeueArticleTranslations('article-3', { languages: ['hi'] })).rejects.toMatchObject({
      response: { status, data: { message } },
    });

    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      'admin/articles/article-3/translations/generate', { targetLanguages: ['hi'] },
    );
    const path = String(mocks.post.mock.calls[0][0]);
    expect(path).toBe('admin/articles/article-3/translations/generate');
    expect(path).not.toContain('queue-translations');
    expect(path).not.toContain('requeue-translations');
  });

  it.each([null, {}, { ok: false, status: 403 }, { success: false, status: 409 }])(
    'does not acknowledge a failed or unavailable normal generation response %j', async data => {
      mocks.post.mockResolvedValueOnce({ data });
      await expect(requeueArticleTranslations('created-source', { languages: ['hi', 'en'] })).rejects.toThrow();
      expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
        'admin/articles/created-source/translations/generate', { targetLanguages: ['hi', 'en'] },
      );
    },
  );
});