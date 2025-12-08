const mongoose = require('mongoose');

const SessionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser', // or 'User' if that's your user model
    required: true,
    index: true
  },
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop',
  },
  browser: {
    type: String,
    default: 'unknown',
  },
  ipAddress: {
    type: String,
    default: '0.0.0.0',
  },
  location: {
    type: String,
    default: 'unknown',
  },
  duration: {
    type: Number, // in seconds
    default: 0,
  },
  loginAt: {
    type: Date,
    default: Date.now,
  },
  logoutAt: {
    type: Date,
    default: null,
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
}, {
  timestamps: true // adds createdAt and updatedAt automatically
});

// Optional: Compound index for common queries
SessionLogSchema.index({ userId: 1, active: 1 });

module.exports = mongoose.models.SessionLog || mongoose.model('SessionLog', SessionLogSchema);
