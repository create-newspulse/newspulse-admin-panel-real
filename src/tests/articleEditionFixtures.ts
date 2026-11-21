import type { Article } from '@/lib/api/articles';

export const editionLanguages = ['gu', 'hi', 'en'] as const;
export const sourceEditLanguageCases = editionLanguages.flatMap(sourceLanguage =>
  editionLanguages.map(editLanguage => ({ sourceLanguage, editLanguage })),
);

export const legacyEditionVariants = [
  'child-missing-groups', 'source-missing-groups', 'all-missing-groups', 'placeholder-groups',
  'placeholder-group-with-key', 'translation-key-only', 'original-language-only-source',
  'language-aliases', 'nested-canonical-metadata', 'source-without-self-link',
  'child-with-nested-link', 'group-only-child', 'inherited-original-language',
  'trimmed-group-keys', 'non-canonical-original-language',
] as const;

export function applyLegacyEditionVariant(
  rows: readonly Article[], sourceLanguage: typeof editionLanguages[number], variant: typeof legacyEditionVariants[number],
) {
  const source = rows.find(row => row.lang === sourceLanguage)!;
  const child = rows.find(row => row.lang !== sourceLanguage)!;
  const removeGroups = (row: Article) => { delete row.translationGroupId; delete row.translationKey; };
  switch (variant) {
    case 'child-missing-groups': removeGroups(child); break;
    case 'source-missing-groups': removeGroups(source); break;
    case 'all-missing-groups': rows.forEach(removeGroups); break;
    case 'placeholder-groups':
      rows.forEach(row => { row.translationGroupId = ' NuLl '; row.translationKey = 'UNDEFINED'; });
      break;
    case 'placeholder-group-with-key': child.translationGroupId = 'null'; break;
    case 'translation-key-only': rows.forEach(row => { delete row.translationGroupId; }); break;
    case 'original-language-only-source': delete source.lang; delete source.language; break;
    case 'language-aliases': {
      const labels: Record<string, string> = { gu: 'Gujrati', hi: 'Hindi', en: 'English' };
      rows.forEach(row => {
        const code = row.lang!;
        row.lang = `${code.toUpperCase()}_IN`;
        row.language = labels[code];
        row.sourceLanguage = labels[sourceLanguage];
      });
      break;
    }
    case 'nested-canonical-metadata':
      rows.forEach(row => {
        row.translationMeta = { sourceArticleId: row.sourceArticleId, sourceLanguage: row.sourceLanguage, targetLanguage: row.lang };
        delete row.sourceArticleId;
        delete row.sourceLanguage;
      });
      break;
    case 'source-without-self-link': delete source.sourceArticleId; break;
    case 'child-with-nested-link':
      child.translationMeta = { sourceArticleId: child.sourceArticleId, sourceLanguage: child.sourceLanguage, targetLanguage: child.lang };
      delete child.sourceArticleId;
      break;
    case 'group-only-child': delete child.sourceArticleId; break;
    case 'inherited-original-language': rows.forEach(row => { row.originalLang = sourceLanguage; }); break;
    case 'trimmed-group-keys':
      rows.forEach(row => { row.translationGroupId = ` ${row.translationGroupId} `; row.translationKey = ` ${row.translationKey} `; });
      break;
    case 'non-canonical-original-language': rows.forEach(row => { row.originalLang = 'unknown'; }); break;
  }
}

export function backendGenerationReceipt(
  sourceLanguage: typeof editionLanguages[number], translationGroupId: string,
  targetLanguages: Array<typeof editionLanguages[number]>, created: Partial<Record<typeof editionLanguages[number], string>>,
  skipped: Partial<Record<typeof editionLanguages[number], { id: string; reason: 'exists' | 'human_edited' }>> = {},
) {
  return {
    ok: true, success: true, status: 'review_required', provider: 'google_translate',
    sourceLanguage, targetLanguages, sourceHash: 'synthetic-source-hash', translationGroupId,
    created, updated: {}, skipped, failed: {}, jobId: null,
  };
}

export function backendTranslationStatus(anchor: Article, rows: readonly Article[], options: { anchorRelative?: boolean } = {}) {
  const cmsId = (row: Article) => row.sourceNewsId || row._id;
  const normalizeLanguage = (value: string | undefined) => {
    const raw = String(value || '').trim().toLowerCase();
    if (/[\u0A80-\u0AFF]/.test(raw)) return 'gu';
    if (/[\u0900-\u097F]/.test(raw)) return 'hi';
    const primary = raw.split(/[-_]/)[0];
    if (primary === 'gu' || primary === 'hi' || primary === 'en') return primary;
    const aliases: Record<string, string> = { gujarati: 'gu', gujrati: 'gu', guj: 'gu', hindi: 'hi', hin: 'hi', english: 'en', eng: 'en' };
    return aliases[raw.replace(/[^a-z]/g, '')] || '';
  };
  const languageOf = (row: Article) => normalizeLanguage(row.lang || row.language || row.translationMeta?.targetLanguage || row.originalLang);
  const linkedId = anchor.sourceArticleId || anchor.translationMeta?.sourceArticleId
    || rows.map(row => row.sourceArticleId || row.translationMeta?.sourceArticleId).find(Boolean);
  const declaredSourceLanguage = normalizeLanguage(anchor.sourceLanguage || anchor.translationMeta?.sourceLanguage);
  const source = options.anchorRelative ? anchor : rows.find(row => cmsId(row) === linkedId)
    || rows.find(row => languageOf(row) === declaredSourceLanguage) || anchor;
  const baseLang = options.anchorRelative ? normalizeLanguage(anchor.originalLang || anchor.lang || anchor.language) : languageOf(source);
  const sourceId = cmsId(source);
  const summarize = (row: Article) => ({
    id: cmsId(row), lang: languageOf(row), originalLang: normalizeLanguage(row.originalLang) || null,
    status: row.status || null, slug: row.slug || null, title: row.title,
    isSource: cmsId(row) === sourceId,
  });
  const sourceArticle = summarize(source);
  const siblingArticles = rows.filter(row => cmsId(row) !== sourceId).map(summarize);
  const perLang = Object.fromEntries(editionLanguages.map(lang => {
    const child = rows.find(row => cmsId(row) !== sourceId && languageOf(row) === lang);
    const isSource = lang === baseLang;
    const present = isSource || !!child;
    return [lang, {
      status: null, error: null, updatedAt: null, nextRetryAt: null,
      present, presence: isSource ? 'source' : child ? 'translated' : 'missing',
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
      translationGroupKey: (options.anchorRelative ? [anchor] : rows)
        .flatMap(row => [row.translationGroupId, row.translationKey])
        .map(value => String(value || '').trim())
        .find(value => value && !/^(null|undefined)$/i.test(value)) || null,
      languageStates, perLang,
    },
  };
}
