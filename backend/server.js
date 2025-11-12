require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ? process.env.ADMIN_ORIGIN.split(',').map(s=>s.trim()) : true;
app.use(cors({ origin: ADMIN_ORIGIN, credentials: true }));
app.use(bodyParser.json());

// Connect Mongo
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/newspulse';
mongoose.set('strictQuery', false);
mongoose.connect(MONGO_URI).then(()=>{
  console.log('🗄️ Connected to MongoDB');
}).catch((err)=>{
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Routes
const articlesRouter = require('./routes/articles');
const languageRouter = require('./routes/language');
const complianceRouter = require('./routes/compliance');
const assistRouter = require('./routes/assist');
const founderRouter = require('./routes/founder');
const alertsRouter = require('./routes/alerts');
const alertsDispatchRouter = require('./routes/alerts-dispatch');
const pinRouter = require('./routes/pin');
const auditRouter = require('./routes/audit');
const systemRouter = require('./routes/system');
app.use('/api/articles', articlesRouter);
app.use('/api/language', languageRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/assist', assistRouter);
app.use('/api/founder', founderRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/alerts', alertsDispatchRouter);
app.use('/api/founder/pin', pinRouter);
app.use('/api/audit', auditRouter);
app.use('/api/system', systemRouter);

app.get('/', (_req, res) => res.send('✅ Backend is running'));

// Lightweight per-minute request counter for /api traffic
let __REQ_COUNT__ = 0;
global.__NP_RPM__ = 0;
app.use((req, _res, next) => {
  if (req.path && req.path.startsWith('/api')) __REQ_COUNT__ += 1;
  next();
});
setInterval(() => {
  global.__NP_RPM__ = __REQ_COUNT__;
  __REQ_COUNT__ = 0;
}, 60_000);
// Placeholder for active users; wire to auth/session if available
global.__NP_ACTIVE_USERS__ = global.__NP_ACTIVE_USERS__ || 0;

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
});
