// ESM clone for CommonJS package compatibility
import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// In-memory stores
const commentsStore = new Map();
const shadowBannedUsers = new Set();
const autoModRules = [];

// Seed sample comments
function seedComments() {
  const sampleComments = [
    {
      author: 'user123@example.com',
      content: 'Great article! Very informative.',
      articleId: 'article-1',
      sentiment: 'positive',
      toxicity: 0.05,
      spam: false
    },
    {
      author: 'troll456@example.com',
      content: 'This is complete garbage! Fake news!',
      articleId: 'article-1',
      sentiment: 'negative',
      toxicity: 0.82,
      spam: false
    },
    {
      author: 'spammer789@example.com',
      content: 'Check out this amazing product! Click here: bit.ly/xyz',
      articleId: 'article-2',
      sentiment: 'neutral',
      toxicity: 0.12,
      spam: true
    },
    {
      author: 'reader101@example.com',
      content: 'I disagree with some points, but appreciate the research.',
      articleId: 'article-1',
      sentiment: 'neutral',
      toxicity: 0.08,
      spam: false
    },
    {
      author: 'toxic999@example.com',
      content: 'You people are idiots! This is why society is doomed.',
      articleId: 'article-3',
      sentiment: 'negative',
      toxicity: 0.91,
      spam: false
    }
  ];

  sampleComments.forEach((comment, i) => {
    const id = `comment-${i + 1}`;
    commentsStore.set(id, {
      id,
      ...comment,
      status: comment.toxicity > 0.7 || comment.spam ? 'pending' : 'approved',
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      moderatedBy: null,
      moderatedAt: null,
      flags: comment.toxicity > 0.7 ? ['high-toxicity'] : [],
      replies: 0,
      upvotes: Math.floor(Math.random() * 50),
      downvotes: Math.floor(Math.random() * 10)
    });
  });

  // Add some auto-mod rules
  autoModRules.push(
    { id: 'rule-1', type: 'keyword', pattern: 'spam|viagra|casino', action: 'reject', enabled: true },
    { id: 'rule-2', type: 'toxicity', threshold: 0.8, action: 'hold', enabled: true },
    { id: 'rule-3', type: 'sentiment', value: 'negative', threshold: 0.9, action: 'flag', enabled: true }
  );
}

seedComments();

// Helper: Analyze sentiment (mock)
function analyzeSentiment(text) {
  const positive = /great|excellent|love|amazing|wonderful/i;
  const negative = /bad|terrible|hate|awful|garbage/i;
  
  if (positive.test(text)) return { sentiment: 'positive', score: 0.85 };
  if (negative.test(text)) return { sentiment: 'negative', score: 0.75 };
  return { sentiment: 'neutral', score: 0.5 };
}

// Helper: Detect toxicity (mock)
function detectToxicity(text) {
  const toxicWords = /idiot|stupid|garbage|fake news|doomed|trash/i;
  const matches = (text.match(toxicWords) || []).length;
  return Math.min(matches * 0.3, 1.0);
}

// Helper: Detect spam (mock)
function detectSpam(text) {
  const spamPatterns = /bit\.ly|click here|buy now|limited offer|subscribe/i;
  return spamPatterns.test(text);
}

// ====== Comment Management ======

// GET: List comments
router.get('/', (req, res) => {
  const { status, articleId, author, limit = 50, offset = 0 } = req.query;
  
  let comments = Array.from(commentsStore.values());

  if (status) comments = comments.filter(c => c.status === status);
  if (articleId) comments = comments.filter(c => c.articleId === articleId);
  if (author) comments = comments.filter(c => c.author === author);

  const total = comments.length;
  const paginated = comments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    success: true,
    total,
    comments: paginated
  });
});

// GET: Single comment
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const comment = commentsStore.get(id);

  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  res.json({ success: true, comment });
});

// POST: Moderate comment
router.post('/:id/moderate', (req, res) => {
  const { id } = req.params;
  const { action, moderator = 'admin' } = req.body; // approve, reject, flag

  const comment = commentsStore.get(id);
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  switch (action) {
    case 'approve':
      comment.status = 'approved';
      break;
    case 'reject':
      comment.status = 'rejected';
      break;
    case 'flag':
      comment.flags.push('manual-flag');
      comment.status = 'flagged';
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }

  comment.moderatedBy = moderator;
  comment.moderatedAt = new Date().toISOString();
  comment.updatedAt = new Date().toISOString();

  commentsStore.set(id, comment);
  console.log(`✅ [Moderation] ${action} comment ${id} by ${moderator}`);

  res.json({ success: true, comment });
});

// POST: Shadow-ban user
router.post('/shadow-ban', (req, res) => {
  const { author, reason = 'Manual shadow-ban' } = req.body;

  if (!author) {
    return res.status(400).json({ error: 'Author email required' });
  }

  shadowBannedUsers.add(author);
  console.log(`🚫 [Shadow-ban] Added ${author}: ${reason}`);

  res.json({ 
    success: true, 
    message: `User ${author} shadow-banned`,
    shadowBannedUsers: Array.from(shadowBannedUsers)
  });
});

// DELETE: Remove shadow-ban
router.delete('/shadow-ban/:author', (req, res) => {
  const { author } = req.params;

  if (!shadowBannedUsers.has(author)) {
    return res.status(404).json({ error: 'User not shadow-banned' });
  }

  shadowBannedUsers.delete(author);
  console.log(`✅ [Shadow-ban] Removed ${author}`);

  res.json({ 
    success: true, 
    message: `Shadow-ban removed for ${author}`,
    shadowBannedUsers: Array.from(shadowBannedUsers)
  });
});

// GET: Shadow-banned users
router.get('/shadow-ban/list', (req, res) => {
  res.json({
    success: true,
    shadowBannedUsers: Array.from(shadowBannedUsers)
  });
});

// ====== Auto-Moderation Rules ======

// GET: List rules
router.get('/rules/list', (req, res) => {
  res.json({ success: true, rules: autoModRules });
});

// POST: Create rule
router.post('/rules', (req, res) => {
  const { type, pattern, threshold, action, enabled = true } = req.body;

  const rule = {
    id: `rule-${crypto.randomUUID().split('-')[0]}`,
    type,
    pattern,
    threshold,
    action,
    enabled,
    createdAt: new Date().toISOString()
  };

  autoModRules.push(rule);
  console.log(`✅ [Auto-mod] Created rule: ${rule.id}`);

  res.json({ success: true, rule });
});

// PATCH: Update rule
router.patch('/rules/:id', (req, res) => {
  const { id } = req.params;
  const rule = autoModRules.find(r => r.id === id);

  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  Object.assign(rule, req.body);
  console.log(`✏️ [Auto-mod] Updated rule: ${id}`);

  res.json({ success: true, rule });
});

// DELETE: Delete rule
router.delete('/rules/:id', (req, res) => {
  const { id } = req.params;
  const index = autoModRules.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  autoModRules.splice(index, 1);
  console.log(`🗑️ [Auto-mod] Deleted rule: ${id}`);

  res.json({ success: true, message: 'Rule deleted' });
});

// ====== Analytics ======

// GET: Moderation stats
router.get('/stats', (req, res) => {
  const comments = Array.from(commentsStore.values());

  const stats = {
    total: comments.length,
    approved: comments.filter(c => c.status === 'approved').length,
    pending: comments.filter(c => c.status === 'pending').length,
    rejected: comments.filter(c => c.status === 'rejected').length,
    flagged: comments.filter(c => c.status === 'flagged').length,
    shadowBanned: shadowBannedUsers.size,
    avgToxicity: (comments.reduce((sum, c) => sum + c.toxicity, 0) / comments.length).toFixed(2),
    spamDetected: comments.filter(c => c.spam).length,
    sentiment: {
      positive: comments.filter(c => c.sentiment === 'positive').length,
      neutral: comments.filter(c => c.sentiment === 'neutral').length,
      negative: comments.filter(c => c.sentiment === 'negative').length
    }
  };

  res.json({ success: true, stats });
});

// POST: Analyze comment (preview)
router.post('/analyze', (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content required' });
  }

  const sentiment = analyzeSentiment(content);
  const toxicity = detectToxicity(content);
  const spam = detectSpam(content);

  let recommendation = 'approve';
  if (toxicity > 0.8 || spam) recommendation = 'reject';
  else if (toxicity > 0.5) recommendation = 'hold';

  res.json({
    success: true,
    analysis: {
      sentiment: sentiment.sentiment,
      sentimentScore: sentiment.score,
      toxicity,
      spam,
      recommendation
    }
  });
});

export default router;
