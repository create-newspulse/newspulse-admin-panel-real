const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Where your data file will be stored
const filePath = path.join(__dirname, '../data/revenue.json');

// Default revenue structure if file doesn't exist
const defaultRevenue = {
  adsense: 0,
  affiliates: 0,
  sponsors: 0,
  total: 0,
  lastUpdated: null,
  // Add other fields as needed!
};

// Helper to read or initialize data file
function getRevenueData() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultRevenue, null, 2), 'utf-8');
    return { ...defaultRevenue };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    // Defensive: fill missing fields with defaults
    return { ...defaultRevenue, ...data };
  } catch {
    // On error/corrupt file, reset to default
    fs.writeFileSync(filePath, JSON.stringify(defaultRevenue, null, 2), 'utf-8');
    return { ...defaultRevenue };
  }
}

// GET /api/revenue
router.get('/', (req, res) => {
  const revenue = getRevenueData();
  res.json(revenue);
});

// Optional: update revenue (PUT/POST - secure this in production)
router.post('/', (req, res) => {
  try {
    const { adsense = 0, affiliates = 0, sponsors = 0 } = req.body || {};
    const total = Number(adsense) + Number(affiliates) + Number(sponsors);
    const updated = {
      adsense: Number(adsense),
      affiliates: Number(affiliates),
      sponsors: Number(sponsors),
      total,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('❌ Revenue API POST Error:', err.message);
    res.status(500).json({ error: 'Failed to update revenue data' });
  }
});

// GET /api/revenue/export/pdf
router.get('/export/pdf', (req, res) => {
  // Placeholder for PDF export logic
  res.status(200).send('🧾 PDF export will be available after launch');
});

module.exports = router;
