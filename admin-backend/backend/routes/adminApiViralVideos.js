const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const ViralVideo = require('../models/ViralVideo');
const ViralVideoSettings = require('../models/ViralVideoSettings');

const router = express.Router();
const VIDEO_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'videos');
const THUMBNAIL_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'viral-videos', 'thumbnails');
fs.mkdirSync(VIDEO_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(THUMBNAIL_UPLOAD_DIR, { recursive: true });

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEO_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, '');
    cb(null, `${safeBase || 'viral-video'}-${Date.now()}${ext}`);
  },
});

const thumbnailStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, THUMBNAIL_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, '');
    cb(null, `${safeBase || 'viral-video-thumbnail'}-${Date.now()}${ext}`);
  },
});

function videoFileFilter(_req, file, cb) {
  const ok = ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype);
  cb(ok ? null : new Error('Only MP4/MOV/WEBM allowed'), ok);
}

function thumbnailFileFilter(_req, file, cb) {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
  cb(ok ? null : new Error('Only JPG/PNG/WEBP/GIF allowed'), ok);
}

const videoUpload = multer({ storage: videoStorage, fileFilter: videoFileFilter, limits: { fileSize: 250 * 1024 * 1024 } });
const thumbnailUpload = multer({ storage: thumbnailStorage, fileFilter: thumbnailFileFilter, limits: { fileSize: 8 * 1024 * 1024 } });

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLanguage(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'hi' || raw === 'gu') return raw;
  return 'en';
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase() === 'published' ? 'published' : 'draft';
}

function normalizeSourceType(value) {
  return String(value || '').trim().toLowerCase() === 'embed_url' ? 'embed_url' : 'video_url';
}

function normalizeCategory(value) {
  return String(value || '').trim();
}

async function clearOtherHomepageFeaturedVideos(currentId) {
  await ViralVideo.updateMany(
    { _id: { $ne: currentId }, $or: [{ featured: true }, { homepageFeatured: true }], status: 'published' },
    { $set: { featured: false, homepageFeatured: false } }
  );
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

function toDocumentPayload(body, existing) {
  const thumbnailUrl = String(body?.thumbnailUrl || body?.posterImage?.url || existing?.thumbnailUrl || '').trim();
  const sortOrderRaw = body?.sortOrder;
  const sortOrder = Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : null;
  const status = normalizeStatus(body?.status || existing?.status);
  const homepageVisible = status === 'published';
  const featured = status === 'published'
    ? normalizeBoolean(body?.homepageFeatured ?? body?.featured, existing?.homepageFeatured === true || existing?.featured === true)
    : false;
  const publishedAt = status === 'published'
    ? (body?.publishedAt ? new Date(body.publishedAt) : (existing?.publishedAt || new Date()))
    : null;

  return {
    title: String(body?.title || existing?.title || '').trim(),
    slug: String(body?.slug || existing?.slug || '').trim(),
    summary: String(body?.summary || existing?.summary || '').trim(),
    category: normalizeCategory(body?.category || existing?.category),
    sourceName: String(body?.sourceName || existing?.sourceName || '').trim(),
    thumbnailUrl,
    posterImage: {
      url: thumbnailUrl,
      publicId: String(body?.posterImage?.publicId || existing?.posterImage?.publicId || '').trim(),
    },
    videoUrl: String(body?.videoUrl || existing?.videoUrl || '').trim(),
    embedUrl: String(body?.embedUrl || existing?.embedUrl || '').trim(),
    sourceType: normalizeSourceType(body?.sourceType || existing?.sourceType),
    language: normalizeLanguage(body?.language || existing?.language),
    tags: Array.isArray(body?.tags) ? body.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : (existing?.tags || []),
    status,
    isActive: normalizeBoolean(body?.isActive ?? body?.active, existing ? existing.isActive !== false : true),
    homepageVisible,
    homepageFeatured: featured,
    featured,
    publishedAt,
    sortOrder,
  };
}

function buildFilter(query) {
  const filter = {};
  const and = [];
  const status = String(query?.status || '').trim().toLowerCase();
  const language = String(query?.language || '').trim().toLowerCase();
  const category = String(query?.category || '').trim();
  const homepageVisible = String(query?.homepageVisible || '').trim().toLowerCase();
  const active = String(query?.active ?? query?.isActive ?? '').trim().toLowerCase();
  const q = String(query?.q || '').trim();

  if (status && status !== 'all') filter.status = normalizeStatus(status);
  if (language) filter.language = normalizeLanguage(language);
  if (category) filter.category = normalizeCategory(category);
  if (homepageVisible === 'true') filter.homepageVisible = true;
  if (homepageVisible === 'false') filter.homepageVisible = false;
  if (active === 'true') filter.isActive = true;
  if (active === 'false') filter.isActive = false;
  if (String(query?.featured || query?.homepageFeatured || '').trim().toLowerCase() === 'true') {
    and.push({ $or: [{ featured: true }, { homepageFeatured: true }] });
  }
  if (q) {
    and.push({ $or: [
      { title: { $regex: q, $options: 'i' } },
      { summary: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
    ] });
  }
  if (and.length > 0) filter.$and = and;

  return filter;
}

function buildSort(input) {
  const value = String(input || 'sortOrder,-publishedAt,-updatedAt').trim();
  const segments = value.split(',').map((segment) => String(segment || '').trim()).filter(Boolean);
  const sort = {};

  for (const segment of segments) {
    const key = segment.replace(/^-/, '');
    sort[key] = segment.startsWith('-') ? -1 : 1;
  }

  if (sort.sortOrder == null) sort.sortOrder = 1;
  if (sort.publishedAt == null) sort.publishedAt = -1;
  if (sort.updatedAt == null) sort.updatedAt = -1;
  return sort;
}

router.get('/viral-videos/settings', async (_req, res) => {
  try {
    const settings = await ViralVideoSettings.getOrInitialize();
    res.json({ ok: true, settings: { frontendEnabled: settings.frontendEnabled === true } });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.put('/viral-videos/settings', async (req, res) => {
  try {
    const settings = await ViralVideoSettings.getOrInitialize();
    settings.frontendEnabled = normalizeBoolean(req.body?.frontendEnabled, settings.frontendEnabled === true);
    await settings.save();
    res.json({ ok: true, settings: { frontendEnabled: settings.frontendEnabled === true } });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

async function handleViralVideoUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'Video file is required' });
    const filename = req.file.filename;
    const url = `/admin-api/public/viral-videos/uploads/videos/${encodeURIComponent(filename)}`;
    res.json({
      ok: true,
      success: true,
      url,
      filename,
      data: {
        url,
        filename,
        bytes: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

router.post('/viral-videos/upload-video', videoUpload.single('video'), handleViralVideoUpload);
router.post('/viral-videos/upload', videoUpload.single('video'), handleViralVideoUpload);

router.post('/viral-videos/thumbnail-upload', thumbnailUpload.single('thumbnail'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'Thumbnail image is required' });
    const filename = req.file.filename;
    const url = `/admin-api/public/viral-videos/uploads/thumbnails/${encodeURIComponent(filename)}`;
    res.json({
      ok: true,
      success: true,
      url,
      filename,
      data: {
        url,
        filename,
        bytes: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/viral-videos', async (req, res) => {
  try {
    const page = toInt(req.query.page, 1);
    const limit = toInt(req.query.limit, 20);
    const filter = buildFilter(req.query || {});
    const sort = buildSort(req.query?.sort);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      ViralVideo.find(filter).sort(sort).skip(skip).limit(limit),
      ViralVideo.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/viral-videos/:id', async (req, res) => {
  try {
    const item = await ViralVideo.findById(req.params.id);
    if (!item) return res.status(404).json({ ok: false, message: 'Viral video not found' });
    res.json({ ok: true, item });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post('/viral-videos', async (req, res) => {
  try {
    const payload = toDocumentPayload(req.body || {}, null);
    const item = await ViralVideo.create(payload);
    if (item.featured && item.status === 'published') {
      await clearOtherHomepageFeaturedVideos(item._id);
    }
    res.status(201).json({ ok: true, item });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

async function updateViralVideoById(req, res) {
  try {
    const existing = await ViralVideo.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, message: 'Viral video not found' });
    const payload = toDocumentPayload(req.body || {}, existing);
    Object.assign(existing, payload);
    await existing.save();
    if (existing.featured && existing.status === 'published') {
      await clearOtherHomepageFeaturedVideos(existing._id);
    }
    res.json({ ok: true, item: existing });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

router.put('/viral-videos/:id', updateViralVideoById);
router.patch('/viral-videos/:id', updateViralVideoById);

router.patch('/viral-videos/:id/status', async (req, res) => {
  try {
    const existing = await ViralVideo.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, message: 'Viral video not found' });
    existing.status = normalizeStatus(req.body?.status || existing.status);
    if (existing.status !== 'published') {
      existing.homepageVisible = false;
      existing.homepageFeatured = false;
      existing.featured = false;
    } else {
      existing.homepageVisible = true;
      const featured = normalizeBoolean(req.body?.homepageFeatured ?? req.body?.featured, existing.homepageFeatured === true || existing.featured === true);
      existing.homepageFeatured = featured;
      existing.featured = featured;
    }
    existing.publishedAt = existing.status === 'published'
      ? (req.body?.publishedAt ? new Date(req.body.publishedAt) : (existing.publishedAt || new Date()))
      : null;
    await existing.save();
    if (existing.featured && existing.status === 'published') {
      await clearOtherHomepageFeaturedVideos(existing._id);
    }
    res.json({ ok: true, item: existing });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete('/viral-videos/:id', async (req, res) => {
  try {
    const result = await ViralVideo.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ ok: false, message: 'Viral video not found' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
