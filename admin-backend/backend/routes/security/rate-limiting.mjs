// ESM clone for CommonJS package compatibility
import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// In-memory stores (replace with Redis in production)
const rateLimitStore = new Map(); // ip -> { count, firstRequest, blocked }
const blockedIPs = new Set(); // Manually blocked IPs
const attackLog = []; // Recent attack attempts

// Configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

// Seed data
function seedData() {
  // Simulate recent attacks
  for (let i = 0; i < 20; i++) {
    attackLog.push({
      id: crypto.randomUUID(),
      ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      endpoint: ['/api/auth/login', '/api/news/list', '/api/uploads'][Math.floor(Math.random() * 3)],
      method: 'POST',
      requests: Math.floor(Math.random() * 500) + 100,
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      status: Math.random() > 0.3 ? 'blocked' : 'throttled',
      userAgent: 'curl/7.64.1',
      country: ['US', 'CN', 'RU', 'BR', 'IN'][Math.floor(Math.random() * 5)]
    });
  }

  // Some active rate limits
  rateLimitStore.set('203.0.113.42', {
    count: 250,
    firstRequest: Date.now() - 30000,
    blocked: true,
    blockedUntil: Date.now() + 600000
  });

  blockedIPs.add('198.51.100.66');
  blockedIPs.add('203.0.113.99');
}

seedData();

// ====== Rate Limit Middleware (for demonstration) ======
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Check manual blocklist
  if (blockedIPs.has(ip)) {
    return res.status(403).json({ error: 'IP blocked by administrator' });
  }

  const now = Date.now();
  const record = rateLimitStore.get(ip) || { count: 0, firstRequest: now, blocked: false };

  // Reset if window expired
  if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
    record.count = 0;
    record.firstRequest = now;
    record.blocked = false;
  }

  record.count++;

  // Block if exceeded
  if (record.count > MAX_REQUESTS && !record.blocked) {
    record.blocked = true;
    record.blockedUntil = now + BLOCK_DURATION;

    attackLog.unshift({
      id: crypto.randomUUID(),
      ip,
      endpoint: req.originalUrl,
      method: req.method,
      requests: record.count,
      timestamp: new Date().toISOString(),
      status: 'blocked',
      userAgent: req.headers['user-agent'],
      country: 'Unknown'
    });

    if (attackLog.length > 100) attackLog.pop();

    console.log(`🚫 [Rate Limit] Blocked IP ${ip} - ${record.count} requests in ${RATE_LIMIT_WINDOW}ms`);
  }

  rateLimitStore.set(ip, record);

  if (record.blocked && now < record.blockedUntil) {
    return res.status(429).json({ 
      error: 'Too many requests', 
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000) 
    });
  }

  next();
}

// ====== Dashboard Endpoints ======

// GET: Rate limiting stats
router.get('/stats', (req, res) => {
  const now = Date.now();
  const activeRateLimits = Array.from(rateLimitStore.entries())
    .filter(([ip, record]) => now - record.firstRequest < RATE_LIMIT_WINDOW)
    .map(([ip, record]) => ({
      ip,
      requests: record.count,
      blocked: record.blocked,
      blockedUntil: record.blockedUntil ? new Date(record.blockedUntil).toISOString() : null,
      windowStart: new Date(record.firstRequest).toISOString()
    }))
    .sort((a, b) => b.requests - a.requests);

  res.json({
    success: true,
    stats: {
      totalActiveIPs: rateLimitStore.size,
      blockedIPs: Array.from(blockedIPs),
      manualBlockCount: blockedIPs.size,
      autoBlockCount: activeRateLimits.filter(r => r.blocked).length,
      recentAttacks: attackLog.length,
      windowMs: RATE_LIMIT_WINDOW,
      maxRequests: MAX_REQUESTS,
      blockDurationMs: BLOCK_DURATION
    },
    activeRateLimits: activeRateLimits.slice(0, 50),
    topOffenders: activeRateLimits.slice(0, 10)
  });
});

// GET: Attack log
router.get('/attacks', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  
  res.json({
    success: true,
    total: attackLog.length,
    attacks: attackLog.slice(parseInt(offset), parseInt(offset) + parseInt(limit))
  });
});

// POST: Manually block IP
router.post('/block', (req, res) => {
  const { ip, reason = 'Manual block' } = req.body;

  if (!ip) {
    return res.status(400).json({ error: 'IP address required' });
  }

  blockedIPs.add(ip);

  attackLog.unshift({
    id: crypto.randomUUID(),
    ip,
    endpoint: 'N/A',
    method: 'BLOCK',
    requests: 0,
    timestamp: new Date().toISOString(),
    status: 'manual_block',
    userAgent: reason,
    country: 'N/A'
  });

  console.log(`🚫 [Manual Block] Added ${ip} to blocklist: ${reason}`);

  res.json({ success: true, message: `IP ${ip} blocked`, blockedIPs: Array.from(blockedIPs) });
});

// DELETE: Unblock IP
router.delete('/block/:ip', (req, res) => {
  const { ip } = req.params;

  if (!blockedIPs.has(ip)) {
    return res.status(404).json({ error: 'IP not found in blocklist' });
  }

  blockedIPs.delete(ip);
  rateLimitStore.delete(ip);

  console.log(`✅ [Unblock] Removed ${ip} from blocklist`);

  res.json({ success: true, message: `IP ${ip} unblocked`, blockedIPs: Array.from(blockedIPs) });
});

// GET: Real-time request patterns (last 5 minutes)
router.get('/patterns', (req, res) => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  const recentPatterns = Array.from(rateLimitStore.entries())
    .filter(([ip, record]) => record.firstRequest > fiveMinutesAgo)
    .map(([ip, record]) => ({
      ip,
      requests: record.count,
      rps: (record.count / ((now - record.firstRequest) / 1000)).toFixed(2),
      status: record.blocked ? 'blocked' : record.count > MAX_REQUESTS * 0.8 ? 'warning' : 'normal'
    }))
    .sort((a, b) => parseFloat(b.rps) - parseFloat(a.rps));

  // Aggregate by endpoint
  const endpointStats = {};
  attackLog.filter(a => new Date(a.timestamp) > new Date(fiveMinutesAgo)).forEach(attack => {
    if (!endpointStats[attack.endpoint]) {
      endpointStats[attack.endpoint] = { requests: 0, attacks: 0 };
    }
    endpointStats[attack.endpoint].requests += attack.requests;
    endpointStats[attack.endpoint].attacks++;
  });

  res.json({
    success: true,
    patterns: recentPatterns.slice(0, 20),
    endpointStats,
    timeWindow: '5m'
  });
});

export default router;
export { rateLimitMiddleware };
