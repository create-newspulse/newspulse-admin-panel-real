import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { currentUser, roleAllowsOwner } from '@/lib/auth/guards';
import { authenticator } from 'otplib';

export async function POST(req: Request) {
  const userJwt = currentUser();
  if (!userJwt || !roleAllowsOwner(userJwt.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userJwt.sub } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const secret = authenticator.generateSecret();
  const issuer = process.env.WEBAUTHN_RP_NAME || 'NewsPulse';
  const label = `${issuer}:${user.email}`;
  const otpauth = authenticator.keyuri(user.email, issuer, secret);

  await prisma.mfa.upsert({
    where: { userId: user.id },
    create: { userId: user.id, totpSecret: secret, enabled: false, recoveryCodes: [] },
    update: { totpSecret: secret },
  });
  await prisma.auditLog.create({ data: { userId: user.id, type: 'MFA_SETUP' } });
  return NextResponse.json({ secret, otpauth, label });
}