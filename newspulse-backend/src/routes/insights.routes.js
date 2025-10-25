import { Router } from 'express';
import mongoose from 'mongoose';
import News from '../models/News.js';

const r = Router();

// weekly AI summary + top performing news (used by your "Weekly AI Insights" cards)
r.get('/weekly', async (_req, res) => {
  const connected = mongoose.connection?.readyState === 1;

  if (!connected) {
    return res.json({
      summary: { suggestedStories: 82, window: 'last_week' },
      top: { title: 'India’s Tech Leap in 2025', reads: 21000, engagement: 97 },
      ok: true,
      source: 'fallback'
    });
  }

  const aWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await News.find({ createdAt: { $gte: aWeekAgo } })
    .sort({ reads: -1 })
    .limit(1)
    .lean();

  const top = recent[0] || {
    title: 'No stories yet',
    reads: 0,
    engagement: 0
  };

  const suggestedStories = await News.countDocuments({ createdAt: { $gte: aWeekAgo } });

  res.json({
    summary: { suggestedStories, window: 'last_week' },
    top: { title: top.title, reads: top.reads, engagement: top.engagement },
    ok: true,
    source: 'mongo'
  });
});

export default r;
