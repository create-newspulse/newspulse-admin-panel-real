const mongoose = require('mongoose');

const SINGLETON_ID = 'viral_video_settings';

const ViralVideoSettingsSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: SINGLETON_ID,
    immutable: true,
  },
  frontendEnabled: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  versionKey: false,
  strict: true,
});

ViralVideoSettingsSchema.statics.getOrInitialize = async function() {
  const rawConfig = await this.collection.findOne({ _id: SINGLETON_ID });
  if (!rawConfig) {
    return this.findOneAndUpdate(
      { _id: SINGLETON_ID },
      { $setOnInsert: { _id: SINGLETON_ID, frontendEnabled: true } },
      { new: true, upsert: true }
    );
  }

  if (typeof rawConfig.frontendEnabled !== 'boolean') {
    await this.collection.updateOne(
      { _id: SINGLETON_ID },
      {
        $set: { frontendEnabled: typeof rawConfig.frontendVisible === 'boolean' ? rawConfig.frontendVisible : true },
        $unset: { frontendVisible: '' },
      }
    );
  }

  return this.findById(SINGLETON_ID);
};

const ViralVideoSettings = mongoose.models.ViralVideoSettings || mongoose.model('ViralVideoSettings', ViralVideoSettingsSchema);

ViralVideoSettings.SINGLETON_ID = SINGLETON_ID;

module.exports = ViralVideoSettings;