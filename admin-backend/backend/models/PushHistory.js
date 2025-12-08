const mongoose = require('mongoose');

// 📦 Push History Schema
const pushSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    content: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100 // Example: add a logical max if it's a score out of 100
    },
    type: {
      type: String,
      enum: ['auto', 'manual'], // auto = Smart Trigger, manual = Push Now
      default: 'auto'
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
      index: true // Direct index for faster queries
    }
  },
  {
    timestamps: true, // ✅ Adds createdAt & updatedAt fields
    versionKey: false // Hides __v
  }
);

// Additional index (recommended)
pushSchema.index({ triggeredAt: -1, type: 1, category: 1 });

module.exports =
  mongoose.models.PushHistory ||
  mongoose.model('PushHistory', pushSchema);
