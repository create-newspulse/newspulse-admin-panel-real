import { SignJWT } from 'jose';
export default async function handler(req, res) {
    try {
        if (req.method !== 'POST')
            return res.status(405).json({ error: 'Method not allowed' });
        const { email } = req.body || {};
        if (!email || typeof email !== 'string')
            return res.status(400).json({ error: 'Email required' });
        const allowed = (process.env.ADMIN_ALLOWED_EMAILS || '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
        if (allowed.length && !allowed.includes(email.toLowerCase())) {
            return res.status(403).json({ error: 'Email not allowed' });
        }
        const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret');
        const token = await new SignJWT({ action: 'admin-login', email })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer('newspulse')
            .setAudience('admin')
            .setExpirationTime('10m')
            .setIssuedAt()
            .sign(secret);
        const origin = process.env.ADMIN_SITE_ORIGIN || (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}` : `https://${req.headers.host}`);
        const link = `${origin}/api/admin-auth/verify?token=${encodeURIComponent(token)}`;
        // In production you would email the link. For now we return it to the caller.
        return res.status(200).json({ ok: true, link });
    }
    catch (err) {
        console.error('admin-auth/start error:', err);
        return res.status(500).json({ error: 'Auth start failed' });
    }
}
