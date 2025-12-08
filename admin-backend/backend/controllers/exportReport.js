const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

module.exports = async (req, res) => {
  const type = req.query.type || 'json';

  try {
    // 🧪 Replace this array with real log data from DB later
    const reportData = [
      {
        timestamp: new Date().toISOString(),
        user: 'Test',
        activity: 'Visited Home Page',
      },
      {
        timestamp: new Date().toISOString(),
        user: 'Admin',
        activity: 'Checked Dashboard',
      }
    ];

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `report-${timestamp}.${type}`;

    if (type === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(reportData);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'text/csv');
      return res.status(200).send(csv);
    }

    // Default: JSON export
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(reportData);

  } catch (err) {
    console.error('❌ Export error:', err);
    return res.status(500).json({
      success: false,
      message: '🚨 Failed to export report. Please try again later.',
    });
  }
};
