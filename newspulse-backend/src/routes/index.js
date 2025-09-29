import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// (optional) quick logger
app.use((req, _res, next) => { console.log('➡️', req.method, req.originalUrl); next(); });

app.use('/api', routes); // 👈 this makes final paths like /api/system/monitor-hub

// JSON 404 + global error handler (nice to have)
app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Not Found' }));
app.use((err, _req, res, _next) => {
  console.error('❌ API error:', err);
  res.status(500).json({ success: false, message: err?.message || 'Internal error' });
});

app.listen(process.env.PORT || 5000, () => console.log('🚀 API on http://localhost:5000'));
