// 📍 backend/routes/system/regionHeatmap.js

const express = require('express');
const router = express.Router();
// const RegionStats = require('../../models/RegionStats'); // Uncomment and use for MongoDB

/**
 * GET /api/system/region-heatmap
 * Returns top regions and their active reader counts.
 * (Currently uses static data — replace with MongoDB aggregation for live stats)
 */
router.get('/region-heatmap', async (req, res) => {
  try {
    // 🟢 [Replace this block with your DB query as needed]
    // const topReaders = await RegionStats.aggregate([
    //   { $group: { _id: "$region", readers: { $sum: 1 } } },
    //   { $sort: { readers: -1 } },
    //   { $limit: 10 }
    // ]);
    // const formatted = topReaders.map(r => ({ region: r._id, readers: r.readers }));

    const staticData = [
      { region: 'Gujarat', readers: 1243 },
      { region: 'Delhi', readers: 982 },
      { region: 'Mumbai', readers: 871 },
    ];

    res.status(200).json({
      success: true,
      count: staticData.length,
      data: staticData,
      lastSync: new Date().toISOString(),
    });
  } catch (err) {
    console.error('❌ [Region Heatmap Error]:', err);
    res.status(500).json({
      success: false,
      error: 'Unable to fetch region data',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
});

module.exports = router;
