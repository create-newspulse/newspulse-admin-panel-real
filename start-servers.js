#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting News Pulse Admin Panel...\n');

// Check if MongoDB is running
const checkMongoDB = () => {
  return new Promise((resolve) => {
    const mongodb = spawn('mongosh', ['--eval', 'db.runCommand("ping")'], { 
      stdio: 'pipe',
      shell: true 
    });
    
    mongodb.on('close', (code) => {
      resolve(code === 0);
    });
    
    mongodb.on('error', () => {
      resolve(false);
    });
    
    // Timeout after 3 seconds
    setTimeout(() => {
      mongodb.kill();
      resolve(false);
    }, 3000);
  });
};

// Start backend server
const startBackend = () => {
  console.log('📦 Starting Backend Server...');
  const backend = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, 'admin-backend'),
    stdio: 'inherit',
    shell: true
  });

  backend.on('error', (err) => {
    console.error('❌ Backend Error:', err.message);
  });

  return backend;
};

// Start frontend server
const startFrontend = () => {
  console.log('🎨 Starting Frontend Server...');
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  frontend.on('error', (err) => {
    console.error('❌ Frontend Error:', err.message);
  });

  return frontend;
};

// Start Next.js Advanced Auth
const startNextAuth = () => {
  console.log('🔐 Starting Next.js Advanced Auth...');
  const nextAuth = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'next-auth'),
    stdio: 'inherit',
    shell: true
  });

  nextAuth.on('error', (err) => {
    console.error('❌ Next-Auth Error:', err.message);
  });

  return nextAuth;
};

// Main execution
const main = async () => {
  try {
    // Check MongoDB
    console.log('🔍 Checking MongoDB connection...');
    const mongoRunning = await checkMongoDB();
    
    if (!mongoRunning) {
      console.log('⚠️  MongoDB is not running. Please start MongoDB first:');
      console.log('   Windows: net start MongoDB');
      console.log('   macOS/Linux: brew services start mongodb-community');
      console.log('   Or: mongod --dbpath /path/to/your/db');
      console.log('\n🔄 Starting servers anyway (some features may not work)...\n');
    } else {
      console.log('✅ MongoDB is running\n');
    }

    // Start backend
    const backendProcess = startBackend();
    
    // Wait a bit for backend to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start frontend
  const frontendProcess = startFrontend();
  const nextAuthProcess = startNextAuth();

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down servers...');
      backendProcess.kill();
      frontendProcess.kill();
      nextAuthProcess.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Startup Error:', error.message);
    process.exit(1);
  }
};

main();
