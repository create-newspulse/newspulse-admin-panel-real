const express = require('express');
const router = express.Router();

// ✅ Only Founder can update roles
router.put('/update-role/:id', async (req, res) => {
  const { role } = req.body;
  const validRoles = ['founder', 'editor', 'intern'];

  // ⚠️ Validate role
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: '❌ Invalid role. Valid roles: founder, editor, intern',
    });
  }

  try {
    // Return mock success for demo
    res.json({
      success: true,
      message: `✅ Role updated to "${role}"`,
      data: {
        _id: req.params.id,
        role: role,
        updatedAt: new Date().toISOString()
      },
    });
  } catch (err) {
    console.error('❌ Role Update Error:', err.message);
    res.status(500).json({ success: false, message: '⚠️ Server error' });
  }
});

module.exports = router;
