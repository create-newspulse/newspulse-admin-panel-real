// 📁 admin-backend/backend/models/Log.js

const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // e.g., 'ai', 'user-action'
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    ip: {
      type: String,
      trim: true,
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    meta: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

// Safe export for dev/hot-reload environments
module.exports = mongoose.models.Log || mongoose.model('Log', LogSchema);
