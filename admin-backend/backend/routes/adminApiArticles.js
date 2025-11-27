const express = require('express');
const Article = require('../models/Article');

const router = express.Router();

// Helpers
const toInt = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

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
      scheduledAt: body.scheduledAt,
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
