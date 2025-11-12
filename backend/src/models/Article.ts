import mongoose, { Schema, Document, Model } from 'mongoose';

export type ArticleStatus = 'draft'|'scheduled'|'published'|'archived'|'deleted';
export type UserRole = 'writer'|'editor'|'admin'|'founder';
export type ArticleLanguage = 'en'|'hi'|'gu';
export type PTICompliance = 'compliant'|'pending'|'rejected'|'needs_review';

export interface ArticleAuthor {
  id?: mongoose.Types.ObjectId;
  name?: string;
  role?: UserRole;
}

export interface IArticle extends Document {
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  category?: string;
  tags: string[];
  status: ArticleStatus;
  author?: ArticleAuthor;
  language: ArticleLanguage;
  ptiCompliance: 'compliant'|'pending'|'rejected';
  trustScore?: number;
  scheduledAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  summary: { type: String },
  content: { type: String },
  category: { type: String, index: true },
  tags: { type: [String], default: [], index: true },
  status: { type: String, enum: ['draft','scheduled','published','archived','deleted'], default: 'draft', index: true },
  author: {
    id: { type: Schema.Types.ObjectId, ref: 'User' },
    name: String,
    role: { type: String, enum: ['writer','editor','admin','founder'] }
  },
  language: { type: String, enum: ['en','hi','gu'], default: 'en', index: true },
  ptiCompliance: { type: String, enum: ['compliant','pending','rejected'], default: 'pending' },
  trustScore: Number,
  scheduledAt: Date,
  publishedAt: Date
}, { timestamps: true });

ArticleSchema.index({ title: 'text', summary: 'text', content: 'text', tags: 'text' });

export const Article: Model<IArticle> = mongoose.models.Article || mongoose.model<IArticle>('Article', ArticleSchema);
