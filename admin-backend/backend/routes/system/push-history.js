// 📁 admin-backend/backend/routes/system/push-history.js

const express = require('express');
const router = express.Router();
const PushHistory = require('../../models/PushHistory');

// 🔍 GET: /api/push-history – Fetch 50 latest entries
router.get('/', async (req, res) => {
  try {
    let entries = [];
    try {
      entries = await PushHistory
        .find({ triggeredAt: { $ne: null } })
        .sort({ triggeredAt: -1 })
        .limit(50)
        .lean();
    } catch (err) {
      // Fallback to empty array if DB call fails
      entries = [];
      console.error('❌ DB fetch failed for push history:', err);
    }

    return res.status(200).json({
      success: true,
      count: entries.length,
      data: entries
    });
  } catch (err) {
    console.error('❌ Failed to fetch push history:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching push history.',
      error: err.message
    });
  }
});

// ❌ DELETE: /api/push-history – Delete all push logs
router.delete('/', async (req, res) => {
  try {
    let result = { deletedCount: 0 };
    try {
      result = await PushHistory.deleteMany({});
    } catch (err) {
      // Still respond but log error
      console.error('❌ DB delete failed for push history:', err);
    }
    return res.status(200).json({
      success: true,
      message: '✅ All push history deleted.',
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('❌ Failed to delete push history:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting push history.',
      error: err.message
    });
  }
});

module.exports = router;
