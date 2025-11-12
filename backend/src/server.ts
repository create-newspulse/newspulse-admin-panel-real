import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import articles from './routes/articles.js';
import languageRoutes from './routes/language.js';
import complianceRoutes from './routes/compliance.js';
import assistRoutes from './routes/assist.js';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin: (process.env.ADMIN_ORIGIN ? process.env.ADMIN_ORIGIN.split(',') : true) as any,
  credentials: true
}));

app.get('/api/health', (_req,res)=> res.json({ ok:true }));
app.use('/api/articles', articles);
app.use('/api/language', languageRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/assist', assistRoutes);

const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/newspulse';

mongoose.connect(MONGO_URI).then(()=>{
  console.log('Mongo connected');
  app.listen(PORT, ()=> console.log(`API listening on http://localhost:${PORT}`));
}).catch(err=>{
  console.error('Mongo connection error', err);
  process.exit(1);
});
