// Enhanced /api/articles routes for Manage News
const express = require('express');
const multer = require('multer');
const { parse } = require('fast-csv');
const sanitizeHtml = require('sanitize-html');
const { z } = require('zod');
const Article = require('../models/Article');
const slugify = require('slugify');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Validation schema (Zod)
const ArticleSchemaZ = z.object({
  title: z.string().min(5).max(140),
  slug: z.string().min(3).max(160).regex(/^[a-z0-9-]+$/),
  summary: z.string().min(20).max(400).optional().or(z.literal('')),
  content: z.string().min(50).optional().or(z.literal('')),
  category: z.enum(['Breaking','National','International','Business','Sports','Tech','Lifestyle','Editorial','Glamour','Regional','Science','Youth Pulse']),
  lang: z.enum(['en','hi','gu']).optional(),
  tags: z.array(z.string()).max(20).optional(),
  status: z.enum(['draft','scheduled','published','archived','deleted']).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  coverImage: z.union([
    z.string().url(),
    z.object({
      url: z.string().url(),
      publicId: z.string().max(200).optional().or(z.literal('')),
      public_id: z.string().max(200).optional().or(z.literal('')),
    }).passthrough(),
    z.literal(''),
  ]).optional(),
  sourceName: z.string().max(120).optional().or(z.literal('')),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  authorName: z.string().max(120).optional().or(z.literal('')),
  publishedAt: z.string().datetime().optional().or(z.literal('')).transform(d=> d ? new Date(d) : undefined),
  // Legacy fields for backward compatibility
  source: z.object({ name: z.string().optional(), url: z.string().url().optional().or(z.literal('')) }).optional(),
  author: z.object({ id: z.string().optional(), name: z.string().optional(), type: z.enum(['human','ai']).optional() }).optional(),
  language: z.enum(['en','hi','gu']).optional(),
  ptiCompliance: z.enum(['compliant','pending','rejected']).optional(),
  trustScore: z.number().min(0).max(100).optional(),
  isFlagged: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional().transform(d=> d ? new Date(d) : undefined),
});

function normalizeCoverFields(input) {
  const body = input || {};
  const coverImageRaw = body.coverImage;
  const coverImageUrlRaw = body.coverImageUrl;
  const imageUrlRaw = body.imageUrl;

  const coverUrlFromObj =
    coverImageRaw && typeof coverImageRaw === 'object'
      ? String(coverImageRaw.url || coverImageRaw.secure_url || coverImageRaw.secureUrl || '').trim()
      : '';
  const coverPidFromObj =
    coverImageRaw && typeof coverImageRaw === 'object'
      ? String(coverImageRaw.publicId || coverImageRaw.public_id || '').trim()
      : '';

  const coverUrlFromString = typeof coverImageRaw === 'string' ? String(coverImageRaw || '').trim() : '';
  const coverUrl = coverUrlFromObj || coverUrlFromString || String(coverImageUrlRaw || '').trim() || String(imageUrlRaw || '').trim();
  if (!coverUrl) return { coverImage: undefined, coverImageUrl: undefined, imageUrl: undefined };

  return {
    coverImage: {
      url: coverUrl,
      ...(coverPidFromObj ? { publicId: coverPidFromObj } : {}),
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

const sanitizeContent = (html) => sanitizeHtml(html || '', {
  allowedTags: ['p','h1','h2','h3','h4','a','ul','ol','li','blockquote','img','strong','em','u','code','pre'],
  allowedAttributes: { a: ['href','name','target','rel'], img: ['src','alt'] },
  selfClosing: ['img'],
  allowedSchemes: ['http','https','data','mailto'],
});

const toPositiveInt = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const isObjectId = (s) => /^[0-9a-fA-F]{24}$/.test(String(s || ''));

// Build Mongo filter from query params
function buildFilter(qs) {
  const { q, category, status, language, author, from, to } = qs;
  const filter = {};
  if (q) {
    // Use text search when possible; fallback regex if no text score
    filter.$text = { $search: q };
  }
  if (category) filter.category = { $in: String(category).split(',').filter(Boolean) };
  if (status) filter.status = status;
  if (language) filter.language = language;
  if (author && isObjectId(author)) filter['author.id'] = author;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  return filter;
}

// LIST with pagination & filters
router.get('/', async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1);
    const limit = toPositiveInt(req.query.limit, 20);
    const sortRaw = String(req.query.sort || '-createdAt');
    const sort = {};
    sortRaw.split(',').forEach(seg => {
      seg = seg.trim(); if (!seg) return; sort[seg.replace(/^-/, '')] = seg.startsWith('-') ? -1 : 1;
    });
    const filter = buildFilter(req.query);
    // Hide deleted unless explicitly requesting status=deleted
    if (!req.query.status || req.query.status !== 'deleted') {
      filter.status = filter.status === 'deleted' ? 'deleted' : filter.status; // keep if user asked
      if (filter.status !== 'deleted') filter.status = filter.status || { $ne: 'deleted' };
    }
    const skip = (page - 1) * limit;
    const cursor = Article.find(filter).sort(sort).skip(skip).limit(limit);
    if (filter.$text) cursor.select({ score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' }, ...sort });
    const [items, total] = await Promise.all([
      cursor.lean(),
      Article.countDocuments(filter),
    ]);
    res.json({ data: items.map(withNormalizedCover), page, total, pages: Math.ceil(total / limit), limit });
  } catch (err) {
    console.error('GET /api/articles error', err);
    res.status(500).json({ error: { code: 'LIST_FAILED', message: 'Failed to fetch articles' } });
  }
});

// META counts for badges
router.get('/meta', async (_req, res) => {
  try {
    const [published, drafts, flagged] = await Promise.all([
      Article.countDocuments({ status: 'published' }),
      Article.countDocuments({ status: 'draft' }),
      Article.countDocuments({ isFlagged: true, status: { $ne: 'deleted' } }),
    ]);
    res.json({ published, drafts, flagged });
  } catch (err) {
    res.status(500).json({ error: { code: 'META_FAILED', message: 'Failed to load counts' } });
  }
});

// GET one by id or slug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const doc = isObjectId(idOrSlug) ? await Article.findById(idOrSlug) : await Article.findOne({ slug: idOrSlug });
    if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ data: withNormalizedCover(doc) });
  } catch (err) {
    res.status(500).json({ error: { code: 'GET_FAILED', message: 'Failed to fetch article' } });
  }
});

// CREATE
router.post('/', auth, requireRole('editor','admin','founder'), async (req, res) => {
  try {
    const parsed = ArticleSchemaZ.parse(req.body);
    parsed.content = sanitizeContent(parsed.content);

    const cover = normalizeCoverFields(parsed);
    if (cover.coverImage) parsed.coverImage = cover.coverImage;
    if (cover.coverImageUrl) parsed.coverImageUrl = cover.coverImageUrl;
    if (cover.imageUrl) parsed.imageUrl = cover.imageUrl;
    
    // Map frontend fields to backend schema
    if (!parsed.language && parsed.lang) parsed.language = parsed.lang;
    if (!parsed.source && (parsed.sourceName || parsed.sourceUrl)) {
      parsed.source = { name: parsed.sourceName || '', url: parsed.sourceUrl || '' };
    }
    if (!parsed.author) {
      parsed.author = { 
        id: req.user?.sub || null, 
        name: parsed.authorName || req.user?.email || '', 
        type: 'human' 
      };
    }
    
    // Auto-generate slug if not provided
    if (!parsed.slug && parsed.title) {
      parsed.slug = slugify(parsed.title, { lower: true, strict: true }).slice(0, 160);
    }
    
    const doc = await Article.create(parsed);
    res.status(201).json({ data: withNormalizedCover(doc) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid input', fields: err.flatten() } });
    }
    if (err?.code === 11000) return res.status(400).json({ error: { code: 'DUPLICATE_SLUG', message: 'Slug already exists' } });
    console.error('POST /api/articles error', err);
    res.status(500).json({ error: { code: 'CREATE_FAILED', message: 'Failed to create article' } });
  }
});

// UPDATE
router.put('/:id', auth, requireRole('editor','admin','founder'), async (req, res) => {
  try {
    const parsed = ArticleSchemaZ.partial().parse(req.body);
    if (parsed.content) parsed.content = sanitizeContent(parsed.content);
    const cover = normalizeCoverFields(parsed);
    if (cover.coverImage) parsed.coverImage = cover.coverImage;
    if (cover.coverImageUrl) parsed.coverImageUrl = cover.coverImageUrl;
    if (cover.imageUrl) parsed.imageUrl = cover.imageUrl;
    const doc = await Article.findByIdAndUpdate(req.params.id, parsed, { new: true });
    if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ data: withNormalizedCover(doc) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid input', fields: err.flatten() } });
    console.error('PUT /api/articles/:id error', err);
    res.status(500).json({ error: { code: 'UPDATE_FAILED', message: 'Failed to update article' } });
  }
});

// ARCHIVE
router.patch('/:id/archive', auth, requireRole('editor','admin','founder'), async (req, res) => {
  try {
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ data: doc });
  } catch (err) {
    res.status(500).json({ error: { code: 'ARCHIVE_FAILED', message: 'Failed to archive' } });
  }
});

// RESTORE (to draft)
router.patch('/:id/restore', auth, requireRole('editor','admin','founder'), async (req, res) => {
  try {
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'draft' }, { new: true });
    if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ data: doc });
  } catch (err) {
    res.status(500).json({ error: { code: 'RESTORE_FAILED', message: 'Failed to restore' } });
  }
});

// SOFT DELETE
router.delete('/:id', auth, requireRole('admin','founder'), async (req, res) => {
  try {
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'deleted', deletedAt: new Date() }, { new: true });
    if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ data: { id: doc._id, deleted: true } });
  } catch (err) {
    res.status(500).json({ error: { code: 'DELETE_FAILED', message: 'Failed to delete' } });
  }
});

// BULK CSV UPLOAD
router.post('/bulk-upload', auth, requireRole('editor','admin','founder'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: { code: 'NO_FILE', message: 'CSV file required (field name "file")' } });
  const results = { created: 0, updated: 0, skipped: 0, errors: [] };
  try {
    const rows = [];
    await new Promise((resolve, reject) => {
      const stream = parse({ headers: true, ignoreEmpty: true })
        .on('error', reject)
        .on('data', d => rows.push(d))
        .on('end', resolve);
      stream.write(req.file.buffer);
      stream.end();
    });
    for (const [i,row] of rows.entries()) {
      try {
        const tags = row.tags ? row.tags.split(/[,;]\s*/).filter(Boolean) : [];
        const payload = {
          title: row.title,
          summary: row.summary,
          content: sanitizeContent(row.content),
          category: row.category,
          tags,
          imageUrl: row.imageUrl,
          source: { name: row.sourceName, url: row.sourceUrl },
          language: row.language || 'en',
          status: row.status || 'draft',
          scheduledAt: row.scheduledAt ? new Date(row.scheduledAt) : null,
          author: { id: req.user?.sub || null, name: req.user?.email || '', type: 'human' }
        };
        // Basic row validation before parsing
        if (!payload.title || !payload.category) {
          results.skipped++;
          results.errors.push({ row: i+1, message: 'Missing required title or category' });
          continue;
        }
        // Validate category/status enums fast to avoid zod throwing for common typos
        const VALID_CATS = ['Breaking','Regional','National','International','Business','Sports','Lifestyle','Glamorous','SciTech','Editorial','WebStories','ViralVideos'];
        const VALID_STATUS = ['draft','scheduled','published','archived','deleted'];
        if (!VALID_CATS.includes(payload.category)) {
          results.skipped++;
            results.errors.push({ row: i+1, message: `Invalid category: ${payload.category}` });
            continue;
        }
        if (payload.status && !VALID_STATUS.includes(payload.status)) {
          results.skipped++;
            results.errors.push({ row: i+1, message: `Invalid status: ${payload.status}` });
            continue;
        }
        const parsed = ArticleSchemaZ.partial().parse(payload);
        // Upsert on slug if exists
        const slugBase = slugify(parsed.title, { lower: true, strict: true });
        const existing = await Article.findOne({ slug: slugBase });
        if (existing) {
          Object.assign(existing, parsed);
          existing.content = sanitizeContent(existing.content);
          await existing.save();
          results.updated++;
        } else {
          const doc = await Article.create(parsed);
          results.created++;
        }
      } catch (err) {
        results.errors.push({ row: i+1, message: err.message });
      }
    }
    res.json(results);
  } catch (err) {
    console.error('Bulk upload error', err);
    res.status(500).json({ error: { code: 'BULK_FAILED', message: 'Bulk upload failed' } });
  }
});

module.exports = router;
// Expose builder for unit tests
module.exports.buildFilter = buildFilter;
