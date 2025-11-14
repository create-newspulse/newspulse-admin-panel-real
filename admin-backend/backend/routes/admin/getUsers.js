const express = require('express');
const router = express.Router();
const AdminUser = require('../../models/AdminUser');

router.get('/users', async (req, res) => {
  try {
    const users = await AdminUser.find().select('-password');
    res.json({ success: true, users });
  } catch (error) {
    console.error('❌ Failed to fetch users:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load users' });
  }
});

module.exports = router;
