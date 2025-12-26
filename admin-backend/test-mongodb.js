#!/usr/bin/env node

import mongoose from 'mongoose';

const testMongoDB = async () => {
  try {
    console.log('🔍 Testing MongoDB connection...');
    
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/newspulse';
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ MongoDB connected successfully!');
    console.log(`📍 Database: ${mongoose.connection.name}`);
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    
    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Collections found: ${collections.length}`);
    
    if (collections.length > 0) {
      console.log('📋 Collection names:');
      collections.forEach(col => console.log(`   - ${col.name}`));
    }
    
    await mongoose.disconnect();
    console.log('✅ MongoDB test completed successfully!');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error(`   Error: ${error.message}`);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure MongoDB is running');
    console.error('   2. Check if the connection string is correct');
    console.error('   3. Verify network connectivity');
    console.error('   4. Check MongoDB logs for errors');
    
    process.exit(1);
  }
};

testMongoDB();
