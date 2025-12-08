// 📁 backend/utils/commandDiagnostics.js

const fs = require('fs').promises;
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../logs/ai-commands.json');

async function summarizeDiagnostics() {
  try {
    const summary = {
      total: 0,
      lastUsed: 'N/A',
      mostUsed: ['None', 0],
      failures: [],
      patternHits: {},
      timeSeries: [],
    };

    // Check if log file exists
    const exists = await fs.access(LOG_FILE).then(() => true).catch(() => false);
    if (!exists) return summary;

    // Read and parse logs
    const content = await fs.readFile(LOG_FILE, 'utf8');
    const logs = JSON.parse(content || '[]');
    if (!Array.isArray(logs)) return summary;

    const commandCount = {};
    const patternHits = {};
    const timeSeriesMap = {};

    for (const log of logs) {
      const cmd = log.command?.toLowerCase() || 'unknown';
      const ts = log.timestamp?.split('T')[0] || 'unknown-day';
      const pattern = log.pattern || 'unlabeled';
      const result = log.result?.toLowerCase() || '';

      // Count command usage
      commandCount[cmd] = (commandCount[cmd] || 0) + 1;

      // Capture failures
      if (result.includes('fail') || result.includes('error')) {
        summary.failures.push(log);
      }

      // Track pattern hits
      patternHits[pattern] = (patternHits[pattern] || 0) + 1;

      // Track time series usage
      timeSeriesMap[ts] = (timeSeriesMap[ts] || 0) + 1;
    }

    summary.total = logs.length;
    summary.lastUsed = logs.at(-1)?.timestamp || 'N/A';

    // Determine most used command
    const sorted = Object.entries(commandCount).sort((a, b) => b[1] - a[1]);
    if (sorted.length) summary.mostUsed = sorted[0];

    // Format time series
    summary.patternHits = patternHits;
    summary.timeSeries = Object.entries(timeSeriesMap).map(([date, count]) => ({
      date,
      commands: count,
    }));

    return summary;
  } catch (err) {
    console.error('❌ summarizeDiagnostics() error:', err);
    return {
      total: 0,
      lastUsed: 'N/A',
      mostUsed: ['Error', 0],
      failures: [],
      patternHits: {},
      timeSeries: [],
      error: err.message,
    };
  }
}

module.exports = { summarizeDiagnostics };
