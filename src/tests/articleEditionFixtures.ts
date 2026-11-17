import type { Article } from '@/lib/api/articles';

export const editionLanguages = ['gu', 'hi', 'en'] as const;

export function backendTranslationStatus(anchor: Article, rows: readonly Article[]) {
  const cmsId = (row: Article) => row.sourceNewsId || row._id;
  const languageOf = (row: Article) => row.lang || row.language || row.originalLang;
  const linkedId = anchor.sourceArticleId || anchor.translationMeta?.sourceArticleId
    || rows.map(row => row.sourceArticleId || row.translationMeta?.sourceArticleId).find(Boolean);
  const source = rows.find(row => cmsId(row) === linkedId)
    || rows.find(row => languageOf(row) === anchor.sourceLanguage) || anchor;
  const baseLang = languageOf(source);
  const sourceId = cmsId(source);
  const summarize = (row: Article) => ({
    id: cmsId(row), lang: languageOf(row), originalLang: row.originalLang || null,
    status: row.status || null, slug: row.slug || null, title: row.title,
    isSource: cmsId(row) === sourceId,
  });
  const sourceArticle = summarize(source);
  const siblingArticles = rows.filter(row => cmsId(row) !== sourceId).map(summarize);
  const perLang = Object.fromEntries(editionLanguages.map(lang => {
    const child = rows.find(row => cmsId(row) !== sourceId && languageOf(row) === lang);
    const isSource = lang === baseLang;
    return [lang, {
      status: null, error: null, updatedAt: null, nextRetryAt: null,
      present: isSource || !!child, presence: isSource ? 'source' : child ? 'translated' : 'missing',
      isSource, isTranslatedChild: !!child && !isSource,
      sourceArticleId: isSource ? sourceId : null,
      childArticleId: child ? cmsId(child) : null,
      articleId: isSource ? sourceId : child ? cmsId(child) : null,
    }];
  }));
  const languageStates = {
    baseLang, sourceArticleId: sourceId, sourceArticle, siblingArticles,
    groupArticles: [sourceArticle, ...siblingArticles],
    presentLanguages: editionLanguages.filter(lang => perLang[lang].present),
    translatedChildLanguages: editionLanguages.filter(lang => perLang[lang].isTranslatedChild),
    missingLanguages: editionLanguages.filter(lang => !perLang[lang].present),
    perLang: Object.fromEntries(editionLanguages.map(lang => {
      const entry = perLang[lang];
      const row = rows.find(item => cmsId(item) === entry.articleId);
      const { status: _status, error: _error, updatedAt: _updatedAt, nextRetryAt: _nextRetryAt, ...identity } = entry;
      return [lang, {
        lang, ...identity, slug: row?.slug || null, title: row?.title || null, articleStatus: row?.status || null,
      }];
    })),
  };
  return {
    ok: true, success: true,
    data: {
      id: cmsId(anchor), slug: anchor.slug || null, title: anchor.title, baseLang,
      translationGroupKey: anchor.translationGroupId || anchor.translationKey || null,
      languageStates, perLang,
    },
  };
}
