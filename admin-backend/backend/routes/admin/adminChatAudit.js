// backend/routes/admin/adminChatAudit.js
import express from 'express';
const router = express.Router();

// GET /
router.get('/', async (req, res) => {
  try {
    // Return mock data since MongoDB connection might not be available
    const audits = [
      {
        _id: 'demo-audit-1',
        user: 'admin@newspulse.com',
        action: 'Login',
        timestamp: new Date().toISOString(),
        details: 'Admin login from 192.168.1.1'
      },
      {
        _id: 'demo-audit-2',
        user: 'admin@newspulse.com',
        action: 'View Reports',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: 'Accessed analytics dashboard'
      }
    ];
    res.status(200).json({ success: true, count: audits.length, audits });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

export default router;
