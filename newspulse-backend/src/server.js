// src/server.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Simple health check to verify the server is UP
app.get('/api/_ping', (_req, res) => res.json({ ok: true }));

// Mount your API (this makes final paths like /api/system/monitor-hub)
app.use('/api', routes);

// JSON 404 for unknown API paths
app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Not Found' }));

// Global error handler (so you see real errors instead of HTML 500s)
app.use((err, _req, res, _next) => {
  console.error('❌ API error:', err);
  res.status(500).json({ success: false, message: err?.message || 'Internal error' });
});

const PORT = process.env.PORT || 5000;
// Bind to 0.0.0.0 to avoid Windows/WSL quirks
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
});
