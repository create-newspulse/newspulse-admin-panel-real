const express = require('express');
const fs = require('fs');
const path = require('path');
const ViralVideo = require('../models/ViralVideo');
const ViralVideoSettings = require('../models/ViralVideoSettings');

const router = express.Router();
const VIDEO_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'videos');
const THUMBNAIL_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'viral-videos', 'thumbnails');

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function settingsPayload(settings) {
  return { frontendEnabled: settings.frontendEnabled === true };
}

function sendUploadedFile(res, baseDir, filename) {
  const safeName = path.basename(String(filename || ''));
  if (!safeName) return res.status(404).end();

  const filePath = path.join(baseDir, safeName);
  const resolvedBase = path.resolve(baseDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedBase + path.sep)) return res.status(404).end();
  if (!fs.existsSync(resolvedFile)) return res.status(404).end();

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.sendFile(resolvedFile);
}

router.get('/viral-videos/uploads/thumbnails/:filename', (req, res) => {
  return sendUploadedFile(res, THUMBNAIL_UPLOAD_DIR, req.params.filename);
});

router.get('/viral-videos/uploads/videos/:filename', (req, res) => {
  return sendUploadedFile(res, VIDEO_UPLOAD_DIR, req.params.filename);
});

router.get('/viral-videos/settings', async (_req, res) => {
  try {
    const settings = await ViralVideoSettings.getOrInitialize();
    res.json({ ok: true, settings: settingsPayload(settings) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/viral-videos/featured', async (req, res) => {
  try {
    const settings = await ViralVideoSettings.getOrInitialize();
    const settingsJson = settingsPayload(settings);
    if (!settingsJson.frontendEnabled) {
      return res.json({ ok: true, item: null, video: null, selectionMode: 'manual', settings: settingsJson });
    }

    const language = String(req.query.language || '').trim().toLowerCase();
    const filter = {
      status: 'published',
      isActive: true,
      homepageVisible: true,
      thumbnailUrl: { $ne: '' },
      $or: [{ featured: true }, { homepageFeatured: true }],
      $and: [{ $or: [{ videoUrl: { $ne: '' } }, { embedUrl: { $ne: '' } }] }],
    };
    if (language) filter.language = language;

    const item = await ViralVideo.findOne(filter)
      .sort({ sortOrder: 1, publishedAt: -1, updatedAt: -1 });

    res.json({ ok: true, item: item || null, video: item || null, selectionMode: 'manual', settings: settingsJson });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/viral-videos', async (req, res) => {
  try {
    const settings = await ViralVideoSettings.getOrInitialize();
    if (!settings.frontendEnabled) {
      return res.json({ ok: true, items: [], selectionMode: 'list', settings: settingsPayload(settings), frontendEnabled: false });
    }

    const limit = toInt(req.query.limit, 24);
    const filter = {
      status: 'published',
      isActive: true,
      thumbnailUrl: { $ne: '' },
      $or: [{ videoUrl: { $ne: '' } }, { embedUrl: { $ne: '' } }],
    };
    const language = String(req.query.language || '').trim().toLowerCase();
    const featuredOnly = String(req.query.featured || '').trim().toLowerCase() === 'true';
    const fallbackLatest = String(req.query.fallbackLatest || '').trim().toLowerCase() === 'true';

    if (language) filter.language = language;
    if (featuredOnly) {
      filter.homepageVisible = true;
      filter.$and = [{ $or: [{ featured: true }, { homepageFeatured: true }] }];
    }

    let items = await ViralVideo.find(filter)
      .sort({ sortOrder: 1, publishedAt: -1, updatedAt: -1 })
      .limit(limit);

    let selectionMode = featuredOnly ? 'manual' : 'list';

    if (featuredOnly && items.length === 0 && fallbackLatest) {
      const fallbackFilter = { status: 'published', isActive: true };
      if (language) fallbackFilter.language = language;
      items = await ViralVideo.find(fallbackFilter)
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(limit);
      selectionMode = 'latest';
    }

    res.json({ ok: true, items, selectionMode, settings: settingsPayload(settings) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
