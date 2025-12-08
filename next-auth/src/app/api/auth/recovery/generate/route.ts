import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { generateRecoveryCodes, hashCodes } from '@/lib/auth/recovery';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
  const rl = await redisRateLimit(`recovery_generate:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  try {
    const user = requireOwner();
    const codes = generateRecoveryCodes(10);
    const hashes = await hashCodes(codes);
    await prisma.mfa.upsert({
      where: { userId: user.sub },
      create: { userId: user.sub, enabled: true, recoveryCodes: hashes },
      update: { recoveryCodes: hashes, enabled: true },
    });
    await prisma.auditLog.create({ data: { userId: user.sub, type: 'MFA_SETUP', meta: { recovery: true } } });
    return NextResponse.json({ codes });
  } catch (e:any) {
    const msg = e?.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Server error';
    const code = msg === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}