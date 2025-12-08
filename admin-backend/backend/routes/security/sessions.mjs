import express from 'express';
import crypto from 'crypto';
const router = express.Router();

const activeSessions = [];

router.get('/', (req, res) => {
  const sessions = activeSessions.map((s) => ({
    id: s.id, userId: s.userId, email: s.email, ip: s.ip, device: s.device, browser: s.browser, location: s.location, createdAt: s.createdAt, lastActivity: s.lastActivity, expiresAt: s.expiresAt,
  }));
  return res.json({ success: true, sessions, total: sessions.length });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const idx = activeSessions.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Session not found' });
  activeSessions.splice(idx, 1);
  return res.json({ success: true, message: 'Session revoked' });
});

router.post('/', (req, res) => {
  const { userId, email, ip, userAgent } = req.body;
  if (!userId || !email) return res.status(400).json({ success: false, message: 'Missing userId or email' });
  const session = {
    id: crypto.randomUUID(), userId, email, ip: ip || 'unknown', device: parseDevice(userAgent), browser: parseBrowser(userAgent), location: 'India', createdAt: new Date().toISOString(), lastActivity: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  activeSessions.push(session);
  return res.json({ success: true, session });
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const session = activeSessions.find((s) => s.id === id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  session.lastActivity = new Date().toISOString();
  return res.json({ success: true, session });
});

function parseDevice(ua = '') { if (/mobile/i.test(ua)) return 'Mobile'; if (/tablet/i.test(ua)) return 'Tablet'; return 'Desktop'; }
function parseBrowser(ua = '') { if (/chrome/i.test(ua)) return 'Chrome'; if (/firefox/i.test(ua)) return 'Firefox'; if (/safari/i.test(ua)) return 'Safari'; if (/edge/i.test(ua)) return 'Edge'; return 'Unknown'; }

if (activeSessions.length === 0) {
  activeSessions.push(
    { id: crypto.randomUUID(), userId: 'u1', email: 'founder@newspulse.com', ip: '203.0.113.45', device: 'Desktop', browser: 'Chrome', location: 'Mumbai, India', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), lastActivity: new Date().toISOString(), expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(), },
    { id: crypto.randomUUID(), userId: 'u2', email: 'editor@newspulse.com', ip: '203.0.113.46', device: 'Mobile', browser: 'Safari', location: 'Delhi, India', createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(), expiresAt: new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString(), }
  );
}

export default router;