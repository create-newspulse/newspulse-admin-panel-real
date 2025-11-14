// backend/models/Article.js – Enhanced Manage News schema
const mongoose = require('mongoose');
const slugify = require('slugify');

const CATEGORY_ENUM = ['Breaking','Regional','National','International','Business','Sports','Lifestyle','Glamorous','SciTech','Editorial','WebStories','ViralVideos'];
const STATUS_ENUM = ['draft','scheduled','published','archived','deleted'];
const LANG_ENUM = ['en','hi','gu'];
const PTI_ENUM = ['compliant','pending','rejected'];

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, index: true },
  summary: { type: String, default: '', trim: true },
  content: { type: String, default: '', trim: true },
  category: { type: String, enum: CATEGORY_ENUM, required: true, index: true },
  tags: { type: [String], default: [], index: true },
  status: { type: String, enum: STATUS_ENUM, default: 'draft', index: true },
  imageUrl: { type: String, default: '' },
  source: { name: { type: String, default: '' }, url: { type: String, default: '' } },
  author: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
    type: { type: String, enum: ['human','ai'], default: 'human' }
  },
  language: { type: String, enum: LANG_ENUM, default: 'en', index: true },
  ptiCompliance: { type: String, enum: PTI_ENUM, default: 'pending', index: true },
  trustScore: { type: Number, default: 0, min: 0, max: 100 },
  isFlagged: { type: Boolean, default: false, index: true },
  scheduledAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

// Text + compound indexes for search & list performance
// Force text index to use a stable language to avoid MongoDB "language override unsupported" errors
// when our domain-specific language codes (e.g., 'hi','gu') are stored in the `language` field.
// Remove language override entirely (Mongo will treat all docs with default analyzer)
ArticleSchema.index({ title: 'text', summary: 'text', tags: 'text', content: 'text' }, { default_language: 'english' });
ArticleSchema.index({ status: 1, category: 1, language: 1, createdAt: -1 });

// Generate unique slug if missing or changed; append -2, -3… when conflicts
ArticleSchema.pre('validate', async function(next) {
  if (!this.isModified('title') && this.slug) return next();
  const base = slugify(this.slug || this.title || 'article', { lower: true, strict: true }) || 'article';
  let candidate = base; let n = 2;
  while (await mongoose.models.Article.findOne({ slug: candidate, _id: { $ne: this._id } })) {
    candidate = `${base}-${n++}`;
  }
  this.slug = candidate;
  next();
});

// Auto-set publishedAt when status moves to published
ArticleSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  if (this.isModified('status') && this.status === 'deleted' && !this.deletedAt) {
    this.deletedAt = new Date();
  }
  next();
});

module.exports = mongoose.models.Article || mongoose.model('Article', ArticleSchema);
