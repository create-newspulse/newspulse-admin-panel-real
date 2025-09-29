import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing');
    await mongoose.connect(uri, { dbName: 'newspulse', autoIndex: true });
    console.log('✅ Mongo connected');
  } catch (e) {
    console.error('❌ Mongo connection failed:', e.message);
    // keep server alive; routes will serve fallback dummy data
  }
};
