import { NextResponse } from 'next/server';
import { decodeAccessFromCookies } from '@/lib/auth/tokens';

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const { user } = decodeAccessFromCookies(cookieHeader);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { id: user.sub, role: user.role } });
}
