const mongoose = require('mongoose');

const LoginAttemptLogSchema = new mongoose.Schema({
  ip: {
    type: String,
    trim: true,
    default: null
  },
  userAgent: {
    type: String,
    trim: true,
    default: null
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'blocked'],
    default: 'failed'
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true, // Adds createdAt/updatedAt for analytics
  versionKey: false
});

// Safe export for hot-reload/dev environments
module.exports = mongoose.models.LoginAttemptLog || mongoose.model('LoginAttemptLog', LoginAttemptLogSchema);
