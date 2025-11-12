import { NextResponse } from 'next/server';
import { decodeRefreshFromCookies, signAccess, signRefresh, setAuthCookies } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const { token } = decodeRefreshFromCookies(cookieHeader);
  if (!token) return NextResponse.json({ error: 'No refresh' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: token.sub } });
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'User invalid' }, { status: 401 });
  const access = signAccess({ sub: user.id, role: user.role });
  const refresh = signRefresh({ sub: user.id, role: user.role });
  setAuthCookies({ access, refresh });
  return NextResponse.json({ ok: true });
}