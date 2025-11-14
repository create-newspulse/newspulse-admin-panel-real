const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../logs/kiranos_logs.jsonl');

function logCommand({ command, trigger, result, tag }) {
  const entry = {
    command,
    trigger,
    result,
    timestamp: new Date().toISOString(),
    ...(tag && { tag })
  };

  fs.appendFile(logFilePath, JSON.stringify(entry) + '\n', err => {
    if (err) console.error('❌ Failed to write to log:', err);
  });
}

module.exports = logCommand;
