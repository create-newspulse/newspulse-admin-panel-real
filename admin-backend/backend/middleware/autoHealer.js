// 📁 backend/middleware/autoHealer.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const HEAL_LOG = path.join(__dirname, '../data/ai-heal-log.json');

// ✅ Ensure parent directory exists
const logDir = path.dirname(HEAL_LOG);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

async function autoHealer(scanResult = {}) {
  const actions = [];

  // 🧠 Heal: Low reputation score
  if (scanResult.ipReputationScore && scanResult.ipReputationScore < 40) {
    actions.push('⚠️ Restarted server due to low reputation score.');
    try {
      exec('pm2 restart all', () => {});
    } catch (e) {
      actions.push('❌ Restart command failed.');
    }
  }

  // 🔐 Heal: Credentials Leaked
  if (scanResult.credentialsLeaked) {
    actions.push('🔐 Auto-rotated credentials (placeholder logic).');
  }

  // ⛔ Heal: Proxy Detected
  if (scanResult.proxyDetected) {
    actions.push('⛔ Blocked proxy IP (placeholder logic).');
  }

  // 📄 Healing Log Entry
  const logEntry = {
    healedAt: new Date().toISOString(),
    summary: actions.length ? actions : ['✅ No threat detected – no action needed.'],
    inputScan: scanResult,
  };

  // 💾 Write log (keep only last 30)
  try {
    const existing = fs.existsSync(HEAL_LOG)
      ? JSON.parse(fs.readFileSync(HEAL_LOG))
      : [];
    existing.push(logEntry);
    fs.writeFileSync(HEAL_LOG, JSON.stringify(existing.slice(-30), null, 2));
  } catch (err) {
    console.error('❌ Auto-heal log write failed:', err.message);
  }

  return { healed: true, actions };
}

module.exports = autoHealer;
