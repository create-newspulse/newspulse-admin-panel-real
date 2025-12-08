import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resetPasswordSchema } from '@/lib/validation';
import { markPasswordResetUsed, verifyPasswordReset } from '@/lib/auth/passwordReset';
import { redisRateLimit } from '@/lib/security/redisRateLimit';
import { hash as argonHash } from 'argon2';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'local';
  const lim = await redisRateLimit(`reset:${ip}`);
  if (!lim.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await req.json().catch(()=>({}));
  const { rid, token, password } = resetPasswordSchema.parse(body);

  const check = await verifyPasswordReset(rid, token);
  if (!check.ok) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });

  const rec = check.rec;
  const user = await prisma.user.findUnique({ where: { id: rec.userId } });
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'User not eligible' }, { status: 400 });

  const passwordHash = await argonHash(password, { type: 2 }); // argon2id
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await markPasswordResetUsed(rec.id);

  // Optionally revoke existing sessions for safety
  try {
    await prisma.session.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });
  } catch {}

  await prisma.auditLog.create({ data: { userId: user.id, type: 'PASSWORD_RESET', ip, ua: req.headers.get('user-agent') || '', meta: { action: 'completed' } } });

  return NextResponse.json({ ok: true });
}