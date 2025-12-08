import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decodeMfaTicket, setMfaTicket, signMfaTicket } from '@/lib/auth/tokens';
import { genCode, setOtp } from '@/lib/security/emailOtp/store';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

// In real deployment, replace with actual mail transport.
async function sendDevEmail(to: string, subject: string, html: string) {
  console.log('[DEV EMAIL OTP]', { to, subject, preview: html.slice(0, 200) });
}

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
  const rl = await redisRateLimit(`mfa_email_req:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const cookieHeader = req.headers.get('cookie') || '';
  const { ticket } = decodeMfaTicket(cookieHeader);
  if (!ticket || ticket.purpose !== 'mfa') {
    return NextResponse.json({ error: 'Invalid MFA ticket' }, { status: 400 });
  }
  // Rotate the ticket to email method to prevent method confusion.
  const newTicket = signMfaTicket({ sub: ticket.sub, purpose: 'mfa', method: 'email' });
  setMfaTicket(newTicket);

  const user = await prisma.user.findUnique({ where: { id: ticket.sub } });
  if (!user) return NextResponse.json({ error: 'User missing' }, { status: 404 });

  const code = genCode();
  await setOtp(user.id, code);
  const appName = process.env.APP_NAME || 'News Pulse';
  await sendDevEmail(user.email, `${appName} sign-in code`, `<p>Your ${appName} sign-in code is: <b>${code}</b> (valid for 5 minutes)</p>`);

  return NextResponse.json({ ok: true, message: 'Code sent' });
}
