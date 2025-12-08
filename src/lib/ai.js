// 📁 src/lib/ai.ts
import api from './api';
// 🧠 AI Summary Generator
export const summarizeContent = (content) => api.post('/ai/summarize', { content });
// 🌟 AI Headline Ranker (used in AddNews + AI Ranker page)
export const rankHeadline = (title) => api.post('/ai/headline-rank', { title });
// 🛡️ PTI Compliance Checker
export const checkPTI = (content) => api.post('/ai/pti-check', { content });
// 🪄 AI Headline Improver (returns better version)
export const suggestHeadline = (title) => api.post('/ai/suggest-headline', { title });
