// routes/askKiranOS.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

router.post('/ask-kiranos', async (req, res) => {
  const userQuestion = req.body.question;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are KiranOS, the AI system of News Pulse." },
          { role: "user", content: userQuestion }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (response.ok) {
      res.json({ reply: data.choices[0].message.content });
    } else {
      console.error("OpenAI error", data);
      res.status(500).json({ error: "KiranOS failed", details: data });
    }
  } catch (err) {
    console.error("Server error", err);
    res.status(500).json({ error: "KiranOS server error", details: err.message });
  }
});

module.exports = router;
