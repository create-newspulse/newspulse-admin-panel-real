const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ===== Ads Inquiries (dev mock; in-memory) =====
// Contract expected by the admin frontend:
// - GET   /api/ads/inquiries
// - GET   /api/ads/inquiries/unread-count
// - PATCH /api/ads/inquiries/:id/mark-read
// - PATCH /api/ads/inquiries/:id/delete
// - PATCH /api/ads/inquiries/:id/restore
// - POST  /api/ads/inquiries/:id/reply
let AD_INQUIRIES = [];

function normalizeStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'read' || v === 'deleted' || v === 'new') return v;
  return 'new';
}

function matchesSearch(inq, q) {
  if (!q) return true;
  const s = String(q).toLowerCase();
  const hay = [inq.name, inq.email, inq.message].map((x) => String(x || '').toLowerCase()).join(' ');
  return hay.includes(s);
}

app.get('/api/ads/inquiries/unread-count', (req, res) => {
  const unread = AD_INQUIRIES.filter((x) => normalizeStatus(x.status) === 'new').length;
  return res.json({ ok: true, count: unread });
});

app.get('/api/ads/inquiries', (req, res) => {
  const status = req.query?.status ? normalizeStatus(req.query.status) : null;
  const page = Math.max(1, Number(req.query?.page || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 20) || 20));
  const search = String(req.query?.search || '').trim();

  let rows = AD_INQUIRIES.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  if (status) rows = rows.filter((x) => normalizeStatus(x.status) === status);
  if (search) rows = rows.filter((x) => matchesSearch(x, search));

  const start = (page - 1) * limit;
  const paged = rows.slice(start, start + limit);
  return res.json({ ok: true, inquiries: paged, page, limit, total: rows.length });
});

function findInquiryIndex(id) {
  const safe = String(id || '');
  return AD_INQUIRIES.findIndex((x) => String(x.id || x._id || '') === safe);
}

app.patch('/api/ads/inquiries/:id/mark-read', (req, res) => {
  const idx = findInquiryIndex(req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, message: 'Not Found' });
  const prev = AD_INQUIRIES[idx];
  const next = { ...prev, status: 'read', updatedAt: new Date().toISOString() };
  AD_INQUIRIES[idx] = next;
  return res.json({ ok: true, inquiry: next });
});

app.patch('/api/ads/inquiries/:id/delete', (req, res) => {
  const idx = findInquiryIndex(req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, message: 'Not Found' });
  const prev = AD_INQUIRIES[idx];
  const next = { ...prev, _prevStatus: normalizeStatus(prev.status), status: 'deleted', updatedAt: new Date().toISOString() };
  AD_INQUIRIES[idx] = next;
  return res.json({ ok: true, inquiry: next });
});

app.patch('/api/ads/inquiries/:id/restore', (req, res) => {
  const idx = findInquiryIndex(req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, message: 'Not Found' });
  const prev = AD_INQUIRIES[idx];
  const restored = prev?._prevStatus && normalizeStatus(prev._prevStatus) !== 'deleted' ? normalizeStatus(prev._prevStatus) : 'new';
  const next = { ...prev, status: restored, updatedAt: new Date().toISOString() };
  delete next._prevStatus;
  AD_INQUIRIES[idx] = next;
  return res.json({ ok: true, inquiry: next });
});

app.post('/api/ads/inquiries/:id/reply', (req, res) => {
  const idx = findInquiryIndex(req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, message: 'Not Found' });
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  if (!subject || !message) return res.status(400).json({ ok: false, message: 'subject and message are required' });
  const prev = AD_INQUIRIES[idx];
  const next = { ...prev, lastRepliedAt: new Date().toISOString() };
  AD_INQUIRIES[idx] = next;
  return res.json({ ok: true });
});

app.get('/api/dashboard-stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totals: { news: 247, today: 12, activeUsers: 1, pendingReviews: 5, totalViews: 125430 },
      byCategory: [
        { _id: 'Politics', count: 45 },
        { _id: 'Technology', count: 38 },
        { _id: 'Sports', count: 32 }
      ],
      byLanguage: [
        { _id: 'English', count: 150 },
        { _id: 'Hindi', count: 67 }
      ],
      recent: [],
      aiLogs: 1234,
      activeUsers: 1
    }
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totals: { news: 247, today: 12, activeUsers: 1, pendingReviews: 5, totalViews: 125430 },
      byCategory: [
        { _id: 'Politics', count: 45 },
        { _id: 'Technology', count: 38 }
      ],
      byLanguage: [
        { _id: 'English', count: 150 },
        { _id: 'Hindi', count: 67 }
      ],
      recent: [],
      aiLogs: 1234,
      activeUsers: 1
    }
  });
});

app.get('/api/system/health', (req, res) => {
  res.json({ cpu: 12.4, memory: 43.1, storage: 55.2, status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`Dev Mock Admin API listening on http://localhost:${PORT}`);
});
