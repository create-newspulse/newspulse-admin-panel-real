import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/validation';
import { verify as argonVerify } from 'argon2';
import { signAccess, signRefresh, setAuthCookies, signMfaTicket, setMfaTicket } from '@/lib/auth/tokens';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'local';
  const lim = await redisRateLimit(`login:${ip}`);
  if (!lim.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const body = await req.json();
  const { email, password, lane } = loginSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'Account disabled' }, { status: 403 });

  const ok = await argonVerify(user.passwordHash, password).catch(() => false);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const isOwnerRole = ['FOUNDER','ADMIN'].includes(user.role);
  if (lane === 'owner' && isOwnerRole) {
    // If owner and MFA enabled, require MFA step
    const mfa = await prisma.mfa.findUnique({ where: { userId: user.id } });
    if (mfa?.enabled) {
      // Prefer passkey if registered, else TOTP
      if (Array.isArray((mfa.passkeys as any) || []) && (mfa.passkeys as any).length) {
        const ticket = signMfaTicket({ sub: user.id, purpose: 'mfa', method: 'passkey' });
        setMfaTicket(ticket);
        return NextResponse.json({ mfaRequired: { type: 'passkey' } });
      }
      if (mfa.totpSecret) {
        const ticket = signMfaTicket({ sub: user.id, purpose: 'mfa', method: 'totp' });
        setMfaTicket(ticket);
        return NextResponse.json({ mfaRequired: { type: 'totp' } });
      }
    }
  }

  const access = signAccess({ sub: user.id, role: user.role });
  const refresh = signRefresh({ sub: user.id, role: user.role });
  setAuthCookies({ access, refresh });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0 } });
  await prisma.auditLog.create({ data: { userId: user.id, type: 'LOGIN', ua: req.headers.get('user-agent') || '', ip } });

  const next = new URL(req.url).searchParams.get('next');
  const redirect = next || (isOwnerRole ? '/owner' : '/console');
  return NextResponse.json({ user: { id: user.id, role: user.role }, redirect });
}
