// 📁 backend/models/News.js

const mongoose = require('mongoose');

// 📰 News article schema – used by both AI and Admin publishing systems
const NewsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      enum: ['English', 'Hindi', 'Gujarati'],
      default: 'English',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    publishedBy: {
      type: String,
      enum: ['AI', 'Admin'],
      default: 'Admin',
    },
    isSuggested: {
      type: Boolean,
      default: false,
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    trendingScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    trustScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    tags: {
      type: [String],
      default: [],
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true,
    },
    mediaType: {
      type: String,
      enum: ['text', 'video', 'audio'],
      default: 'text',
    },
    isBreaking: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Optional: SEO and source reference fields
    seoTitle: {
      type: String,
      default: '',
      trim: true,
    },
    seoDescription: {
      type: String,
      default: '',
      trim: true,
    },
    sourceUrl: {
      type: String,
      default: '',
      trim: true,
    },
    // Optional: Future scheduling, editorial fields
    scheduledAt: {
      type: Date,
      default: null,
    },
    editorialNote: {
      type: String,
      default: '',
      trim: true,
    },
    // --- Smart workflow & compliance ---
    status: {
      type: String,
      enum: ['draft', 'review', 'legal', 'approved', 'scheduled', 'published'],
      default: 'draft',
      index: true,
    },
    workflow: {
      stage: {
        type: String,
        enum: ['draft', 'copy-edit', 'legal', 'section-approve', 'eic-approve', 'scheduled', 'published'],
        default: 'draft',
      },
      assignee: { type: String, default: '' },
      approvals: {
        type: [
          {
            by: String,
            role: String,
            at: { type: Date, default: Date.now },
            note: String,
          },
        ],
        default: [],
      },
      checklist: {
        ptiCompliance: { type: Boolean, default: false },
        rightsCleared: { type: Boolean, default: false },
        attributionPresent: { type: Boolean, default: false },
        defamationScanOk: { type: Boolean, default: false },
      },
    },
  },
  {
    timestamps: true, // ⏱️ Adds createdAt & updatedAt
    versionKey: false
  }
);

// Safe export for dev/hot-reload (important for serverless/dev environments)
module.exports = mongoose.models.News || mongoose.model('News', NewsSchema);
