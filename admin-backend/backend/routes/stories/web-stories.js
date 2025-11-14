// ✅ admin-backend/backend/routes/stories/web-stories.js
// AMP Web Stories Management

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// In-memory store (replace with MongoDB in production)
const storiesStore = new Map();

// Story templates
const templates = [
  {
    id: 'breaking-news',
    name: 'Breaking News',
    thumbnail: 'https://via.placeholder.com/300x500/e74c3c/fff?text=Breaking',
    pages: 3,
    style: {
      primaryColor: '#e74c3c',
      secondaryColor: '#c0392b',
      font: 'Montserrat'
    }
  },
  {
    id: 'photo-essay',
    name: 'Photo Essay',
    thumbnail: 'https://via.placeholder.com/300x500/3498db/fff?text=Photo',
    pages: 5,
    style: {
      primaryColor: '#3498db',
      secondaryColor: '#2980b9',
      font: 'Playfair Display'
    }
  },
  {
    id: 'interview',
    name: 'Interview',
    thumbnail: 'https://via.placeholder.com/300x500/9b59b6/fff?text=Interview',
    pages: 4,
    style: {
      primaryColor: '#9b59b6',
      secondaryColor: '#8e44ad',
      font: 'Lora'
    }
  },
  {
    id: 'data-viz',
    name: 'Data Visualization',
    thumbnail: 'https://via.placeholder.com/300x500/16a085/fff?text=Data',
    pages: 4,
    style: {
      primaryColor: '#16a085',
      secondaryColor: '#1abc9c',
      font: 'Roboto'
    }
  }
];

// Seed sample stories
function seedStories() {
  storiesStore.set('story-1', {
    id: 'story-1',
    title: 'Climate Summit 2025',
    status: 'published',
    template: 'breaking-news',
    createdAt: new Date('2025-10-20').toISOString(),
    updatedAt: new Date('2025-10-24').toISOString(),
    publishedAt: new Date('2025-10-24').toISOString(),
    author: 'admin@newspulse.com',
    pages: [
      {
        id: 'page-1',
        layers: [
          { type: 'background', url: 'https://via.placeholder.com/1080x1920/34495e', opacity: 1 },
          { type: 'text', content: 'Climate Summit 2025', x: 50, y: 800, fontSize: 48, color: '#fff', fontWeight: 'bold' }
        ]
      }
    ],
    metadata: {
      views: 12453,
      completionRate: 78,
      avgTimePerPage: 4.2
    }
  });

  storiesStore.set('story-2', {
    id: 'story-2',
    title: 'Tech Innovation Showcase',
    status: 'draft',
    template: 'photo-essay',
    createdAt: new Date('2025-10-25').toISOString(),
    updatedAt: new Date('2025-10-26').toISOString(),
    publishedAt: null,
    author: 'editor@newspulse.com',
    pages: [],
    metadata: {
      views: 0,
      completionRate: 0,
      avgTimePerPage: 0
    }
  });
}

seedStories();

// ====== CRUD Endpoints ======

// GET: List all stories
router.get('/', (req, res) => {
  const { status, author, limit = 50, offset = 0 } = req.query;
  
  let stories = Array.from(storiesStore.values());

  if (status) stories = stories.filter(s => s.status === status);
  if (author) stories = stories.filter(s => s.author === author);

  const total = stories.length;
  const paginated = stories
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    success: true,
    total,
    stories: paginated
  });
});

// GET: Single story
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const story = storiesStore.get(id);

  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }

  res.json({ success: true, story });
});

// POST: Create story
router.post('/', (req, res) => {
  const { title, template = 'breaking-news', author = 'unknown' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }

  const id = `story-${crypto.randomUUID().split('-')[0]}`;
  const templateData = templates.find(t => t.id === template) || templates[0];

  const story = {
    id,
    title,
    status: 'draft',
    template,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    author,
    pages: [],
    style: templateData.style,
    metadata: {
      views: 0,
      completionRate: 0,
      avgTimePerPage: 0
    }
  };

  storiesStore.set(id, story);
  console.log(`✅ [Web Stories] Created story: ${title} (${id})`);

  res.json({ success: true, story });
});

// PATCH: Update story
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const story = storiesStore.get(id);

  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }

  const updates = req.body;
  Object.assign(story, updates, { updatedAt: new Date().toISOString() });

  storiesStore.set(id, story);
  console.log(`✏️ [Web Stories] Updated story: ${id}`);

  res.json({ success: true, story });
});

// DELETE: Delete story
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  if (!storiesStore.has(id)) {
    return res.status(404).json({ error: 'Story not found' });
  }

  storiesStore.delete(id);
  console.log(`🗑️ [Web Stories] Deleted story: ${id}`);

  res.json({ success: true, message: 'Story deleted' });
});

// POST: Publish story
router.post('/:id/publish', (req, res) => {
  const { id } = req.params;
  const story = storiesStore.get(id);

  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }

  story.status = 'published';
  story.publishedAt = new Date().toISOString();
  story.updatedAt = new Date().toISOString();

  storiesStore.set(id, story);
  console.log(`🚀 [Web Stories] Published story: ${id}`);

  res.json({ success: true, story });
});

// GET: Templates
router.get('/templates/list', (req, res) => {
  res.json({ success: true, templates });
});

// GET: Story analytics
router.get('/:id/analytics', (req, res) => {
  const { id } = req.params;
  const story = storiesStore.get(id);

  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }

  // Mock analytics data
  const analytics = {
    views: story.metadata.views,
    completionRate: story.metadata.completionRate,
    avgTimePerPage: story.metadata.avgTimePerPage,
    pageDropoff: [100, 85, 72, 65, 58], // % who viewed each page
    shares: {
      facebook: Math.floor(story.metadata.views * 0.08),
      twitter: Math.floor(story.metadata.views * 0.12),
      whatsapp: Math.floor(story.metadata.views * 0.15)
    },
    traffic: {
      direct: Math.floor(story.metadata.views * 0.35),
      social: Math.floor(story.metadata.views * 0.45),
      search: Math.floor(story.metadata.views * 0.20)
    }
  };

  res.json({ success: true, analytics });
});

export default router;
