import { z } from 'zod';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { signAccess, signRefresh, verifyRefresh } from '../services/auth.service.js';

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(5),
  })
});

export const login = [
  (req, res, next) => next(), // placeholder for validate middleware compatibility
  asyncHandler(async (req, res) => {}) // replaced by route-level validate
];

export const loginHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, isActive: true });
  if (!user || !(await user.checkPassword(password))) {
    return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
  }
  return res.json(ok({
    accessToken: signAccess(user._id.toString()),
    refreshToken: signRefresh(user._id.toString()),
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  }));
});

export const refreshHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ success: false, error: { message: 'Missing refreshToken' } });
  const { sub } = verifyRefresh(refreshToken);
  return res.json(ok({ accessToken: signAccess(sub) }));
});

export const meHandler = asyncHandler(async (req, res) => {
  const { _id, name, email, role } = req.user;
  res.json(ok({ id: _id, name, email, role }));
});

export const schemas = { loginSchema };
