const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    summary: { type: String, default: '' },
    content: { type: String, default: '' },
    category: { type: String, index: true },
    tags: { type: [String], default: [], index: true },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'archived', 'deleted'],
      default: 'draft',
      index: true,
    },
    author: {
      name: { type: String, default: '' },
    },
    language: { type: String, default: 'en', index: true },
    imageUrl: { type: String, default: '' },
    sourceName: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    ptiCompliance: {
      type: String,
      enum: ['compliant', 'pending', 'rejected'],
      default: 'pending',
    },
    trustScore: { type: Number, default: 0 },
    scheduledAt: { type: Date },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

ArticleSchema.index({ title: 'text', summary: 'text', content: 'text' });

// Pre-save hook to auto-generate unique slug if missing
ArticleSchema.pre('save', async function(next) {
  try {
    if (this.slug) return next();
    const base = (this.title || 'article').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'article';
    let attempt = base;
    let i = 2;
    while (await mongoose.models.Article.findOne({ slug: attempt, _id: { $ne: this._id } })) {
      attempt = `${base}-${i++}`;
    }
    this.slug = attempt;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Article', ArticleSchema);
