// 📁 admin-backend/backend/db/connect.js

const mongoose = require('mongoose');

let eventListenersSet = false;

const connectDB = async () => {
  try {
    // Use environment variable or fallback to localhost for dev
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/newspulse';

    // Allow disabling DB in local/dev with special flags
    if (/^(skip|none|disable|disabled)$/i.test((MONGO_URI || '').trim())) {
      console.warn('⏭️  [connectDB] MongoDB connection disabled by MONGO_URI flag. Running without DB.');
      process.env.DB_DEGRADED = '1';
      return false;
    }

    // Warn if running production without MONGO_URI
    if (process.env.NODE_ENV === 'production' && !process.env.MONGO_URI && !process.env.MONGODB_URI) {
      console.warn('⚠️ [connectDB] MONGO_URI/MONGODB_URI not set in production! Using default/localhost.');
    }

    // Prevent double connections in development only (not in production)
    if (process.env.NODE_ENV !== 'production' && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    // Validate scheme
    if (!/^mongodb(\+srv)?:\/\//i.test(MONGO_URI)) {
      console.warn('⚠️  [connectDB] MONGO_URI does not start with mongodb:// or mongodb+srv://. Running without DB.');
      process.env.DB_DEGRADED = '1';
      return false;
    }

    // Modern Mongoose (v6+) no longer needs legacy options
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    const conn = mongoose.connection;
    console.log(`🟢 MongoDB connected: ${conn.host}/${conn.name}`);

    if (!eventListenersSet) {
      conn.on('error', (err) => {
        console.error('❌ [MongoDB] Runtime Error:', err.message);
      });

      conn.on('disconnected', () => {
        console.warn('⚠️ [MongoDB] Disconnected');
      });

      conn.on('reconnected', () => {
        console.log('🔁 [MongoDB] Reconnected');
      });

      eventListenersSet = true;
    }
  } catch (err) {
    // Allow the server to boot without MongoDB so the API can run in a degraded mode.
    // If you want to make Mongo mandatory, set REQUIRE_MONGO=1 in the environment.
    const requireMongo = process.env.REQUIRE_MONGO === '1';
    console.error('❌ [connectDB] MongoDB connection error:', err.message);

    if (requireMongo) {
      console.error('⛔ REQUIRE_MONGO=1 is set. Exiting because MongoDB is required.');
      process.exit(1);
    }

    console.warn('⚠️  Continuing in DEGRADED mode without MongoDB. Some routes will be limited.');
    process.env.DB_DEGRADED = '1';
    return false; // resolve with degraded mode
  }
};

module.exports = connectDB;
