const express = require('express');
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/api/dashboard-stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totals: { news: 247, today: 12, activeUsers: 1, pendingReviews: 5, totalViews: 125430 },
      byCategory: [
        { _id: 'Politics', count: 45 },
        { _id: 'Technology', count: 38 },
        { _id: 'Sports', count: 32 }
      ],
      byLanguage: [
        { _id: 'English', count: 150 },
        { _id: 'Hindi', count: 67 }
      ],
      recent: [],
      aiLogs: 1234,
      activeUsers: 1
    }
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totals: { news: 247, today: 12, activeUsers: 1, pendingReviews: 5, totalViews: 125430 },
      byCategory: [
        { _id: 'Politics', count: 45 },
        { _id: 'Technology', count: 38 }
      ],
      byLanguage: [
        { _id: 'English', count: 150 },
        { _id: 'Hindi', count: 67 }
      ],
      recent: [],
      aiLogs: 1234,
      activeUsers: 1
    }
  });
});

app.get('/api/system/health', (req, res) => {
  res.json({ cpu: 12.4, memory: 43.1, storage: 55.2, status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`Dev Mock Admin API listening on http://localhost:${PORT}`);
});
