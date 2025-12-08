const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/kiranos_logs.jsonl');

function saveCommandLog({ command, trigger, result, usedBy = 'admin' }) {
  const log = {
    command,
    trigger,
    result,
    usedBy,
    timestamp: new Date().toISOString()
  };

  // ✅ Ensure logs folder exists
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

  fs.appendFile(LOG_FILE, JSON.stringify(log) + '\n', (err) => {
    if (err) {
      console.error('❌ Failed to save command log:', err);
    }
  });
}

module.exports = { saveCommandLog };
