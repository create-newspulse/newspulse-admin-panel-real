const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  // 🌐 Multilingual Question Support
  question_en: { type: String, required: true },
  question_hi: { type: String, default: '' },
  question_gu: { type: String, default: '' },

  // 🗳️ Options (min 2 required for English)
  options_en: {
    type: [String],
    required: true,
    validate: {
      validator: arr => arr.length >= 2,
      message: 'At least 2 English options are required',
    },
  },
  options_hi: { type: [String], default: [] },
  options_gu: { type: [String], default: [] },

  // 🧮 Votes for each option (will match options_en.length)
  votes: {
    type: [Number],
    default: [],
  },

  // 🕒 Poll creation time
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // ⏳ Optional expiry
  expiresAt: {
    type: Date,
    default: null,
  },

  // 🏷️ (Optional) Add category or createdBy if needed in future
  // category: { type: String, default: '' },
  // createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },

  // status: { type: String, enum: ['active', 'closed'], default: 'active' },

}, { versionKey: false });

// 🧠 Pre-save hook to ensure votes array matches options_en
pollSchema.pre('save', function (next) {
  if (!this.votes || this.votes.length !== this.options_en.length) {
    this.votes = Array(this.options_en.length).fill(0);
  }
  next();
});

// ✅ Safe model export for dev/hot-reload
module.exports = mongoose.models.Poll || mongoose.model('Poll', pollSchema);
