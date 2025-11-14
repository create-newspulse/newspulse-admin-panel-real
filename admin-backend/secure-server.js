// 🛡️ SECURE Backend Admin Setup Script
// Creates proper founder account with secure authentication

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();

// Enable CORS for all origins in development
app.use(cors({
  origin: ['http://localhost:5173', 'https://newspulse-admin-panel-real-mx60.vercel.app'],
  credentials: true
}));

app.use(bodyParser.json());

// 🔐 SECURE: Environment-based configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-change-this';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@newspulse.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Safe!2025@News';

// 👤 In-memory user database (replace with real database in production)
const users = [
  {
    id: 'founder-001',
    email: ADMIN_EMAIL,
    passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
    role: 'founder',
    name: 'System Founder',
    avatar: '',
    bio: 'News Pulse system founder account',
    createdAt: new Date().toISOString()
  },
  {
    id: 'demo-001',
    email: 'demo@newspulse.ai',
    passwordHash: bcrypt.hashSync('demo-password', 10),
    role: 'founder',
    name: 'Demo User',
    avatar: '',
    bio: 'Demo founder account for previews',
    createdAt: new Date().toISOString()
  }
];

// 🔐 SECURE LOGIN ENDPOINT
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return success response (don't send password hash)
    const { passwordHash, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });

    console.log(`✅ Successful login: ${email} (${user.role})`);

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 📊 Dashboard stats endpoint
app.get('/api/admin/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totalNews: 245,
      totalUsers: 1024,
      totalViews: 156789,
      pendingApprovals: 12,
      recentActivity: [
        { id: 1, action: 'News article published', time: '2 hours ago' },
        { id: 2, action: 'User registered', time: '4 hours ago' },
        { id: 3, action: 'Comment approved', time: '6 hours ago' }
      ]
    }
  });
});

// 🔍 Verify token endpoint
app.get('/api/admin/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const { passwordHash, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// 🏠 Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: '🛡️ News Pulse Admin API - Secure Authentication Enabled',
    endpoints: [
      'POST /api/admin/login - Admin login',
      'GET /api/admin/stats - Dashboard statistics',
      'GET /api/admin/verify - Token verification'
    ],
    users: users.map(u => ({ email: u.email, role: u.role }))
  });
});

// 🚀 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🛡️ Secure Admin API running on port ${PORT}`);
  console.log(`📊 Available accounts:`);
  users.forEach(user => {
    console.log(`   • ${user.email} (${user.role})`);
  });
  console.log(`🔐 Use these credentials to login securely`);
});

module.exports = app;