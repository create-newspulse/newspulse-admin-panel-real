import { decodeAccessFromCookies } from './tokens';
import { headers } from 'next/headers';

export function currentUser() {
  const cookieHeader = headers().get('cookie') || '';
  return decodeAccessFromCookies(cookieHeader).user;
}
export function roleAllowsOwner(role: string) {
  return ['FOUNDER','ADMIN'].includes(role);
}
export function roleAllowsEmployee(role: string) {
  return ['FOUNDER','ADMIN','EDITOR','REPORTER','COPY','MODERATOR','ANALYST','INTERN'].includes(role);
}
export function requireOwner() {
  const user = currentUser();
  if (!user || !roleAllowsOwner(user.role)) throw new Error('UNAUTHORIZED');
  return user;
}
export function requireEmployee() {
  const user = currentUser();
  if (!user || !roleAllowsEmployee(user.role)) throw new Error('UNAUTHORIZED');
  return user;
}
