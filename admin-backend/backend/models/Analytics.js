// 📁 admin-backend/backend/models/Analytics.js

const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: [
        'visit', 'click', 'submit', 'scroll', 'share',
        'push', 'ai_summary', 'login', 'logout',
        'bookmark', 'save', 'vote'
      ],
      required: true,
      lowercase: true,
      trim: true,
      index: true, // Fast event-type analytics
    },
    page: {
      type: String,
      required: true,
      trim: true,
      index: true, // Fast per-page queries
    },
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'News',
      default: null,
      index: true,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    role: {
      type: String,
      default: 'guest',
      lowercase: true,
    },
    language: {
      type: String,
      default: 'english',
      lowercase: true,
    },
    userAgent: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    referrer: {
      type: String,
      default: '',
    },
    additionalData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
    strict: false, // Allows storing new fields in the future without schema update
  }
);

// 🏷️ Optional: compound index for fast reporting
analyticsSchema.index({ eventType: 1, page: 1, timestamp: -1 }, { unique: false });

module.exports = mongoose.models.Analytics || mongoose.model('Analytics', analyticsSchema);
