// ✅ File: backend/routes/location/geoLookup.js
const express = require('express');
const router = express.Router();
const { getCoordinates } = require('../../utils/geocoding');

// 📍 GET /api/location/get-coordinates?address=Ahmedabad
router.get('/get-coordinates', async (req, res) => {
  const { address } = req.query;

  // 🔐 Validation
  if (!address) {
    return res.status(400).json({ error: 'Missing address query param' });
  }

  // 🌍 Fetching coordinates
  const coords = await getCoordinates(address);

  // ⚠️ Handle failure
  if (!coords) {
    return res.status(500).json({ error: 'Failed to fetch coordinates' });
  }

  // ✅ Send result
  res.json({ coordinates: coords });
});

module.exports = router;
