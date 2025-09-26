import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

export const requireAuth = async (req, res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, error: { message: 'No token' } });
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    req.user = await User.findById(decoded.sub).lean();
    if (!req.user) return res.status(401).json({ success: false, error: { message: 'User not found' } });
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: { message: 'Invalid/expired token' } });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }
  next();
};
