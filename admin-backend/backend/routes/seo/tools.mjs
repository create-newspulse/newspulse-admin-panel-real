// ESM clone for CommonJS package compatibility
import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// In-memory SEO analyzer
const urlAnalysis = new Map();

// GET: Analyze a URL for SEO (mock)
router.get('/analyze', (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Mock analysis
  const score = Math.floor(Math.random() * 40) + 60; // 60-100
  const issues = [
    { type: 'meta', message: 'Missing meta description', severity: 'medium' },
    { type: 'links', message: 'Too many outbound links', severity: 'low' },
    { type: 'images', message: 'Some images missing alt text', severity: 'low' }
  ];

  const result = {
    url,
    score,
    issues,
    recommendations: [
      'Add a meta description of 120-160 characters',
      'Reduce outbound links or use rel="nofollow" where appropriate',
      'Add alt text for all images'
    ],
    generatedAt: new Date().toISOString()
  };

  urlAnalysis.set(url, result);

  res.json({ success: true, analysis: result });
});

// POST: Generate suggested SEO metadata (mock)
router.post('/generate-meta', (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const metaTitle = `${title} | NewsPulse`;
  const metaDescription = content
    .replace(/<[^>]+>/g, '')
    .split(/\s+/)
    .slice(0, 25)
    .join(' ');

  res.json({
    success: true,
    meta: {
      title: metaTitle,
      description: `${metaDescription}...`,
      keywords: ['news', 'latest', 'updates', 'breaking'],
      canonical: 'https://newspulse.com/article/sample',
    }
  });
});

export default router;
