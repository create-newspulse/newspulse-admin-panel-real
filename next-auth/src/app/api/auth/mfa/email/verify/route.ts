import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailOtpVerifySchema } from '@/lib/validation';
import { decodeMfaTicket, clearMfaTicket, signAccess, signRefresh, setAuthCookies } from '@/lib/auth/tokens';
import { verifyAndConsumeOtp } from '@/lib/security/emailOtp/store';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
  const rl = await redisRateLimit(`mfa_email_verify:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const cookieHeader = req.headers.get('cookie') || '';
  const { ticket } = decodeMfaTicket(cookieHeader);
  if (!ticket || ticket.purpose !== 'mfa' || ticket.method !== 'email') {
    return NextResponse.json({ error: 'Invalid MFA ticket' }, { status: 400 });
  }
  const body = await req.json();
  const { code } = emailOtpVerifySchema.parse(body);

  const ok = await verifyAndConsumeOtp(ticket.sub, code);
  if (!ok) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });

  clearMfaTicket();
  const user = await prisma.user.findUnique({ where: { id: ticket.sub } });
  if (!user) return NextResponse.json({ error: 'User missing' }, { status: 404 });
  const access = signAccess({ sub: user.id, role: user.role });
  const refresh = signRefresh({ sub: user.id, role: user.role });
  setAuthCookies({ access, refresh });
  await prisma.auditLog.create({ data: { userId: user.id, type: 'MFA_VERIFY', ua: req.headers.get('user-agent')||'', ip: (req.headers.get('x-forwarded-for')||'').split(',')[0], meta: { method: 'email' } } });
  const redirect = ['FOUNDER','ADMIN'].includes(user.role) ? '/owner' : '/console';
  return NextResponse.json({ ok: true, redirect });
}
