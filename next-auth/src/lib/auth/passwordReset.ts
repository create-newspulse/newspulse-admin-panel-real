import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { hash, verify } from 'argon2';

export function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export async function createPasswordReset(userId: string, ttlMinutes = 30) {
  const token = generateResetToken();
  const tokenHash = await hash(token); // argon2id default
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const rec = await prisma.passwordReset.create({ data: { userId, tokenHash, expiresAt, used: false } });
  return { record: rec, token };
}

export async function verifyPasswordReset(id: string, token: string) {
  const rec = await prisma.passwordReset.findUnique({ where: { id } });
  if (!rec) return { ok: false, reason: 'not_found' } as const;
  if (rec.used) return { ok: false, reason: 'used' } as const;
  if (rec.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' } as const;
  const match = await verify(rec.tokenHash, token).catch(()=>false);
  if (!match) return { ok: false, reason: 'invalid' } as const;
  return { ok: true, rec } as const;
}

export async function markPasswordResetUsed(id: string) {
  await prisma.passwordReset.update({ where: { id }, data: { used: true } });
}