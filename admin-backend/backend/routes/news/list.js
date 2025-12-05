// ✅ Minimal news listing + breaking + trending mock routes for local dev
const express = require('express');
const router = express.Router();

// GET /api/news?page=1&limit=10&language=en&status=published
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const language = String(req.query.language || 'en');
    const status = String(req.query.status || 'published');

    const total = 0;
    const items = [];
    return res.json({ ok: true, success: true, page, limit, total, items, language, status });
  } catch (e) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to load news list' });
  }
});

// GET /api/news/breaking
router.get('/breaking', async (req, res) => {
  try {
    // Return empty list for dev
    return res.json({ ok: true, success: true, items: [], total: 0 });
  } catch (e) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to load breaking news' });
  }
});

// GET /api/news/trending?limit=5
router.get('/trending', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '5', 10), 1), 50);
    return res.json({ ok: true, success: true, items: [], total: 0, limit });
  } catch (e) {
    return res.status(500).json({ ok: false, success: false, message: 'Failed to load trending news' });
  }
});

module.exports = router;
