import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccess(userId) {
  return jwt.sign({ sub: userId }, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpires });
}
export function signRefresh(userId) {
  return jwt.sign({ sub: userId }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires });
}
export function verifyRefresh(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}
