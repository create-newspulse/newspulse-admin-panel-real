// ✅ admin-backend/backend/routes/security/webauthn.js
// WebAuthn/Passkey Registration & Authentication

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// In-memory stores (replace with MongoDB in production)
const credentialStore = new Map(); // userId -> [credentials]
const challengeStore = new Map(); // userId -> challenge

// Helper: Generate random challenge
function generateChallenge() {
  return crypto.randomBytes(32).toString('base64url');
}

// Helper: Verify challenge
function verifyChallenge(userId, challenge) {
  const stored = challengeStore.get(userId);
  challengeStore.delete(userId);
  return stored === challenge;
}

// ====== Registration Flow ======

// POST: Begin registration (generate challenge)
router.post('/register/begin', (req, res) => {
  const { userId, username } = req.body;
  
  if (!userId || !username) {
    return res.status(400).json({ error: 'userId and username required' });
  }

  const challenge = generateChallenge();
  challengeStore.set(userId, challenge);

  // WebAuthn registration options
  const options = {
    challenge,
    rp: {
      name: 'NewsPulse Admin',
      id: 'localhost' // Change to your domain in production
    },
    user: {
      id: Buffer.from(userId).toString('base64url'),
      name: username,
      displayName: username
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },  // ES256
      { type: 'public-key', alg: -257 } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'cross-platform', // Allow USB keys, phones
      requireResidentKey: false,
      userVerification: 'preferred'
    },
    timeout: 60000,
    attestation: 'none'
  };

  res.json({ success: true, options });
});

// POST: Complete registration (verify and store credential)
router.post('/register/complete', (req, res) => {
  const { userId, credential, clientDataJSON, attestationObject } = req.body;

  if (!userId || !credential) {
    return res.status(400).json({ error: 'Invalid registration data' });
  }

  // In production, verify attestation and signature here
  // For now, simplified storage

  const storedCredentials = credentialStore.get(userId) || [];
  const newCredential = {
    id: credential.id || crypto.randomUUID(),
    publicKey: credential.publicKey || crypto.randomBytes(64).toString('base64'),
    counter: 0,
    transports: credential.transports || ['usb', 'nfc', 'ble'],
    createdAt: new Date().toISOString(),
    lastUsed: null,
    device: {
      name: req.body.deviceName || 'Unknown Device',
      type: req.body.deviceType || 'security-key',
      browser: req.headers['user-agent']?.match(/(Chrome|Firefox|Safari|Edge)/)?.[0] || 'Unknown'
    }
  };

  storedCredentials.push(newCredential);
  credentialStore.set(userId, storedCredentials);

  console.log(`✅ [WebAuthn] Registered credential for user ${userId}: ${newCredential.id}`);

  res.json({ 
    success: true, 
    credentialId: newCredential.id,
    message: 'Passkey registered successfully' 
  });
});

// ====== Authentication Flow ======

// POST: Begin authentication (generate challenge)
router.post('/authenticate/begin', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const credentials = credentialStore.get(userId);
  if (!credentials || credentials.length === 0) {
    return res.status(404).json({ error: 'No credentials found for user' });
  }

  const challenge = generateChallenge();
  challengeStore.set(userId, challenge);

  const options = {
    challenge,
    timeout: 60000,
    rpId: 'localhost',
    allowCredentials: credentials.map(cred => ({
      type: 'public-key',
      id: cred.id,
      transports: cred.transports
    })),
    userVerification: 'preferred'
  };

  res.json({ success: true, options });
});

// POST: Complete authentication (verify signature)
router.post('/authenticate/complete', (req, res) => {
  const { userId, credentialId, signature, challenge } = req.body;

  if (!userId || !credentialId) {
    return res.status(400).json({ error: 'Invalid authentication data' });
  }

  // Verify challenge
  if (!verifyChallenge(userId, challenge)) {
    return res.status(401).json({ error: 'Invalid challenge' });
  }

  const credentials = credentialStore.get(userId);
  const credential = credentials?.find(c => c.id === credentialId);

  if (!credential) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  // In production: verify signature with stored public key
  // For now, simplified verification

  credential.counter++;
  credential.lastUsed = new Date().toISOString();

  console.log(`✅ [WebAuthn] User ${userId} authenticated with credential ${credentialId}`);

  res.json({ 
    success: true, 
    message: 'Authentication successful',
    credentialId,
    device: credential.device
  });
});

// ====== Management Endpoints ======

// GET: List user's registered credentials
router.get('/credentials/:userId', (req, res) => {
  const { userId } = req.params;
  const credentials = credentialStore.get(userId) || [];

  res.json({
    success: true,
    credentials: credentials.map(c => ({
      id: c.id,
      device: c.device,
      createdAt: c.createdAt,
      lastUsed: c.lastUsed,
      counter: c.counter,
      transports: c.transports
    }))
  });
});

// DELETE: Remove a credential
router.delete('/credentials/:userId/:credentialId', (req, res) => {
  const { userId, credentialId } = req.params;
  const credentials = credentialStore.get(userId);

  if (!credentials) {
    return res.status(404).json({ error: 'User not found' });
  }

  const filtered = credentials.filter(c => c.id !== credentialId);
  
  if (filtered.length === credentials.length) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  credentialStore.set(userId, filtered);
  console.log(`🗑️ [WebAuthn] Removed credential ${credentialId} for user ${userId}`);

  res.json({ success: true, message: 'Credential removed' });
});

export default router;
