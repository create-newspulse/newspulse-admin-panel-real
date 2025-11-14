// backend/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Admin' },
    email: { type: String, unique: true, required: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['founder', 'admin', 'editor'], default: 'admin' },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Convenience method
UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.model('User', UserSchema);
