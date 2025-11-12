import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { decodeAccessFromCookies } from '@/lib/auth/tokens';

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const { user } = decodeAccessFromCookies(cookieHeader);
  if (user) {
    await prisma.auditLog.create({ data: { userId: user.sub, type: 'LOGOUT', ua: req.headers.get('user-agent') || '', ip: (req.headers.get('x-forwarded-for')||'').split(',')[0] } });
  }
  clearAuthCookies();
  // ✅ Fixed: logout now clears session and routes to /login instead of missing /auth.
  return NextResponse.json({ ok: true, redirect: '/login' });
}
