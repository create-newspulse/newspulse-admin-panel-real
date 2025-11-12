const express = require('express');
const Article = require('../models/Article');

const router = express.Router();

// GET /api/articles - list with pagination and filters
router.get('/', async (req, res) => {
  try {
    const {
      q,
      category,
      status,
      language,
      page = 1,
      limit = 20,
    } = req.query;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (language) filter.language = language;
    if (q) filter.$text = { $search: String(q) };

    const total = await Article.countDocuments(filter);
    const data = await Article.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    const pages = Math.max(Math.ceil(total / l), 1);
    res.json({ data, page: p, pages, total });
  } catch (err) {
    console.error('List articles error:', err);
    res.status(500).json({ message: 'Failed to list articles' });
  }
});

// GET /api/articles/:idOrSlug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let item;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      item = await Article.findById(idOrSlug).lean();
    }
    if (!item) {
      item = await Article.findOne({ slug: idOrSlug }).lean();
    }
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: 'Lookup failed' });
  }
});

// POST /api/articles
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    // publishedAt auto-set if status published
    if (body.status === 'published' && !body.publishedAt) body.publishedAt = new Date();
    const created = await Article.create(body);
    res.status(201).json(created);
  } catch (err) {
    if (err?.code === 11000) return res.status(400).json({ message: 'Duplicate slug', code: 'DUPLICATE_SLUG' });
    res.status(400).json({ message: err.message || 'Create failed' });
  }
});

// PUT /api/articles/:id
router.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    if (body.status === 'published' && !body.publishedAt) body.publishedAt = new Date();
    const updated = await Article.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) return res.status(400).json({ message: 'Duplicate slug', code: 'DUPLICATE_SLUG' });
    res.status(400).json({ message: 'Update failed' });
  }
});

// PATCH /api/articles/:id/archive
router.patch('/:id/archive', async (req, res) => {
  try {
    const updated = await Article.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Archive failed' });
  }
});

// PATCH /api/articles/:id/restore
router.patch('/:id/restore', async (req, res) => {
  try {
    const updated = await Article.findByIdAndUpdate(req.params.id, { status: 'draft' }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Restore failed' });
  }
});

// DELETE /api/articles/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const updated = await Article.findByIdAndUpdate(req.params.id, { status: 'deleted' }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Delete failed' });
  }
});

module.exports = router;
