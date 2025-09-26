import mongoose from 'mongoose';

const SettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  value: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

export const Setting = mongoose.model('Setting', SettingSchema);
