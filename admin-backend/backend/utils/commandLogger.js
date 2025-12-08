const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../../logs/kiranos_logs.jsonl');

function saveCommandLog({ command, trigger, result, usedBy = 'admin' }) {
  const log = {
    command,
    trigger,
    usedBy,
    result,
    timestamp: new Date().toISOString()
  };
  fs.appendFile(logFile, JSON.stringify(log) + '\n', (err) => {
    if (err) console.error('⚠️ Failed to log command:', err);
  });
}

module.exports = { saveCommandLog };
