import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { createdArticleCmsId, generateMissingArticleTranslations, getArticleTranslationEditions, requeueArticleTranslations } from '@/lib/api/articles';

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

  it('uses the canonical admin translation generation endpoint with requested languages', async () => {
    await requeueArticleTranslations('article 1', { languages: ['hi', 'gu'] });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith('admin/articles/article%201/translations/generate', { languages: ['hi', 'gu'] });
    const path = String(mocks.post.mock.calls[0][0]);
    expect(path).not.toContain('queue-translations');
    expect(path).not.toContain('requeue-translations');
  });

  it('omits the payload when no target languages are requested', async () => {
    await requeueArticleTranslations('article-2');

    expect(mocks.post).toHaveBeenCalledWith('admin/articles/article-2/translations/generate', undefined);
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

    expect(mocks.post).toHaveBeenCalledTimes(1);
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
        'admin/articles/created-source/translations/generate', { languages: ['hi', 'en'] },
      );
    },
  );
});