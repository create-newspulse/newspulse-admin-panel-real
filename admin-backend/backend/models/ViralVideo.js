const mongoose = require('mongoose');
const slugify = require('slugify');

const STATUS_ENUM = ['draft', 'published'];
const SOURCE_TYPE_ENUM = ['video_url', 'embed_url'];
const LANGUAGE_ENUM = ['en', 'hi', 'gu'];

const ViralVideoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, unique: true, index: true },
  summary: { type: String, default: '', trim: true },
  category: { type: String, default: '', trim: true, index: true },
  sourceName: { type: String, default: '', trim: true },
  thumbnailUrl: { type: String, default: '', trim: true },
  posterImage: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
  },
  videoUrl: { type: String, default: '', trim: true },
  embedUrl: { type: String, default: '', trim: true },
  sourceType: { type: String, enum: SOURCE_TYPE_ENUM, default: 'video_url', index: true },
  language: { type: String, enum: LANGUAGE_ENUM, default: 'en', index: true },
  tags: { type: [String], default: [] },
  status: { type: String, enum: STATUS_ENUM, default: 'draft', index: true },
  isActive: { type: Boolean, default: true, index: true },
  homepageVisible: { type: Boolean, default: false, index: true },
  homepageFeatured: { type: Boolean, default: false, index: true },
  featured: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date, default: null, index: true },
  sortOrder: { type: Number, default: null, index: true },
}, { timestamps: true, versionKey: false });

ViralVideoSchema.index({ status: 1, isActive: 1, homepageVisible: 1, homepageFeatured: 1, featured: 1, language: 1, category: 1, sortOrder: 1, publishedAt: -1 });
ViralVideoSchema.index({ title: 'text', summary: 'text', category: 'text', tags: 'text' }, { default_language: 'english' });

ViralVideoSchema.pre('validate', async function(next) {
  const base = slugify(this.slug || this.title || 'viral-video', { lower: true, strict: true }) || 'viral-video';
  let candidate = base;
  let counter = 2;

  while (await mongoose.models.ViralVideo.findOne({ slug: candidate, _id: { $ne: this._id } })) {
    candidate = `${base}-${counter++}`;
  }

  this.slug = candidate;
  next();
});

ViralVideoSchema.pre('save', function(next) {
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  if (this.status !== 'published') {
    this.publishedAt = null;
    this.homepageVisible = false;
    this.homepageFeatured = false;
    this.featured = false;
  } else {
    this.homepageVisible = true;
    const isHomepageFeatured = this.homepageFeatured === true || this.featured === true;
    this.homepageFeatured = isHomepageFeatured;
    this.featured = isHomepageFeatured;
  }
  if (this.thumbnailUrl && !this.posterImage?.url) {
    this.posterImage = {
      ...(this.posterImage || {}),
      url: this.thumbnailUrl,
    };
  }
  next();
});

module.exports = mongoose.models.ViralVideo || mongoose.model('ViralVideo', ViralVideoSchema);
