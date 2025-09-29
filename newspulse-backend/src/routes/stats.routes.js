import { Router } from 'express';
import mongoose from 'mongoose';
import News from '../models/News.js';
import Log from '../models/Log.js';

const r = Router();

// returns the four dashboard counters
r.get('/', async (req, res) => {
  const connected = mongoose.connection?.readyState === 1;

  if (!connected) {
    // Fallback so UI never looks broken
    return res.json({
      totals: { news: 0, categories: 0, languages: 0, users: 0 },
      aiLogs: 0,
      ok: true,
      source: 'fallback'
    });
  }

  // Derive counts quickly (optimize later with precomputed aggregate)
  const news = await News.countDocuments({});
  const categories = await News.distinct('category');
  const languages = await News.distinct('language');
  const aiLogs = await Log.countDocuments({});

  res.json({
    totals: {
      news,
      categories: categories.length,
      languages: languages.length,
      users: 0 // plug real user collection later
    },
    aiLogs,
    ok: true,
    source: 'mongo'
  });
});

export default r;
