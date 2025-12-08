const mongoose = require('mongoose');

const UserSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: String, // You can change to ObjectId if you want to reference AdminUser
      required: true,
      trim: true,
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
    },
  },
  {
    timestamps: true, // Adds createdAt & updatedAt
    versionKey: false, // Cleaner JSON output
  }
);

// Safe model export for hot-reload/dev/prod
module.exports = mongoose.models.UserSession || mongoose.model('UserSession', UserSessionSchema);
