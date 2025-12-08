const express = require('express');
const Article = require('../models/Article');

const router = express.Router();

// Helpers
const toInt = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const pick = (obj, keys) => keys.reduce((acc, k) => {
  if (obj[k] !== undefined) acc[k] = obj[k];
  return acc;
}, {});

// POST /admin-api/articles – create draft or published
router.post('/articles', async (req, res) => {
  try {
    const body = req.body || {};
    const doc = await Article.create({
      title: body.title,
      slug: body.slug,
      summary: body.summary,
      content: body.content || body.body || '',
      category: body.category,
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: body.status || 'draft',
      language: body.language || body.lang || 'en',
      scheduledAt: body.scheduledAt || null,
      ptiCompliance: body.ptiCompliance || 'pending',
    });
    res.status(201).json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /admin-api/articles/:id – get one
router.get('/articles/:id', async (req, res) => {
  try {
    const doc = await Article.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PUT /admin-api/articles/:id – update (including publish)
router.put('/articles/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const update = {
      title: body.title,
      slug: body.slug,
      summary: body.summary,
      content: body.content || body.body,
      category: body.category,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      status: body.status,
      language: body.language || body.lang,
      scheduledAt: body.scheduledAt || body.publishAt || body.publish_at,
      ptiCompliance: body.ptiCompliance,
    };
    Object.keys(update).forEach((k)=> update[k] === undefined && delete update[k]);
    const doc = await Article.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /admin-api/articles/:id – partial update
router.patch('/articles/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const allowed = [
      'title','slug','summary','content','body','category','tags','status','language','lang','scheduledAt','publishAt','publish_at','ptiCompliance'
    ];
    const src = pick(body, allowed);
    const update = {
      title: src.title,
      slug: src.slug,
      summary: src.summary,
      content: src.content || src.body,
      category: src.category,
      tags: Array.isArray(src.tags) ? src.tags : undefined,
      status: src.status,
      language: src.language || src.lang,
      scheduledAt: src.scheduledAt || src.publishAt || src.publish_at,
      ptiCompliance: src.ptiCompliance,
    };
    Object.keys(update).forEach((k)=> update[k] === undefined && delete update[k]);

    // Special case: unschedule when explicitly null
    if (Object.prototype.hasOwnProperty.call(body, 'scheduledAt') && body.scheduledAt === null) {
      update.scheduledAt = null;
      if (!update.status) update.status = 'draft';
    }
    if (Object.prototype.hasOwnProperty.call(body, 'publishAt') && body.publishAt === null) {
      update.scheduledAt = null;
      if (!update.status) update.status = 'draft';
    }

    const doc = await Article.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /admin-api/articles/:id/status – update only status
router.patch('/articles/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ ok: false, message: 'status required' });
    const doc = await Article.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /admin-api/articles/:id/schedule – set scheduledAt and mark as scheduled
router.patch('/articles/:id/schedule', async (req, res) => {
  try {
    const { scheduledAt, publishAt, publish_at } = req.body || {};
    const when = scheduledAt || publishAt || publish_at;
    if (!when) return res.status(400).json({ ok: false, message: 'scheduledAt/publishAt required' });
    const doc = await Article.findByIdAndUpdate(
      req.params.id,
      { status: 'scheduled', scheduledAt: when },
      { new: true }
    );
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /admin-api/articles/:id/archive – archive article
router.patch('/articles/:id/archive', async (req, res) => {
  try {
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PATCH /admin-api/articles/:id/restore – restore from archived/deleted to draft
router.patch('/articles/:id/restore', async (req, res) => {
  try {
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'draft', deletedAt: null }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// DELETE /admin-api/articles/:id – soft delete by default; hard delete with ?hard=true
router.delete('/articles/:id', async (req, res) => {
  try {
    const hard = String(req.query.hard || '').toLowerCase() === 'true';
    if (hard) {
      const r = await Article.deleteOne({ _id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ ok: false, message: 'Article not found' });
      return res.json({ ok: true, hard: true });
    }
    const doc = await Article.findByIdAndUpdate(req.params.id, { status: 'deleted', deletedAt: new Date() }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Article not found' });
    res.json({ ok: true, article: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /admin-api/articles/meta – minimal meta counts
router.get('/articles/meta', async (_req, res) => {
  try {
    const total = await Article.countDocuments({ status: { $ne: 'deleted' } });
    res.json({ ok: true, total });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /admin-api/articles – list (used by Draft Desk)
router.get('/articles', async (req, res) => {
  try {
    const { status, sort = '-createdAt' } = req.query;
    const page = toInt(req.query.page, 1);
    const limit = toInt(req.query.limit, 20);
    const filter = {};
    if (status) filter.status = status;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Article.find(filter).sort(sort).skip(skip).limit(limit),
      Article.countDocuments(filter),
    ]);
    res.json({ ok: true, items, total });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;
