// 📁 File: admin-backend/index.js

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const app = require('./backend/index');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in .env file');
  process.exit(1);
}

// 🌍 Connect to MongoDB and Start Server
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');

  app.listen(PORT, () => {
    console.log(`🚀 Backend running at: http://localhost:${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});
