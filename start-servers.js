#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const useDemo = args.has('--demo');
const DEFAULT_LOCAL_BACKEND = 'http://localhost:5000';
const DEFAULT_FRONTEND_PORT = '5173';
const REAL_BACKEND = process.env.NP_REAL_BACKEND || DEFAULT_LOCAL_BACKEND;
const DEMO_BACKEND = process.env.NP_DEMO_BACKEND || DEFAULT_LOCAL_BACKEND;

console.log(`🚀 Starting News Pulse Admin Panel (${useDemo ? 'demo backend + frontend' : 'real backend + frontend'})...\n`);

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

// Start demo backend server (optional)
const startBackend = () => {
  if (!useDemo) return null;
  console.log('🧩 Starting Demo Backend Server (admin-backend/demo-server.js)...');
  const backend = spawn('npm', ['run', 'dev:demo'], {
    cwd: path.join(__dirname, 'admin-backend'),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PORT: process.env.PORT || '5000',
    },
  });

  backend.on('error', (err) => {
    console.error('❌ Backend Error:', err.message);
  });

  return backend;
};

// Start frontend server
const startFrontend = () => {
  console.log('🎨 Starting Frontend Server...');
  const backendTarget = useDemo ? DEMO_BACKEND : REAL_BACKEND;
  console.log(`🔌 Frontend proxy target: ${backendTarget}`);
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NP_ADMIN_PORT: process.env.NP_ADMIN_PORT || DEFAULT_FRONTEND_PORT,
      VITE_ADMIN_API_TARGET: process.env.VITE_ADMIN_API_TARGET || backendTarget,
      VITE_DEV_PROXY_TARGET: process.env.VITE_DEV_PROXY_TARGET || backendTarget,
      VITE_DEMO_MODE: 'false',
      VITE_USE_MOCK: 'false',
    }
  });

  frontend.on('error', (err) => {
    console.error('❌ Frontend Error:', err.message);
  });

  return frontend;
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

    // Start backend (optional) then frontend
    const backendProcess = startBackend();
    const frontendProcess = startFrontend();

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down servers...');
      try { backendProcess && backendProcess.kill(); } catch {}
      frontendProcess.kill();
      process.exit(0);
    });

    // If one of the child processes exits unexpectedly, exit so the developer sees it.
    if (backendProcess) {
      backendProcess.on('close', (code) => {
        if (code && code !== 0) {
          console.error(`❌ Demo backend exited with code ${code}`);
        }
      });
    }
    frontendProcess.on('close', (code) => {
      if (code && code !== 0) {
        console.error(`❌ Frontend exited with code ${code}`);
      }
    });

  } catch (error) {
    console.error('❌ Startup Error:', error.message);
    process.exit(1);
  }
};

main();
