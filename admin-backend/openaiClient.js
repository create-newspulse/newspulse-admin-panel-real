// ✅ Correct usage for OpenAI v4+ with sane timeouts
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // If the OpenAI edge reports "Timed out reading request body" (408),
  // it usually means the upload took too long. Keep a conservative client timeout
  // to fail-fast and retry with smaller payload/chunks.
  timeout: Number(process.env.OPENAI_TIMEOUT_MS || 30000), // 30s default
});

module.exports = openai;
