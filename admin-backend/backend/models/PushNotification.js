const mongoose = require('mongoose');

// 📦 Push Notification Schema
const pushNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    }
    // read: { type: Boolean, default: false },           // Optional
    // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Optional
    // type: { type: String, default: 'info', enum: ['info', 'alert', 'success'] }   // Optional
  },
  {
    timestamps: true // ✅ Auto adds createdAt & updatedAt
  }
);

// 📌 Index for faster query on recent notifications
pushNotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.models.PushNotification || mongoose.model('PushNotification', pushNotificationSchema);
