// ✅ File: backend/routes/system/ai-queue.js

const express = require('express');
const router = express.Router();

let AiQueue;
try {
  AiQueue = require('../../models/AiQueue');
} catch (e) {
  console.error('❌ Failed to import AiQueue model:', e?.stack || e);
}

// 🛡️ Utility: Safe item formatting
function formatQueueItem(item = {}) {
  return {
    id: item._id?.toString() || 'unknown-id',
    title: (item.title || '').trim() || 'Untitled Task',
    status: item.status || 'pending',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

// 🩺 HEAD: /api/system/ai-queue (healthcheck)
router.head('/', (req, res) => res.status(200).end());

// 🔍 GET: /api/system/ai-queue
router.get('/', async (_req, res) => {
  if (!AiQueue) {
    return res.status(500).json({
      success: false,
      error: 'AI Queue model not found. Check backend setup.',
      queueLength: 0,
      pendingItems: [],
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Fetch latest 10 AI tasks (most recent first)
    const rawQueue = await AiQueue.find().sort({ createdAt: -1 }).limit(10).lean();

    const formattedQueue = Array.isArray(rawQueue)
      ? rawQueue.map(formatQueueItem)
      : [];

    return res.status(200).json({
      success: true,
      queueLength: formattedQueue.length,
      pendingItems: formattedQueue,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('❌ AI Queue Fetch Error:', err?.stack || err);
    return res.status(500).json({
      success: false,
      error: '❌ Failed to fetch AI queue. Please try again later.',
      debug: process.env.NODE_ENV !== 'production' ? String(err?.message || err) : undefined,
      queueLength: 0,
      pendingItems: [],
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
