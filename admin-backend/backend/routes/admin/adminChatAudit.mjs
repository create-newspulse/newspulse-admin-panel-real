import express from 'express';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const audits = [
      { _id: 'demo-audit-1', user: 'admin@newspulse.com', action: 'Login', timestamp: new Date().toISOString(), details: 'Admin login from 192.168.1.1' },
      { _id: 'demo-audit-2', user: 'admin@newspulse.com', action: 'View Reports', timestamp: new Date(Date.now() - 3600000).toISOString(), details: 'Accessed analytics dashboard' }
    ];
    // Compatibility: frontend expects { logs: [...] }
    const logs = audits.map(a => ({
      timestamp: a.timestamp,
      type: 'ADMIN',
      message: `${a.action}: ${a.details}`,
      origin: a.user,
    }));
    res.status(200).json({ success: true, count: audits.length, audits, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

export default router;