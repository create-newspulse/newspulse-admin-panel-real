const express = require('express');
const crypto = require('crypto');
const openai = require('../../openaiClient.js');
const Article = require('../models/Article');

const router = express.Router();

const SUPPORTED_LANGS = ['en', 'hi', 'gu'];
const TRANSLATION_MODEL = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
const TRANSLATION_FALLBACK_MODEL = (process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini').trim();
const MAX_TRANSLATION_CHARS = Number(process.env.ARTICLE_TRANSLATION_MAX_CHARS || 18000);

const toInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function normalizeLang(value) {
  const raw = String(value || '').trim().toLowerCase();
  return SUPPORTED_LANGS.includes(raw) ? raw : 'en';
}

function languageLabel(code) {
  if (code === 'hi') return 'Hindi';
  if (code === 'gu') return 'Gujarati';
  return 'English';
}

function makeTranslationGroupId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
}

function normalizeCoverFields(body) {
  const coverImageRaw = body?.coverImage;
  const coverImageUrlRaw = body?.coverImageUrl;
  const imageUrlRaw = body?.imageUrl;

  const coverUrlFromObj =
    coverImageRaw && typeof coverImageRaw === 'object'
      ? String(coverImageRaw.url || coverImageRaw.secure_url || coverImageRaw.secureUrl || '').trim()
      : '';
  const coverPidFromObj =
    coverImageRaw && typeof coverImageRaw === 'object'
      ? String(coverImageRaw.publicId || coverImageRaw.public_id || '').trim()
      : '';

  const coverUrlFromString = typeof coverImageRaw === 'string' ? String(coverImageRaw || '').trim() : '';
  const coverUrl =
    coverUrlFromObj ||
    coverUrlFromString ||
    String(coverImageUrlRaw || '').trim() ||
    String(imageUrlRaw || '').trim();

  const coverPid = coverPidFromObj || (typeof body?.coverImagePublicId === 'string' ? body.coverImagePublicId.trim() : '');

  if (!coverUrl) return { coverImage: undefined, coverImageUrl: undefined, imageUrl: undefined };

  return {
    coverImage: {
      url: coverUrl,
      ...(coverPid ? { publicId: coverPid } : {}),
    },
    coverImageUrl: coverUrl,
    imageUrl: coverUrl,
  };
}

function withNormalizedCover(doc) {
  if (!doc) return doc;
  const raw = doc.toObject ? doc.toObject() : { ...doc };
  const url =
    (raw.coverImage && typeof raw.coverImage === 'object' ? String(raw.coverImage.url || '').trim() : '') ||
    String(raw.coverImageUrl || '').trim() ||
    String(raw.imageUrl || '').trim();
  const pid = raw.coverImage && typeof raw.coverImage === 'object' ? String(raw.coverImage.publicId || '').trim() : '';
  if (url) {
    raw.coverImage = { url, ...(pid ? { publicId: pid } : {}) };
    raw.coverImageUrl = raw.coverImageUrl || url;
    raw.imageUrl = raw.imageUrl || url;
  }
  return raw;
}

function normalizeTranslationState(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (['ready', 'synced', 'completed', 'published', 'success'].includes(raw)) return 'ready';
  if (['failed', 'error'].includes(raw)) return 'failed';
  if (['pending', 'queued', 'retrying', 'requeued', 'processing', 'in-progress', 'in_progress', 'regenerating'].includes(raw)) return 'pending';
  return raw;
}

function summarizeTranslationStatus(article) {
  const baseLang = normalizeLang(article?.sourceLanguage || article?.language || 'en');
  const translations = article?.translations && typeof article.translations === 'object' ? article.translations : {};
  const states = SUPPORTED_LANGS
    .filter((lang) => lang !== baseLang)
    .map((lang) => normalizeTranslationState(translations?.[lang]?.translationStatus || translations?.[lang]?.status));

  if (states.some((state) => state === 'failed')) return 'failed';
  if (states.length > 0 && states.every((state) => state === 'ready')) return 'ready';
  if (states.some((state) => state === 'pending') || states.some((state) => !state)) return article?.status === 'published' ? 'pending' : '';
  return article?.status === 'published' ? 'pending' : '';
}

function buildSelfTranslationEntry(article) {
  const lang = normalizeLang(article?.language || 'en');
  return {
    articleId: String(article?._id || ''),
    id: String(article?._id || ''),
    lang,
    language: lang,
    status: 'ready',
    translationStatus: 'ready',
    published: String(article?.status || '').trim().toLowerCase() === 'published',
    updatedAt: new Date().toISOString(),
    article: {
      _id: article?._id,
      id: article?._id,
      lang,
      language: lang,
      status: article?.status,
      isPublished: String(article?.status || '').trim().toLowerCase() === 'published',
      publishedAt: article?.publishedAt || null,
      title: article?.title || '',
    },
  };
}

function decorateArticleForResponse(doc) {
  const raw = withNormalizedCover(doc);
  const lang = normalizeLang(raw?.language || 'en');
  const sourceLanguage = normalizeLang(raw?.sourceLanguage || lang);
  const translationGroupId = String(raw?.translationGroupId || '').trim() || makeTranslationGroupId();
  const translations = raw?.translations && typeof raw.translations === 'object' ? { ...raw.translations } : {};

  translations[lang] = {
    ...(translations[lang] || {}),
    ...buildSelfTranslationEntry(raw),
  };

  return {
    ...raw,
    language: lang,
    sourceLanguage,
    translationGroupId,
    translations,
    translationStatus: raw?.translationStatus || summarizeTranslationStatus({
      ...raw,
      language: lang,
      sourceLanguage,
      translations,
    }),
  };
}

async function persistTranslationScaffold(doc) {
  if (!doc) return null;
  const nextLang = normalizeLang(doc.language || 'en');
  const nextSourceLang = normalizeLang(doc.sourceLanguage || nextLang);
  const nextGroupId = String(doc.translationGroupId || '').trim() || makeTranslationGroupId();
  const nextTranslations = doc.translations && typeof doc.translations === 'object' ? { ...doc.translations } : {};

  doc.language = nextLang;
  doc.sourceLanguage = nextSourceLang;
  doc.translationGroupId = nextGroupId;
  nextTranslations[nextLang] = {
    ...(nextTranslations[nextLang] || {}),
    ...buildSelfTranslationEntry(doc),
  };
  doc.translations = nextTranslations;
  doc.translationStatus = summarizeTranslationStatus({ ...doc.toObject(), translations: nextTranslations, sourceLanguage: nextSourceLang, language: nextLang, status: doc.status });
  doc.translationUpdatedAt = new Date();
  if (doc.translationStatus !== 'failed') doc.translationError = '';
  await doc.save();
  return doc;
}

function cleanTranslationText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > MAX_TRANSLATION_CHARS ? text.slice(0, MAX_TRANSLATION_CHARS) : text;
}

function hasTranslationProvider() {
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  return !!key && !/REPLACE|changeme|placeholder/i.test(key);
}

async function runTranslationCompletion(system, user) {
  const tryModel = async (model) => {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });
    return String(completion?.choices?.[0]?.message?.content || '').trim();
  };

  try {
    return await tryModel(TRANSLATION_MODEL);
  } catch (_error) {
    return await tryModel(TRANSLATION_FALLBACK_MODEL);
  }
}

async function translateFieldText(text, targetLang, opts) {
  const input = cleanTranslationText(text);
  if (!input) return '';
  const preserveHtml = opts?.preserveHtml ? 'Preserve all HTML tags and structure exactly. Translate only the human-readable text.' : 'Return plain translated text only.';
  const system = 'You are a precise multilingual NewsPulse translation engine. Preserve named entities, keep tone neutral, and do not add commentary.';
  const user = `${preserveHtml}\nTranslate this ${opts?.kind || 'text'} into ${languageLabel(targetLang)}.\n\n${input}`;
  const output = await runTranslationCompletion(system, user);
  if (!output) throw new Error(`Empty ${opts?.kind || 'text'} translation response`);
  return output;
}

async function translateArticleFields(sourceArticle, targetLang) {
  if (!hasTranslationProvider()) {
    throw new Error('Translation provider is not configured');
  }

  return {
    title: await translateFieldText(sourceArticle?.title || '', targetLang, { kind: 'headline' }),
    summary: await translateFieldText(sourceArticle?.summary || sourceArticle?.description || '', targetLang, { kind: 'summary' }),
    content: await translateFieldText(sourceArticle?.content || '', targetLang, { kind: 'article body', preserveHtml: true }),
  };
}

function buildArticleInput(body, existing, resolvedSourceLanguage) {
  const cover = normalizeCoverFields(body);
  const language = normalizeLang(body.language || body.lang || existing?.language || 'en');
  const sourceLanguage = normalizeLang(body.sourceLanguage || existing?.sourceLanguage || resolvedSourceLanguage || language);
  const translationGroupId = String(body.translationGroupId || existing?.translationGroupId || '').trim() || makeTranslationGroupId();

  return {
    title: body.title,
    slug: body.slug,
    summary: body.summary,
    description: body.description !== undefined ? body.description : body.summary,
    content: body.content || body.body,
    category: body.category,
    tags: Array.isArray(body.tags) ? body.tags : undefined,
    status: body.status,
    language,
    sourceLanguage,
    translationGroupId,
    baseArticleId: body.baseArticleId !== undefined ? body.baseArticleId : existing?.baseArticleId,
    scheduledAt: body.scheduledAt || body.publishAt || body.publish_at,
    publishedAt: body.publishedAt,
    ptiCompliance: body.ptiCompliance,
    translationStatus: body.translationStatus,
    translationError: body.translationError,
    translationUpdatedAt: body.translationUpdatedAt,
    translations: body.translations,
    isBreaking: body.isBreaking,
    state: body.state,
    district: body.district,
    city: body.city,
    track: body.track,
    trackName: body.trackName,
    subCategory: body.subCategory,
    subcategory: body.subcategory,
    ...(cover.coverImage ? { coverImage: cover.coverImage } : {}),
    ...(cover.coverImageUrl ? { coverImageUrl: cover.coverImageUrl } : {}),
    ...(cover.imageUrl ? { imageUrl: cover.imageUrl } : {}),
  };
}

function stripUndefined(input) {
  const next = { ...input };
  Object.keys(next).forEach((key) => next[key] === undefined && delete next[key]);
  return next;
}

async function inferSourceLanguageForGroup(translationGroupId, fallbackLang) {
  const gid = String(translationGroupId || '').trim();
  if (!gid) return normalizeLang(fallbackLang || 'en');
  const existing = await Article.findOne({ translationGroupId: gid }).sort({ createdAt: 1 }).lean();
  return normalizeLang(existing?.sourceLanguage || existing?.language || fallbackLang || 'en');
}

async function resolveSourceArticle(article) {
  if (!article) return null;
  const sourceLanguage = normalizeLang(article.sourceLanguage || article.language || 'en');
  if (!article.translationGroupId || normalizeLang(article.language || 'en') === sourceLanguage) return article;
  if (article.baseArticleId) {
    const byBaseId = await Article.findById(article.baseArticleId);
    if (byBaseId) return byBaseId;
  }
  const byGroup = await Article.findOne({ translationGroupId: article.translationGroupId, language: sourceLanguage }).sort({ createdAt: 1 });
  return byGroup || article;
}

async function upsertTranslatedVariant(sourceArticle, targetLang) {
  const translated = await translateArticleFields(sourceArticle, targetLang);
  const existing = await Article.findOne({ translationGroupId: sourceArticle.translationGroupId, language: targetLang });
  const variant = existing || new Article();
  variant.title = translated.title || sourceArticle.title;
  variant.summary = translated.summary || sourceArticle.summary || '';
  variant.description = translated.summary || sourceArticle.description || sourceArticle.summary || '';
  variant.content = translated.content || sourceArticle.content || '';
  variant.category = sourceArticle.category;
  variant.tags = Array.isArray(sourceArticle.tags) ? sourceArticle.tags : [];
  variant.status = sourceArticle.status === 'published' ? 'published' : (sourceArticle.status === 'scheduled' ? 'scheduled' : 'draft');
  variant.language = targetLang;
  variant.sourceLanguage = normalizeLang(sourceArticle.sourceLanguage || sourceArticle.language || 'en');
  variant.translationGroupId = sourceArticle.translationGroupId;
  variant.baseArticleId = sourceArticle._id;
  variant.translationStatus = 'ready';
  variant.translationError = '';
  variant.translationUpdatedAt = new Date();
  variant.ptiCompliance = sourceArticle.ptiCompliance || 'pending';
  variant.isBreaking = !!sourceArticle.isBreaking;
  variant.state = sourceArticle.state || '';
  variant.district = sourceArticle.district || '';
  variant.city = sourceArticle.city || '';
  variant.track = sourceArticle.track || '';
  variant.trackName = sourceArticle.trackName || '';
  variant.subCategory = sourceArticle.subCategory || '';
  variant.subcategory = sourceArticle.subcategory || '';
  variant.coverImage = sourceArticle.coverImage || { url: sourceArticle.coverImageUrl || sourceArticle.imageUrl || '' };
  variant.coverImageUrl = sourceArticle.coverImageUrl || sourceArticle.imageUrl || '';
  variant.imageUrl = sourceArticle.imageUrl || sourceArticle.coverImageUrl || '';
  variant.scheduledAt = sourceArticle.status === 'scheduled' ? (sourceArticle.scheduledAt || null) : null;
  variant.publishedAt = sourceArticle.status === 'published' ? (sourceArticle.publishedAt || new Date()) : null;
  await variant.save();
  await persistTranslationScaffold(variant);
  return variant;
}

async function syncTranslationsForSource(sourceArticle, options = {}) {
  const source = await resolveSourceArticle(sourceArticle);
  if (!source) throw new Error('Source article not found');

  source.translationGroupId = String(source.translationGroupId || '').trim() || makeTranslationGroupId();
  source.sourceLanguage = normalizeLang(source.sourceLanguage || source.language || 'en');

  const requested = Array.isArray(options.languages)
    ? options.languages.map((value) => normalizeLang(value)).filter((value, index, arr) => value !== source.sourceLanguage && arr.indexOf(value) === index)
    : [];
  const targets = requested.length > 0 ? requested : SUPPORTED_LANGS.filter((lang) => lang !== source.sourceLanguage);
  const translations = source.translations && typeof source.translations === 'object' ? { ...source.translations } : {};
  const syncResults = {};

  for (const target of targets) {
    const queuedAt = new Date().toISOString();
    translations[target] = {
      ...(translations[target] || {}),
      lang: target,
      language: target,
      status: 'pending',
      translationStatus: 'pending',
      error: '',
      updatedAt: queuedAt,
      lastQueuedAt: queuedAt,
    };

    try {
      const variant = await upsertTranslatedVariant(source, target);
      translations[target] = {
        ...(translations[target] || {}),
        articleId: String(variant._id),
        id: String(variant._id),
        lang: target,
        language: target,
        status: 'ready',
        translationStatus: 'ready',
        error: '',
        updatedAt: new Date().toISOString(),
        lastCompletedAt: new Date().toISOString(),
        published: String(variant.status || '').trim().toLowerCase() === 'published',
        article: {
          _id: variant._id,
          id: variant._id,
          lang: target,
          language: target,
          status: variant.status,
          isPublished: String(variant.status || '').trim().toLowerCase() === 'published',
          publishedAt: variant.publishedAt || null,
          title: variant.title || '',
        },
      };
      syncResults[target] = `${target.toUpperCase()} ready`;
    } catch (error) {
      const message = String(error?.message || 'Translation failed');
      translations[target] = {
        ...(translations[target] || {}),
        lang: target,
        language: target,
        status: 'failed',
        translationStatus: 'failed',
        error: message,
        updatedAt: new Date().toISOString(),
        lastFailedAt: new Date().toISOString(),
      };
      syncResults[target] = `${target.toUpperCase()} failed: ${message}`;
    }
  }

  source.translations = translations;
  source.translationStatus = summarizeTranslationStatus({
    ...source.toObject(),
    translations,
    sourceLanguage: source.sourceLanguage,
    language: source.language,
    status: source.status,
  });
  source.translationError = source.translationStatus === 'failed'
    ? SUPPORTED_LANGS
        .filter((lang) => lang !== source.sourceLanguage)
        .map((lang) => String(translations?.[lang]?.error || '').trim())
        .find(Boolean) || ''
    : '';
  source.translationUpdatedAt = new Date();
  await source.save();
  await persistTranslationScaffold(source);

  return { sourceArticle: source, syncResults };
}

function buildListFilter(query) {
  const filter = {};
  const status = String(query?.status || '').trim();
  const language = String(query?.language || query?.lang || '').trim();
  const category = String(query?.category || '').trim();
  const translationGroupId = String(query?.translationGroupId || '').trim();
  const q = String(query?.q || '').trim();

  if (status && status !== 'all') filter.status = status;
  else filter.status = { $ne: 'deleted' };

  if (language) filter.language = normalizeLang(language);
  if (category) filter.category = category;
  if (translationGroupId) filter.translationGroupId = translationGroupId;
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { summary: { $regex: q, $options: 'i' } },
      { content: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
    ];
  }

  return filter;
}

function buildSort(raw) {
  const input = String(raw || '-createdAt').trim();
  const sort = {};
  input.split(',').forEach((segment) => {
    const key = String(segment || '').trim();
    if (!key) return;
    sort[key.replace(/^-/, '')] = key.startsWith('-') ? -1 : 1;
  });
  return Object.keys(sort).length > 0 ? sort : { createdAt: -1 };
}

async function saveArticleFromBody(body, existing, options = {}) {
  const resolvedSourceLanguage = await inferSourceLanguageForGroup(body.translationGroupId || existing?.translationGroupId, body.sourceLanguage || existing?.sourceLanguage || body.language || body.lang);
  const input = stripUndefined(buildArticleInput(body, existing, resolvedSourceLanguage));
  const doc = existing || new Article();

  Object.keys(input).forEach((key) => {
    doc[key] = input[key];
  });

  if (!doc.translationGroupId) doc.translationGroupId = makeTranslationGroupId();
  if (!doc.sourceLanguage) doc.sourceLanguage = normalizeLang(doc.language || 'en');
  if (options.clearSchedule) doc.scheduledAt = null;
  if (doc.status === 'published' && !doc.publishedAt) doc.publishedAt = new Date();
  if (doc.status === 'deleted' && !doc.deletedAt) doc.deletedAt = new Date();

  await doc.save();
  await persistTranslationScaffold(doc);

  let syncResults = null;
  const isSourceArticle = normalizeLang(doc.language || 'en') === normalizeLang(doc.sourceLanguage || doc.language || 'en');
  if (doc.status === 'published' && isSourceArticle) {
    const sync = await syncTranslationsForSource(doc, { languages: options.languages });
    syncResults = sync.syncResults;
    return { article: withNormalizedCover(sync.sourceArticle), syncResults };
  }

  return { article: withNormalizedCover(doc), syncResults };
}

router.post('/articles', async (req, res) => {
  try {
    const result = await saveArticleFromBody(req.body || {}, null);
    res.status(201).json({ ok: true, article: result.article, syncResults: result.syncResults });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/articles/:id', async (req, res) => {
  try {
    const doc = await Article.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: decorateArticleForResponse(doc) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.put('/articles/:id', async (req, res) => {
  try {
    const existing = await Article.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, message: 'Article not found' });
    const result = await saveArticleFromBody(req.body || {}, existing);
    res.json({ ok: true, article: result.article, syncResults: result.syncResults });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.patch('/articles/:id', async (req, res) => {
  try {
    const existing = await Article.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, message: 'Article not found' });
    const clearSchedule =
      (Object.prototype.hasOwnProperty.call(req.body || {}, 'scheduledAt') && req.body.scheduledAt === null) ||
      (Object.prototype.hasOwnProperty.call(req.body || {}, 'publishAt') && req.body.publishAt === null);
    const result = await saveArticleFromBody(req.body || {}, existing, { clearSchedule });
    res.json({ ok: true, article: result.article, syncResults: result.syncResults });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post('/articles/:id/retry-translation', async (req, res) => {
  try {
    const current = await Article.findById(req.params.id);
    if (!current) return res.status(404).json({ ok: false, message: 'Article not found' });

    const source = await resolveSourceArticle(current);
    if (!source) return res.status(404).json({ ok: false, message: 'Source article not found' });

    const explicit = Array.isArray(req.body?.languages) ? req.body.languages : null;
    const translations = source.translations && typeof source.translations === 'object' ? source.translations : {};
    const failedLanguages = SUPPORTED_LANGS.filter((lang) => lang !== normalizeLang(source.sourceLanguage || source.language || 'en'))
      .filter((lang) => normalizeTranslationState(translations?.[lang]?.translationStatus || translations?.[lang]?.status) === 'failed');
    const languages = explicit && explicit.length > 0 ? explicit : (failedLanguages.length > 0 ? failedLanguages : SUPPORTED_LANGS.filter((lang) => lang !== normalizeLang(source.sourceLanguage || source.language || 'en')));
    const result = await syncTranslationsForSource(source, { languages });
    res.json({ ok: true, article: withNormalizedCover(result.sourceArticle), syncResults: result.syncResults });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post('/articles/:id/requeue-translations', async (req, res) => {
  try {
    const current = await Article.findById(req.params.id);
    if (!current) return res.status(404).json({ ok: false, message: 'Article not found' });

    const source = await resolveSourceArticle(current);
    if (!source) return res.status(404).json({ ok: false, message: 'Source article not found' });

    const explicit = Array.isArray(req.body?.languages) ? req.body.languages : null;
    const translations = source.translations && typeof source.translations === 'object' ? source.translations : {};
    const languages = explicit && explicit.length > 0
      ? explicit
      : SUPPORTED_LANGS
          .filter((lang) => lang !== normalizeLang(source.sourceLanguage || source.language || 'en'))
          .filter((lang) => normalizeTranslationState(translations?.[lang]?.translationStatus || translations?.[lang]?.status) !== 'ready');
    const result = await syncTranslationsForSource(source, { languages });
    res.json({ ok: true, article: withNormalizedCover(result.sourceArticle), syncResults: result.syncResults });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.patch('/articles/:id/status', async (req, res) => {
  try {
    const existing = await Article.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, message: 'Article not found' });
    const result = await saveArticleFromBody({ status: req.body?.status }, existing);
    res.json({ ok: true, article: result.article, syncResults: result.syncResults });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.patch('/articles/:id/schedule', async (req, res) => {
  try {
    const existing = await Article.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, message: 'Article not found' });
    const when = req.body?.scheduledAt || req.body?.publishAt || req.body?.publish_at;
    if (!when) return res.status(400).json({ ok: false, message: 'scheduledAt/publishAt required' });
    const result = await saveArticleFromBody({ status: 'scheduled', scheduledAt: when }, existing);
    res.json({ ok: true, article: result.article, syncResults: result.syncResults });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.patch('/articles/:id/archive', async (req, res) => {
  try {
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    await persistTranslationScaffold(doc);
    res.json({ ok: true, article: decorateArticleForResponse(doc) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.patch('/articles/:id/restore', async (req, res) => {
  try {
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'draft', deletedAt: null }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    await persistTranslationScaffold(doc);
    res.json({ ok: true, article: decorateArticleForResponse(doc) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete('/articles/:id', async (req, res) => {
  try {
    const hard = String(req.query.hard || '').toLowerCase() === 'true';
    if (hard) {
      const result = await Article.deleteOne({ _id: req.params.id });
      if (result.deletedCount === 0) return res.status(404).json({ ok: false, message: 'Article not found' });
      return res.json({ ok: true, hard: true });
    }
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'deleted', deletedAt: new Date() }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    await persistTranslationScaffold(doc);
    res.json({ ok: true, article: decorateArticleForResponse(doc) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/articles/meta', async (_req, res) => {
  try {
    const total = await Article.countDocuments({ status: { $ne: 'deleted' } });
    res.json({ ok: true, total });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/articles', async (req, res) => {
  try {
    const page = toInt(req.query.page, 1);
    const limit = toInt(req.query.limit, 20);
    const filter = buildListFilter(req.query || {});
    const sort = buildSort(req.query?.sort);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Article.find(filter).sort(sort).skip(skip).limit(limit),
      Article.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      items: items.map((item) => decorateArticleForResponse(item)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
