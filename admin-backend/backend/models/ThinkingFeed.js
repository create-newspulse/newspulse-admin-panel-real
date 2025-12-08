const mongoose = require('mongoose');

const ThinkingFeedSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info',
      lowercase: true,
      trim: true,
    },
    context: {
      type: String,
      default: 'general',
      trim: true,
      lowercase: true,
    }, // ✅ FIXED: this comma was missing!
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.ThinkingFeed || mongoose.model('ThinkingFeed', ThinkingFeedSchema);
