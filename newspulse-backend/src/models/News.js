import mongoose from 'mongoose';
const NewsSchema = new mongoose.Schema(
  {
    title: String,
    category: String,
    language: String,
    reads: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 }, // 0–100
    publishedAt: Date
  },
  { timestamps: true }
);
export default mongoose.models.News || mongoose.model('News', NewsSchema);
