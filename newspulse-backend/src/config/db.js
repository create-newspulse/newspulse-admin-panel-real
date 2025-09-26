import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  if (!env.mongoUri) throw new Error('MONGO_URI is missing');
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    // Mongoose 8+ uses safe defaults; no deprecated options needed
    serverSelectionTimeoutMS: 10000,
  });
  console.log(`🟢 MongoDB connected: ${mongoose.connection.host}`);
}
