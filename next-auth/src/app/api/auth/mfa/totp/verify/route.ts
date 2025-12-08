import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { totpVerifySchema } from '@/lib/validation';
import { decodeMfaTicket, clearMfaTicket, signAccess, signRefresh, setAuthCookies } from '@/lib/auth/tokens';
import { authenticator } from 'otplib';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
  const rl = await redisRateLimit(`totp_verify:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  const cookieHeader = req.headers.get('cookie') || '';
  const { ticket } = decodeMfaTicket(cookieHeader);
  if (!ticket || ticket.purpose !== 'mfa' || ticket.method !== 'totp') {
    return NextResponse.json({ error: 'Invalid MFA ticket' }, { status: 400 });
  }
  const body = await req.json();
  const { code } = totpVerifySchema.parse(body);
  const mfa = await prisma.mfa.findUnique({ where: { userId: ticket.sub } });
  if (!mfa || !mfa.totpSecret || !mfa.enabled) {
    return NextResponse.json({ error: 'MFA not enabled' }, { status: 400 });
  }
  const ok = authenticator.verify({ token: code, secret: mfa.totpSecret });
  if (!ok) return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
  // success: clear ticket, issue auth cookies
  clearMfaTicket();
  const user = await prisma.user.findUnique({ where: { id: ticket.sub } });
  if (!user) return NextResponse.json({ error: 'User missing' }, { status: 404 });
  const access = signAccess({ sub: user.id, role: user.role });
  const refresh = signRefresh({ sub: user.id, role: user.role });
  setAuthCookies({ access, refresh });
  await prisma.auditLog.create({ data: { userId: user.id, type: 'MFA_VERIFY', ua: req.headers.get('user-agent')||'', ip: (req.headers.get('x-forwarded-for')||'').split(',')[0] } });
  const redirect = ['FOUNDER','ADMIN'].includes(user.role) ? '/owner' : '/console';
  return NextResponse.json({ ok: true, redirect });
}