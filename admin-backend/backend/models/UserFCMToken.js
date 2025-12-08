const mongoose = require('mongoose');

const UserFCMTokenSchema = new mongoose.Schema({
  uid: { type: String, required: true }, // Firebase UID or internal user ID
  token: { type: String, required: true },
  lastUsedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('UserFCMToken', UserFCMTokenSchema);
