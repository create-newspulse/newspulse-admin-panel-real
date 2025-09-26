import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: {
    en: { type: String, required: true },
    hi: { type: String },
    gu: { type: String },
  },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Category = mongoose.model('Category', CategorySchema);
