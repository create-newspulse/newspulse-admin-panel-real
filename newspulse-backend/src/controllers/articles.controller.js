import { z } from 'zod';
import slugify from 'slugify';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Article } from '../models/Article.js';
import { ok } from '../utils/ApiResponse.js';

const base = z.object({
  title: z.object({ en: z.string().min(3), hi: z.string().optional(), gu: z.string().optional() }),
  summary: z.object({ en: z.string().optional(), hi: z.string().optional(), gu: z.string().optional() }).optional(),
  body: z.object({ en: z.string().min(10), hi: z.string().optional(), gu: z.string().optional() }),
  categoryId: z.string().min(10),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft','review','published','archived']).default('draft'),
  publishedAt: z.string().datetime().optional(),
});

export const createSchema = z.object({ body: base });
export const updateSchema = z.object({
  params: z.object({ id: z.string().min(10) }),
  body: base.partial(),
});

export const listSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    status: z.enum(['draft','review','published','archived']).optional(),
    categoryId: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  })
});

export const createArticle = asyncHandler(async (req, res) => {
  const { title, body, categoryId, tags, status, publishedAt, summary } = req.body;
  const slug = slugify(title.en, { lower: true, strict: true }) + '-' + Date.now();
  const doc = await Article.create({
    title, body, categoryId, tags, status, summary,
    slug, authorId: req.user._id, publishedAt: publishedAt ? new Date(publishedAt) : undefined
  });
  res.status(201).json(ok(doc));
});

export const updateArticle = asyncHandler(async (req, res) => {
  const updated = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ success: false, error: { message: 'Not found' } });
  res.json(ok(updated));
});

export const getArticle = asyncHandler(async (req, res) => {
  const doc = await Article.findById(req.params.id);
  if (!doc) return res.status(404).json({ success: false, error: { message: 'Not found' } });
  res.json(ok(doc));
});

export const listArticles = asyncHandler(async (req, res) => {
  const { q, status, categoryId } = req.query;
  const page = Math.max(parseInt(req.query.page ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit ?? '20', 10), 1), 100);
  const filter = {};
  if (status) filter.status = status;
  if (categoryId) filter.categoryId = categoryId;
  if (q) filter.$text = { $search: q };

  const [items, total] = await Promise.all([
    Article.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip((page-1)*limit).limit(limit),
    Article.countDocuments(filter),
  ]);
  res.json(ok(items, { page, limit, total }));
});

export const deleteArticle = asyncHandler(async (req, res) => {
  await Article.findByIdAndDelete(req.params.id);
  res.status(204).end();
});
