import express from 'express';
const router = express.Router();

// Simple PTI evaluation: banned terms + source link presence
const BANNED = ['clickbait','plagiarized','untested'];

function evaluatePTI({ title = '', content = '' }) {
  const reasons = [];
  const lower = (title + ' ' + content).toLowerCase();
  for (const w of BANNED) if (lower.includes(w)) reasons.push(`Contains banned term: ${w}`);
  if (!/https?:\/\//i.test(content)) reasons.push('No source link detected');
  const status = reasons.length ? 'needs_review' : 'compliant';
  return { status, reasons };
}

router.post('/pti-check', (req, res) => {
  try {
    const { title, content } = req.body || {};
    if (!title || !content) return res.status(400).json({ success:false, message:'title and content required' });
    const result = evaluatePTI({ title, content });
    res.json(result);
  } catch (err) {
    console.error('PTI route error:', err);
    res.status(500).json({ success:false, message:'Internal error' });
  }
});

export default router;
