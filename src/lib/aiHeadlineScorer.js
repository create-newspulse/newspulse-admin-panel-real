// 📁 src/lib/aiHeadlineScorer.ts
import axios from 'axios';
// ✅ Use import.meta.env for frontend env access in Vite
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const endpoint = 'https://api.openai.com/v1/chat/completions';
export const scoreHeadline = async (headline) => {
    try {
        const res = await axios.post(endpoint, {
            model: 'gpt-3.5-turbo',
            temperature: 0.5,
            max_tokens: 10,
            messages: [
                {
                    role: 'system',
                    content: 'You are a headline ranking assistant. Score this headline between 0 and 100 based on emotional impact, clarity, and virality.',
                },
                {
                    role: 'user',
                    content: headline,
                },
            ],
        }, {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        const scoreStr = res.data.choices[0].message.content.trim();
        const score = parseInt(scoreStr, 10);
        return isNaN(score) ? 50 : score;
    }
    catch (err) {
        console.error('⚠️ AI Headline Scoring Error:', err);
        return 50;
    }
};
