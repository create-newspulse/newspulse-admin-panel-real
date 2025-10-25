import mongoose from 'mongoose';
const LogSchema = new mongoose.Schema(
  { type: String, message: String, meta: Object },
  { timestamps: true }
);
export default mongoose.models.Log || mongoose.model('Log', LogSchema);
