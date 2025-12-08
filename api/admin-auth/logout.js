export default async function handler(_req, res) {
    // Expire cookie immediately
    const cookie = `np_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}`;
    res.setHeader('Set-Cookie', cookie);
    res.status(302).setHeader('Location', '/auth');
    res.end();
}
