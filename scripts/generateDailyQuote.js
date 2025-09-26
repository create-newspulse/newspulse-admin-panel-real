const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const filePath = path.join(__dirname, '../data/daily-quote.json');
const today = dayjs().format('YYYY-MM-DD');

// 🧠 Fallback quotes list
const quotes = [
  "The future belongs to those who believe in the beauty of their dreams.",
  "Believe you can and you're halfway there.",
  "What you get by achieving your goals is not as important as what you become by achieving your goals.",
  "Happiness is not something ready made. It comes from your own actions.",
  "Success is not final, failure is not fatal: It is the courage to continue that counts."
];

function generateDailyQuote() {
  let data = [];

  // ✅ Read existing data safely
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ No previous quotes or file missing. Starting fresh.');
  }

  // 🛑 Skip if today's quote already exists
  if (data.some(item => item.date === today)) {
    console.log('✅ Quote for today already exists');
    return;
  }

  // 🎯 Add new random quote
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  data.unshift({
    quote: randomQuote,
    language: 'en',
    date: today
  });

  // 💾 Save to file safely
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('✅ Daily Quote added:', randomQuote);
  } catch (err) {
    console.error('❌ Failed to save quote:', err.message);
  }
}

generateDailyQuote();
