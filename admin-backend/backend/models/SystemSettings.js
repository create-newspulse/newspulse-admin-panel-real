// SystemSettings v1.0.2 | News Pulse Admin Backend
const mongoose = require('mongoose');

const SINGLETON_ID = 'system_config';

const SystemSettingsSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: SINGLETON_ID,
    immutable: true
  },
  engine: {
    type: String,
    enum: ['gpt', 'gemini', 'auto'],
    default: 'gpt'
  },
  lastTraining: { type: Date, default: null },
  nextTraining: { type: Date, default: null },
  articlesAnalyzed: { type: Number, default: 0, min: 0 },
  keywords: { type: Number, default: 0, min: 0 },
  patternFocus: { type: String, default: 'Not Set', trim: true },
  modulesTrained: {
    type: [String],
    default: [],
    validate: [Array.isArray, 'modulesTrained must be an array of strings']
  },
  lockedByFounder: { type: Boolean, default: false },
  availableEngines: {
    type: [String],
    default: ['gpt', 'gemini', 'auto']
  },
  // Optional: future admin notes
  // meta: { type: String, default: '', trim: true }
}, {
  timestamps: true,
  versionKey: false,
  strict: true
});

// === STATIC METHODS ===
SystemSettingsSchema.statics.ensureInitialized = async function () {
  let config = await this.findById(SINGLETON_ID);
  if (!config) {
    config = await this.findOneAndUpdate(
      { _id: SINGLETON_ID },
      { $setOnInsert: { _id: SINGLETON_ID } },
      { new: true, upsert: true }
    );
    console.warn('⚙️ SystemSettings missing — creating default config...');
  }
  return config;
};

SystemSettingsSchema.statics.getConfig = async function () {
  const config = await this.findById(SINGLETON_ID);
  if (!config) throw new Error('SystemSettings config not found');
  return config;
};

SystemSettingsSchema.statics.getOrInitialize = async function () {
  let config = await this.findById(SINGLETON_ID);
  if (!config) config = await this.ensureInitialized();
  return config;
};

const SystemSettings = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);
SystemSettings.SINGLETON_ID = SINGLETON_ID; // Attach to model

module.exports = SystemSettings;
