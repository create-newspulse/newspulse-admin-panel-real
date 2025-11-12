const argon2 = require('argon2');
const Founder = require('../models/Founder');

async function verifyPin(pin) {
  const row = await Founder.findOne().lean();
  if (!row || !row.pinHash) return false;
  try { return await argon2.verify(row.pinHash, pin); } catch { return false; }
}

async function rotatePin(newPin) {
  const pinHash = await argon2.hash(newPin);
  await Founder.updateOne({}, { pinHash, updatedAt: new Date() }, { upsert: true });
  return true;
}

module.exports = { verifyPin, rotatePin };
