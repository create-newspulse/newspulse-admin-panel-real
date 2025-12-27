#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Setting up environment variables...\n');

const envContent = `# News Pulse Admin Backend Environment Variables

# Server Configuration
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173

# Database Configuration
MONGO_URI=mongodb://localhost:27017/newspulse
MONGODB_URI=mongodb://localhost:27017/newspulse

# API Keys (Replace with your actual keys)
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Server URL (set this to your backend origin)
SERVER_URL=

# Security
JWT_SECRET=your_jwt_secret_here_change_this_in_production

# Optional: Firebase Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
`;

const backendEnvPath = path.join(__dirname, 'admin-backend', '.env');
const rootEnvPath = path.join(__dirname, '.env');

try {
  // Create .env in admin-backend directory
  fs.writeFileSync(backendEnvPath, envContent);
  console.log('✅ Created admin-backend/.env');
  
  // Create .env in root directory
  fs.writeFileSync(rootEnvPath, envContent);
  console.log('✅ Created .env');
  
  console.log('\n📝 Next steps:');
  console.log('1. Edit the .env files and add your actual API keys');
  console.log('2. Make sure MongoDB is running');
  console.log('3. Run: npm run test-mongodb (to test database connection)');
  console.log('4. Run: npm start (to start both servers)');
  console.log('\n🔑 Required API Keys:');
  console.log('   - OPENAI_API_KEY: Get from https://platform.openai.com/api-keys');
  console.log('   - GEMINI_API_KEY: Get from https://makersuite.google.com/app/apikey');
  console.log('   - JWT_SECRET: Generate a random string for authentication');
  
} catch (error) {
  console.error('❌ Error creating .env files:', error.message);
  console.log('\n🔧 Manual setup:');
  console.log('1. Create admin-backend/.env with the environment variables');
  console.log('2. Create .env in the root directory with the same variables');
}
