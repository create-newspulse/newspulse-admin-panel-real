const express = require('express');
const axios = require('axios');
const router = express.Router();
const Poll = require('../models/Poll'); // ⬅️ Import your updated Poll model

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ Translate text using OpenAI
const translateText = async (text, targetLang) => {
  const langMap = { hi: 'Hindi', gu: 'Gujarati' };

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Translate the following text to ${langMap[targetLang]}. Keep it short, natural, and clear for a poll.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 200,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return res.data.choices[0].message.content.trim();
};

// ✅ Route: /ai/poll-question
router.post('/ai/poll-question', async (req, res) => {
  try {
    // STEP 1: Ask AI to generate poll
    const pollRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'Generate a civic-themed poll question with 4 multiple choice options. Keep it short, simple, and public-interest focused.',
          },
          {
            role: 'user',
            content: 'Give me 1 poll question and 4 options. No explanation needed.',
          },
        ],
        temperature: 0.6,
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const aiText = pollRes.data.choices[0].message.content;
    const lines = aiText.trim().split('\n').filter(Boolean);

    const question_en = lines[0].replace(/^\d+\.\s*/, '').trim();
    const options_en = lines.slice(1).map((line) =>
      line.replace(/^[-•]?\s?/, '').trim()
    );

    // STEP 2: Translate to Hindi and Gujarati
    const [question_hi, question_gu] = await Promise.all([
      translateText(question_en, 'hi'),
      translateText(question_en, 'gu'),
    ]);

    const [options_hi, options_gu] = await Promise.all([
      Promise.all(options_en.map((opt) => translateText(opt, 'hi'))),
      Promise.all(options_en.map((opt) => translateText(opt, 'gu'))),
    ]);

    // STEP 3: Save to MongoDB
    const newPoll = new Poll({
      question_en,
      question_hi,
      question_gu,
      options_en,
      options_hi,
      options_gu,
      votes: new Array(options_en.length).fill(0), // Example: [0, 0, 0, 0]
    });

    await newPoll.save();

    // STEP 4: Return saved poll
    return res.status(201).json({
      success: true,
      message: '✅ Poll generated and saved successfully!',
      poll: newPoll,
    });
  } catch (err) {
    console.error('❌ AI Poll Multilingual Error:', err.message);
    return res
      .status(500)
      .json({ error: 'AI multilingual generation failed' });
  }
});

module.exports = router;
