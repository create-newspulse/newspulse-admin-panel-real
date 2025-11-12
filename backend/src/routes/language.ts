import { Router } from 'express';
import { checkEnglish } from '../services/lang/languageTool.js';
import { checkHindi } from '../services/lang/hindwi.js';
import { checkGujarati } from '../services/lang/gujaratilexicon.js';

const router = Router();

router.post('/verify', async (req,res) => {
  const { text = '', language } = req.body as { text: string; language: 'en'|'hi'|'gu' };
  try {
    let issues: any[] = [];
    if (language === 'en') issues = await checkEnglish(text);
    if (language === 'hi') issues = await checkHindi(text);
    if (language === 'gu') issues = await checkGujarati(text);
    res.json({ ok: issues.length === 0, issues });
  } catch (e:any) { res.status(500).json({ ok:false, issues:[], error:e.message }); }
});

router.post('/translate', async (req,res) => {
  const { text, from, to } = req.body as { text:string; from:'en'|'hi'|'gu'; to:'en'|'hi'|'gu' };
  // Placeholder translation passthrough
  res.json({ text, from, to, translated: text });
});

router.post('/readability', async (req,res) => {
  const { text = '', language } = req.body as { text:string; language:'en'|'hi'|'gu' };
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readingTimeSec = Math.round(wordCount / 3); // ~180 wpm -> 3 wps
  // naive grade: shorter sentences + simpler words -> lower grade
  const avgLen = wordCount === 0 ? 0 : text.length / wordCount;
  const grade = Math.max(1, Math.min(12, Math.round(avgLen / 4 + (wordCount > 400 ? 2 : 0))));
  res.json({ grade, readingTimeSec });
});

export default router;
