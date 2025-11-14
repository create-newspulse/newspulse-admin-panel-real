// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;

  if (!token) {
    // Dev convenience: allow bypass when explicitly enabled
    if (process.env.DEV_AUTH_BYPASS === '1') {
      req.user = { sub: 'dev-user', email: 'dev@localhost', role: 'founder' };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'newspulse-secret');
    req.user = payload; // { sub, email, role, ... }
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
