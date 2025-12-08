// ✅ File: backend/models/AdminUser.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 🧾 Admin / Editor Schema
const AdminUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false, // Prevent password from being returned in queries
  },

  role: {
    type: String,
    enum: ['founder', 'editor', 'reporter', 'intern'],
    default: 'editor',
  },

  savedNews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'News',
  }],

  preferredCategories: {
    type: [String],
    default: ['National', 'Technology', 'Gujarati'],
  },

  avatar: {
    type: String,
    default: '',
  },

  bio: {
    type: String,
    default: '',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 🔐 Hash password before save (on creation or change)
AdminUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// 🔒 Password compare method (for login)
AdminUserSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// ✅ Export safely for hot-reload/dev environments
module.exports = mongoose.models.AdminUser || mongoose.model('AdminUser', AdminUserSchema);
