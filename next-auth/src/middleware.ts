import { NextResponse } from 'next/server';
import { decodeAccessFromCookies } from './lib/auth/tokens';

export function middleware(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname;
  const { user } = decodeAccessFromCookies(req.headers.get('cookie') || '');

  const redirectToAuth = () => NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, url));

  const isOwnerZone = path.startsWith('/owner');
  const isEmployeeZone = path.startsWith('/console');

  if (isOwnerZone) {
    if (!user || !['FOUNDER','ADMIN'].includes(user.role)) return redirectToAuth();
  }
  if (isEmployeeZone) {
    const ok = user && ['FOUNDER','ADMIN','EDITOR','REPORTER','COPY','MODERATOR','ANALYST','INTERN'].includes(user.role);
    if (!ok) return redirectToAuth();
  }
  return NextResponse.next();
}

export const config = { matcher: ['/owner/:path*','/console/:path*'] };
