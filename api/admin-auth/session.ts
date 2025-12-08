import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

function parseCookies(header?: string) {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    out[k] = decodeURIComponent(rest.join('='));
  });
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['np_admin'];
    if (!token) return res.status(401).json({ authenticated: false });

    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret');
    const { payload } = await jwtVerify(token, secret, { audience: 'admin', issuer: 'newspulse' });
    return res.status(200).json({ authenticated: true, email: payload.email });
  } catch (err) {
    return res.status(401).json({ authenticated: false });
  }
}
