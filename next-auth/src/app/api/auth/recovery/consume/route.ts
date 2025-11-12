import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recoveryConsumeSchema } from '@/lib/validation';
import { decodeMfaTicket, clearMfaTicket, signAccess, signRefresh, setAuthCookies } from '@/lib/auth/tokens';
import { verifyAndConsume } from '@/lib/auth/recovery';
import { redisRateLimit } from '@/lib/security/redisRateLimit';

export async function POST(req: Request) {
	const ip = (req.headers.get('x-forwarded-for')||'').split(',')[0]||'local';
	const rl = await redisRateLimit(`recovery_consume:${ip}`);
	if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
	const cookieHeader = req.headers.get('cookie') || '';
	const { ticket } = decodeMfaTicket(cookieHeader);
	if (!ticket || ticket.purpose !== 'mfa') return NextResponse.json({ error: 'Invalid MFA ticket' }, { status: 400 });
	const body = await req.json();
	const { code } = recoveryConsumeSchema.parse(body);
	const mfa = await prisma.mfa.findUnique({ where: { userId: ticket.sub } });
	if (!mfa || !Array.isArray(mfa.recoveryCodes)) return NextResponse.json({ error: 'No recovery available' }, { status: 400 });
	const { ok, index } = await verifyAndConsume(code, mfa.recoveryCodes as unknown as string[]);
	if (!ok || index < 0) return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
	const newCodes = [...(mfa.recoveryCodes as unknown as string[])];
	newCodes.splice(index, 1);
	await prisma.mfa.update({ where: { userId: ticket.sub }, data: { recoveryCodes: newCodes } });
	clearMfaTicket();
	const user = await prisma.user.findUnique({ where: { id: ticket.sub } });
	if (!user) return NextResponse.json({ error: 'User missing' }, { status: 404 });
	const access = signAccess({ sub: user.id, role: user.role });
	const refresh = signRefresh({ sub: user.id, role: user.role });
	setAuthCookies({ access, refresh });
	await prisma.auditLog.create({ data: { userId: user.id, type: 'MFA_VERIFY', meta: { via: 'recovery' } } });
	const redirect = ['FOUNDER','ADMIN'].includes(user.role) ? '/owner' : '/console';
	return NextResponse.json({ ok: true, redirect });
}
