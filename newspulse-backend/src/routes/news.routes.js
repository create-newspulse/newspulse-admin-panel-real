import { Router } from 'express';
import mongoose from 'mongoose';
import News from '../models/News.js';

const r = Router();

r.get('/', async (req, res) => {
  const connected = mongoose.connection?.readyState === 1;
  if (!connected) {
    return res.json({
      items: [
        { _id: 'demo1', title: 'Welcome to News Pulse Admin', category: 'System', language: 'en', reads: 0, engagement: 0, publishedAt: null }
      ],
      total: 1
    });
  }

  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    News.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    News.countDocuments({})
  ]);

  res.json({ items, total });
});

export default r;
