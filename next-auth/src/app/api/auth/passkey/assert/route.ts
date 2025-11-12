import { NextResponse } from 'next/server';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '@/lib/db';
import { kvSet, kvGet, kvDel } from '@/lib/security/kv';
import { signAccess, signRefresh, setAuthCookies, signMfaTicket, setMfaTicket, clearMfaTicket } from '@/lib/auth/tokens';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

const RP_ID = process.env.AUTH_COOKIE_DOMAIN || 'localhost';
const ORIGIN = process.env.APP_URL || 'http://localhost:3000';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
  const rl = await redisRateLimit(`passkey_assert:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  const { email } = await req.json() as { email?: string };
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const mfa = await prisma.mfa.findUnique({ where: { userId: user.id } });
  const passkeys = Array.isArray((mfa?.passkeys as any)) ? (mfa!.passkeys as any) : [];
  if (!passkeys.length) return NextResponse.json({ error: 'No passkeys registered' }, { status: 400 });
  const allowCreds = passkeys.map((p: any) => ({ id: Buffer.from(p.credentialId, 'base64url'), type: 'public-key' as const }));
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: allowCreds,
    timeout: 60000,
    userVerification: 'preferred',
  });
  await kvSet(`webauthn:assert:${user.id}`, { challenge: options.challenge, uid: user.id }, 5 * 60 * 1000);
  // also set an MFA ticket for final issuance if owner lane uses passkey
  const ticket = signMfaTicket({ sub: user.id, purpose: 'mfa', method: 'passkey' });
  setMfaTicket(ticket);
  return NextResponse.json(options);
}

export async function PUT(req: Request) {
  const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
  const rl = await redisRateLimit(`passkey_assert_verify:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  const body = await req.json() as AuthenticationResponseJSON & { email?: string };
  const { email } = body;
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const mfa = await prisma.mfa.findUnique({ where: { userId: user.id } });
  const passkeys = Array.isArray((mfa?.passkeys as any)) ? (mfa!.passkeys as any) : [];
  const store = await kvGet<{ challenge: string, uid: string }>(`webauthn:assert:${user.id}`);
  if (!store) return NextResponse.json({ error: 'No challenge' }, { status: 400 });
  const credId = Buffer.from((body as any).rawId, 'base64url').toString('base64url');
  const rec = passkeys.find((p:any) => p.credentialId === credId);
  if (!rec) return NextResponse.json({ error: 'No matching credential' }, { status: 400 });
  const authenticator = {
    credentialID: Buffer.from(rec.credentialId, 'base64url'),
    credentialPublicKey: Buffer.from(rec.publicKey, 'base64url'),
    counter: rec.counter,
    transports: (body as any).response?.transports || [],
  } as any;
  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: store.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    authenticator,
  }).catch(()=>({ verified: false } as any));
  if (!verification.verified || !verification.authenticationInfo) return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  await kvDel(`webauthn:assert:${user.id}`);
  const { newCounter, credentialID } = verification.authenticationInfo;
  // update counter
  const cid = Buffer.from(credentialID).toString('base64url');
  const idx = passkeys.findIndex((p:any)=>p.credentialId===cid);
  if (idx>=0) passkeys[idx].counter = newCounter;
  await prisma.mfa.update({ where: { userId: user.id }, data: { passkeys } });
  // complete session
  clearMfaTicket();
  const access = signAccess({ sub: user.id, role: user.role });
  const refresh = signRefresh({ sub: user.id, role: user.role });
  setAuthCookies({ access, refresh });
  await prisma.auditLog.create({ data: { userId: user.id, type: 'MFA_VERIFY', meta: { via: 'passkey' } } });
  const redirect = ['FOUNDER','ADMIN'].includes(user.role) ? '/owner' : '/console';
  return NextResponse.json({ ok: true, redirect });
}