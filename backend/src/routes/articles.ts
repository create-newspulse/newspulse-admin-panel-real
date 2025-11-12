import { Router } from 'express';
import mongoose from 'mongoose';
import { Article } from '../models/Article.js';

const router = Router();

// List with filters
router.get('/', async (req, res) => {
  try {
    const { q, category, status, language, from, to, page = '1', limit = '20' } = req.query as Record<string,string>;
    const filter: any = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (language) filter.language = language;
    if (from || to) filter.createdAt = { $gte: from ? new Date(from) : new Date(0), $lte: to ? new Date(to) : new Date() };
    if (q) {
      // Special slug search syntax slug:xxx
      if (q.startsWith('slug:')) {
        filter.slug = q.split(':')[1];
      } else {
        filter.$text = { $search: q };
      }
    }
    const pageNum = parseInt(page, 10) || 1;
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * lim;
    const [data, total] = await Promise.all([
      Article.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
      Article.countDocuments(filter)
    ]);
    return res.json({ data, page: pageNum, pages: Math.ceil(total / lim), total });
  } catch (e:any) {
    return res.status(500).json({ error: e.message });
  }
});

// Get single
router.get('/:id', async (req,res) => {
  try {
    const art = await Article.findById(req.params.id);
    if (!art) return res.status(404).json({ error: 'Not found' });
    res.json(art);
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// Create
router.post('/', async (req,res) => {
  try {
    let { slug } = req.body;
    if (!slug && req.body.title) {
      slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    }
    // ensure unique slug
    if (slug) {
      let attempt = slug;
      let i = 1;
      while (await Article.exists({ slug: attempt })) {
        attempt = `${slug}-${i++}`;
      }
      slug = attempt;
    }
    const created = await Article.create({ ...req.body, slug });
    res.status(201).json(created);
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// Update
router.put('/:id', async (req,res) => {
  try {
    const updated = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// Archive
router.patch('/:id/archive', async (req,res) => {
  try {
    const updated = await Article.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// Restore
router.patch('/:id/restore', async (req,res) => {
  try {
    const updated = await Article.findByIdAndUpdate(req.params.id, { status: 'draft' }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// Soft delete
router.delete('/:id', async (req,res) => {
  try {
    const updated = await Article.findByIdAndUpdate(req.params.id, { status: 'deleted' }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

export default router;
