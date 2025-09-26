import mongoose from 'mongoose';

const ArticleSchema = new mongoose.Schema({
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft', index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  tags: [{ type: String, trim: true, lowercase: true, index: true }],

  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },

  title: { en: String, hi: String, gu: String },
  summary: { en: String, hi: String, gu: String },
  body: { en: String, hi: String, gu: String },

  coverImage: {
    url: String,
    width: Number,
    height: Number,
    alt: String,
    credit: String,
  },

  publishedAt: { type: Date, index: true },

  seo: {
    title: { en: String, hi: String, gu: String },
    description: { en: String, hi: String, gu: String },
    keywords: [String],
  },
}, { timestamps: true });

ArticleSchema.index({ 'title.en': 'text', 'summary.en': 'text', tags: 'text' });

export const Article = mongoose.model('Article', ArticleSchema);
