// ✅ FILE: /pages/api/ai/chat.js
import { ChatGPTAPI } from 'chatgpt';

const openai = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  const { message, model } = req.body;

  // Only allow GPT now
  if (!message || model !== 'gpt') {
    return res.status(400).json({ error: 'Only ChatGPT is enabled. Invalid model or message.' });
  }

  try {
    const gptRes = await openai.sendMessage(message, {
      systemMessage: "You are KiranOS, a loyal AI Manager for a global news platform. Respond clearly, helpfully, and professionally.",
    });

    res.status(200).json({ reply: gptRes.text });
  } catch (err) {
    console.error('[GPT Error]', err.message);
    res.status(500).json({ error: 'ChatGPT failed to respond', details: err.message });
  }
}
