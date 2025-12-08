// admin-backend/backend/models/LiveContent.mjs
import mongoose from 'mongoose';

const LiveContentSchema = new mongoose.Schema({
  mode: { type: String, enum: ['inspiration', 'live'], default: 'inspiration' },
  embedCode: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'live_contents' });

// Ensure a singleton document
LiveContentSchema.statics.getSingleton = async function () {
  const doc = await this.findOne();
  if (doc) return doc;
  return this.create({ mode: 'inspiration', embedCode: '' });
};

export default mongoose.models.LiveContent || mongoose.model('LiveContent', LiveContentSchema);
