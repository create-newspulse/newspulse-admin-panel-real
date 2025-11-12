const mongoose = require('mongoose');

const SnapshotSchema = new mongoose.Schema({
  snapshotId: { type: String, unique: true, index: true },
  checksum: { type: String, index: true },
  note: { type: String, default: '' },
  artifacts: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Snapshot', SnapshotSchema);
