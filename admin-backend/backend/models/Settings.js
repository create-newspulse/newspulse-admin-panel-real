const mongoose = require('mongoose');

// --- Main schema for app settings (flexible config object) ---
const SettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    config: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false, // Hide __v
    strict: true,      // Only allow schema fields (for safety)
  }
);

// --- STATIC: Ensure a settings doc exists, else auto-create ---
SettingsSchema.statics.ensure = async function (key, defaultConfig = {}) {
  let doc = await this.findOne({ key });
  if (!doc) {
    doc = await this.create({ key, config: defaultConfig });
    console.warn(`⚙️ [Settings.ensure] '${key}' not found, created with default config.`);
  }
  return doc;
};

// --- STATIC: Get a settings doc (returns doc, creates if missing) ---
SettingsSchema.statics.get = async function (key, defaultConfig = {}) {
  let doc = await this.findOne({ key });
  if (!doc) {
    doc = await this.create({ key, config: defaultConfig });
    console.warn(`⚙️ [Settings.get] '${key}' not found, created with default config.`);
  }
  return doc;
};

// --- Utility: Get as plain object (optional, use for API responses) ---
SettingsSchema.statics.getConfig = async function (key, defaultConfig = {}) {
  const doc = await this.get(key, defaultConfig);
  return doc ? doc.config : defaultConfig;
};

// --- Export: Avoid model overwrite in dev/hot reload ---
module.exports =
  mongoose.models.Settings ||
  mongoose.model('Settings', SettingsSchema);
