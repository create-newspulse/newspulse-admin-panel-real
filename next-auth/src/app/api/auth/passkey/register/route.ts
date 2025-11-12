import { NextResponse } from 'next/server';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '@/lib/db';
import { currentUser, roleAllowsOwner } from '@/lib/auth/guards';
import { kvSet, kvGet, kvDel } from '@/lib/security/kv';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

const RP_ID = process.env.AUTH_COOKIE_DOMAIN || 'localhost';
const ORIGIN = process.env.APP_URL || 'http://localhost:3000';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
  const rl = await redisRateLimit(`passkey_reg:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const userJwt = currentUser();
  if (!userJwt || !roleAllowsOwner(userJwt.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userJwt.sub } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const options = await generateRegistrationOptions({
    rpName: 'NewsPulse',
    rpID: RP_ID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    timeout: 60000,
    attestationType: 'none',
    excludeCredentials: [],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await kvSet(`webauthn:reg:${user.id}`, { challenge: options.challenge }, 5 * 60 * 1000);
  return NextResponse.json(options);
}

export async function PUT(req: Request) {
  // Treat PUT as verify
  const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
  const rl = await redisRateLimit(`passkey_reg_verify:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  const userJwt = currentUser();
  if (!userJwt || !roleAllowsOwner(userJwt.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as RegistrationResponseJSON;
  const store = await kvGet<{ challenge: string }>(`webauthn:reg:${userJwt.sub}`);
  if (!store) return NextResponse.json({ error: 'No challenge' }, { status: 400 });
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: store.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  }).catch(()=>({ verified: false } as any));
  if (!verification.verified || !verification.registrationInfo) return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  await kvDel(`webauthn:reg:${userJwt.sub}`);
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  // store into Mfa.passkeys[]
  const record = {
    credentialId: Buffer.from(credentialID).toString('base64url'),
    publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
    counter,
  };
  const existing = await prisma.mfa.findUnique({ where: { userId: userJwt.sub } });
  const passkeys = Array.isArray((existing?.passkeys as any)) ? (existing!.passkeys as any) : [];
  passkeys.push(record);
  await prisma.mfa.upsert({
    where: { userId: userJwt.sub },
    create: { userId: userJwt.sub, enabled: true, passkeys, recoveryCodes: [] },
    update: { passkeys, enabled: true },
  });
  await prisma.auditLog.create({ data: { userId: userJwt.sub, type: 'PASSKEY_REGISTER' } });
  return NextResponse.json({ ok: true });
}