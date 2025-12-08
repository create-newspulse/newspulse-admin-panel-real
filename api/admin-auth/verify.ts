import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify, SignJWT } from 'jose';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).send('Missing token');

    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret');

    const { payload } = await jwtVerify(token, secret, { audience: 'admin', issuer: 'newspulse' });
    if (payload.action !== 'admin-login') return res.status(400).send('Invalid token');

    // Issue a session token valid for 1 day
    const session = await new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('newspulse')
      .setAudience('admin')
      .setExpirationTime('1d')
      .setIssuedAt()
      .sign(secret);

    // Build robust cookie attributes for custom domain
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const isProd = process.env.NODE_ENV === 'production';
    const attrs = [
      `np_admin=${session}`,
      'Path=/',
      'HttpOnly',
      // Lax is friendlier to redirect-based logins than Strict
      'SameSite=Lax',
      'Max-Age=86400',
    ];
    if (isProd) attrs.push('Secure');
    if (host && host.includes('.')) attrs.push(`Domain=${host}`);
    res.setHeader('Set-Cookie', attrs.join('; '));
    res.setHeader('Cache-Control', 'no-store');

    const redirectTo = '/';
    res.status(302).setHeader('Location', redirectTo);
    return res.end();
  } catch (err) {
    console.error('admin-auth/verify error:', err);
    return res.status(400).send('Invalid or expired token');
  }
}
