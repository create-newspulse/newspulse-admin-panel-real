const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const FILE = path.join(__dirname, '../data/history-today.json');
const TODAY = dayjs().format('YYYY-MM-DD');

// 🗓️ History fallback pool
const events = [
  "In 1969, Apollo 11 launched and successfully landed humans on the Moon.",
  "In 1947, India’s Constituent Assembly adopted its national flag.",
  "In 1983, the first mobile phone call was made in the U.S.",
  "In 1920, the League of Nations held its first council meeting in London.",
  "In 2004, Facebook was launched from a Harvard dormitory."
];

// 📥 Load history data safely
function loadHistory() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    console.warn('⚠️ No history file found. Creating new.');
    return [];
  }
}

// 💾 Save updated history list
function saveHistory(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    console.log('✅ history-today.json updated');
  } catch (err) {
    console.error('❌ Failed to write history file:', err.message);
  }
}

// 🚀 Generate today's historical entry
function generateTodayHistory() {
  const data = loadHistory();

  if (data.some(item => item.date === TODAY)) {
    console.log('⏭️ History for today already exists.');
    return;
  }

  const randomEvent = events[Math.floor(Math.random() * events.length)];

  data.unshift({
    event: randomEvent,
    language: 'en',
    date: TODAY,
  });

  saveHistory(data);
  console.log('✅ History entry added:', randomEvent);
}

generateTodayHistory();
