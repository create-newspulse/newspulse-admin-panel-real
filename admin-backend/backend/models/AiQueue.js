// ✅ File: backend/models/AiQueue.js

const mongoose = require('mongoose');

const AiQueueSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['training', 'analyze', 'summarize', 'optimize', 'auto'], // Add more if needed
      required: true,
    },
    title: {
      type: String,
      trim: true,
      default: '', // Optional short description/title
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    result: {
      type: String, // JSON/text result, or error info
      default: '',
    },
    initiatedBy: {
      type: String,
      default: 'system', // or 'admin', 'AI', 'cron', etc.
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt
    versionKey: false,
  }
);

// 🔁 Static method to enqueue a new task
AiQueueSchema.statics.enqueue = async function (type, opts = {}) {
  return await this.create({ type, status: 'pending', ...opts });
};

// ⚡ Index for type/status for faster dashboard/queries
AiQueueSchema.index({ type: 1, status: 1 });

// ✅ Export safely (for hot-reload/dev environments)
module.exports = mongoose.models.AiQueue || mongoose.model('AiQueue', AiQueueSchema);
