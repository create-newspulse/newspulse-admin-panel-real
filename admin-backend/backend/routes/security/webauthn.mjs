import express from 'express';
import crypto from 'crypto';
const router = express.Router();

const credentialStore = new Map();
const challengeStore = new Map();
const generateChallenge = () => crypto.randomBytes(32).toString('base64url');
const verifyChallenge = (userId, challenge) => { const stored = challengeStore.get(userId); challengeStore.delete(userId); return stored === challenge; };

router.post('/register/begin', (req, res) => {
  const { userId, username } = req.body;
  if (!userId || !username) return res.status(400).json({ error: 'userId and username required' });
  const challenge = generateChallenge();
  challengeStore.set(userId, challenge);
  const options = {
    challenge,
    rp: { name: 'NewsPulse Admin', id: 'localhost' },
    user: { id: Buffer.from(userId).toString('base64url'), name: username, displayName: username },
    pubKeyCredParams: [ { type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 } ],
    authenticatorSelection: { authenticatorAttachment: 'cross-platform', requireResidentKey: false, userVerification: 'preferred' },
    timeout: 60000, attestation: 'none'
  };
  res.json({ success: true, options });
});

router.post('/register/complete', (req, res) => {
  const { userId, credential } = req.body;
  if (!userId || !credential) return res.status(400).json({ error: 'Invalid registration data' });
  const stored = credentialStore.get(userId) || [];
  const newCredential = { id: credential.id || crypto.randomUUID(), publicKey: credential.publicKey || crypto.randomBytes(64).toString('base64'), counter: 0, transports: credential.transports || ['usb','nfc','ble'], createdAt: new Date().toISOString(), lastUsed: null, device: { name: req.body.deviceName || 'Unknown Device', type: req.body.deviceType || 'security-key', browser: req.headers['user-agent']?.match(/(Chrome|Firefox|Safari|Edge)/)?.[0] || 'Unknown' } };
  stored.push(newCredential); credentialStore.set(userId, stored);
  res.json({ success: true, credentialId: newCredential.id, message: 'Passkey registered successfully' });
});

router.post('/authenticate/begin', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const credentials = credentialStore.get(userId);
  if (!credentials || credentials.length === 0) return res.status(404).json({ error: 'No credentials found for user' });
  const challenge = generateChallenge(); challengeStore.set(userId, challenge);
  const options = { challenge, timeout: 60000, rpId: 'localhost', allowCredentials: credentials.map(c => ({ type: 'public-key', id: c.id, transports: c.transports })), userVerification: 'preferred' };
  res.json({ success: true, options });
});

router.post('/authenticate/complete', (req, res) => {
  const { userId, credentialId, challenge } = req.body;
  if (!userId || !credentialId) return res.status(400).json({ error: 'Invalid authentication data' });
  if (!verifyChallenge(userId, challenge)) return res.status(401).json({ error: 'Invalid challenge' });
  const credentials = credentialStore.get(userId);
  const cred = credentials?.find(c => c.id === credentialId);
  if (!cred) return res.status(404).json({ error: 'Credential not found' });
  cred.counter++; cred.lastUsed = new Date().toISOString();
  res.json({ success: true, message: 'Authentication successful', credentialId, device: cred.device });
});

router.get('/credentials/:userId', (req, res) => {
  const { userId } = req.params;
  const credentials = credentialStore.get(userId) || [];
  res.json({ success: true, credentials: credentials.map(c => ({ id: c.id, device: c.device, createdAt: c.createdAt, lastUsed: c.lastUsed, counter: c.counter, transports: c.transports })) });
});

router.delete('/credentials/:userId/:credentialId', (req, res) => {
  const { userId, credentialId } = req.params;
  const credentials = credentialStore.get(userId);
  if (!credentials) return res.status(404).json({ error: 'User not found' });
  const filtered = credentials.filter(c => c.id !== credentialId);
  if (filtered.length === credentials.length) return res.status(404).json({ error: 'Credential not found' });
  credentialStore.set(userId, filtered);
  res.json({ success: true, message: 'Credential removed' });
});

export default router;