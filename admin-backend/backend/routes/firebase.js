const express = require('express');
const router = express.Router();
const admin = require('../utils/firebaseAdmin');
const UserFCMToken = require('../models/UserFCMToken');

// 🔐 POST /api/firebase/verify-token
router.post('/verify-token', async (req, res) => {
  const { idToken } = req.body;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    res.json({ success: true, uid: decoded.uid, email: decoded.email });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token', error: err.message });
  }
});

// 📥 POST /api/firebase/store-token
router.post('/store-token', async (req, res) => {
  const { uid, token } = req.body;

  if (!uid || !token) {
    return res.status(400).json({ success: false, message: 'Missing uid or token' });
  }

  try {
    await UserFCMToken.findOneAndUpdate(
      { uid },
      { token, lastUsedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Token saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📩 POST /api/firebase/send-notification
router.post('/send-notification', async (req, res) => {
  const { fcmToken, title, body } = req.body;

  const message = {
    token: fcmToken,
    notification: { title, body },
  };

  try {
    const response = await admin.messaging().send(message);
    res.json({ success: true, response });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📡 POST /api/firebase/broadcast
router.post('/broadcast', async (req, res) => {
  const { title, body } = req.body;

  try {
    const tokens = await UserFCMToken.find().distinct('token');
    if (!tokens.length) {
      return res.status(404).json({ success: false, message: 'No tokens found' });
    }

    const messages = tokens.map(token => ({
      token,
      notification: { title, body },
    }));

    const response = await admin.messaging().sendEach(messages);

    res.json({
      success: true,
      total: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
