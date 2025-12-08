import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { forgotPasswordSchema } from '@/lib/validation';
import { createPasswordReset } from '@/lib/auth/passwordReset';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

// In real deployment, replace sendDevEmail with actual mail transport.
async function sendDevEmail(to: string, subject: string, html: string) {
  console.log('[DEV EMAIL]', { to, subject, preview: html.slice(0,200) });
}

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'local';
  const lim = await redisRateLimit(`forgot:${ip}`);
  if (!lim.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await req.json().catch(()=>({}));
  const { email } = forgotPasswordSchema.parse(body);
  const user = await prisma.user.findUnique({ where: { email } });
  // Don't reveal whether user exists
  if (!user) return NextResponse.json({ ok: true });
  const { record, token } = await createPasswordReset(user.id);
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset?rid=${record.id}&token=${encodeURIComponent(token)}`;
  await sendDevEmail(email, 'Reset your NewsPulse password', `<p>Reset link (dev only): <a href='${resetUrl}'>${resetUrl}</a></p>`);
  await prisma.auditLog.create({ data: { userId: user.id, type: 'PASSWORD_RESET', ip, ua: req.headers.get('user-agent') || '', meta: { action: 'requested' } } });
  return NextResponse.json({ ok: true });
}