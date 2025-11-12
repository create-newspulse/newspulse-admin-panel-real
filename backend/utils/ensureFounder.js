const Founder = require('../models/Founder');
const argon2 = require('argon2');

async function ensureFounderPin() {
  let f = await Founder.findOne();
  if (!f) {
    const pin = process.env.FOUNDER_PIN || '123456';
    const pinHash = await argon2.hash(pin);
    f = await Founder.create({ pinHash });
  }
  return true;
}

module.exports = { ensureFounderPin };
