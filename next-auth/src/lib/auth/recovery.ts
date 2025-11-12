import crypto from 'crypto';
import { hash, verify } from 'argon2';

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i=0;i<count;i++) {
    const raw = crypto.randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
    codes.push(raw);
  }
  return codes;
}

export async function hashCodes(codes: string[]) {
  const hashes: string[] = [];
  for (const c of codes) hashes.push(await hash(c));
  return hashes;
}

export async function verifyAndConsume(code: string, hashes: string[]): Promise<{ ok: boolean; index: number }>{
  for (let i=0;i<hashes.length;i++) {
    const ok = await verify(hashes[i], code).catch(()=>false);
    if (ok) return { ok: true, index: i };
  }
  return { ok: false, index: -1 };
}