// backend/utils/jsonFileHelper.js
const fs = require('fs');
const path = require('path');

function ensureJsonFile(filePath, defaultContent) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf-8').trim() === '') {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
    return defaultContent;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
    return defaultContent;
  }
}

module.exports = { ensureJsonFile };
