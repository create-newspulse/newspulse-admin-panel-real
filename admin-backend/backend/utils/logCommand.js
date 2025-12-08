// ✅ backend/utils/logCommand.js

const fs = require('fs').promises;
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'ai-commands.json');
const MAX_LOG_ENTRIES = 1000; // Optional cap to avoid file growing too large

async function logCommand({ command, result, pattern = 'default' }) {
  const entry = {
    timestamp: new Date().toISOString(),
    command,
    result,
    pattern,
  };

  try {
    // Ensure log directory exists
    await fs.mkdir(LOG_DIR, { recursive: true });

    // Read existing logs or fallback to empty array
    let logs = [];
    try {
      const existing = await fs.readFile(LOG_FILE, 'utf8');
      logs = JSON.parse(existing || '[]');
    } catch (readErr) {
      console.warn('⚠️ No existing log found or failed to read, starting fresh.');
    }

    // Push new entry
    logs.push(entry);

    // Optional: Keep log size under control
    if (logs.length > MAX_LOG_ENTRIES) {
      logs = logs.slice(logs.length - MAX_LOG_ENTRIES);
    }

    // Write updated logs
    await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
    console.log('✅ AI command logged:', command);
  } catch (err) {
    console.error('❌ Failed to log AI command:', err.stack || err.message);
  }
}

module.exports = { logCommand };
