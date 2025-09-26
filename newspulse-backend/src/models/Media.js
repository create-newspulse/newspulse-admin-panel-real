import mongoose from 'mongoose';

const MediaSchema = new mongoose.Schema({
  filename: String,
  url: String,
  width: Number,
  height: Number,
  sizeBytes: Number,
  mimetype: String,
  alt: String,
  credit: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Media = mongoose.model('Media', MediaSchema);
