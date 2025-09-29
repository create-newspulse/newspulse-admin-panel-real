import { Router } from 'express';
import mongoose from 'mongoose';
import News from '../models/News.js';

const r = Router();

// area/line chart data for traffic or posts/week
r.get('/traffic', async (_req, res) => {
  const connected = mongoose.connection?.readyState === 1;
  if (!connected) {
    // Simple 8-week dummy series
    const now = new Date();
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (7 * (7 - i)));
      return { label: d.toISOString().slice(0, 10), visits: 300 + i * 70 };
    });
    return res.json({ series: weeks, ok: true, source: 'fallback' });
  }

  // Aggregate reads by week (last 8)
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
  const agg = await News.aggregate([
    { $match: { createdAt: { $gte: eightWeeksAgo } } },
    {
      $group: {
        _id: { $isoWeek: '$createdAt', year: { $isoWeekYear: '$createdAt' } },
        visits: { $sum: '$reads' }
      }
    },
    { $sort: { '_id.year': 1, '_id.isoWeek': 1 } }
  ]);

  // Normalize to a simple array for charts
  const series = agg.map(a => ({
    label: `${a._id.year}-W${a._id.isoWeek || a._id}`,
    visits: a.visits
  }));

  res.json({ series, ok: true, source: 'mongo' });
});

export default r;
