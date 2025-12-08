// Returns the configured backend origin for client-side warm-up pings.
export default function handler(_req, res) {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    const origin = (process.env.ADMIN_BACKEND_URL || '').replace(/\/$/, '');
    if (!origin) {
        return res.status(200).json({ success: true, origin: null, message: 'ADMIN_BACKEND_URL not set' });
    }
    return res.status(200).json({ success: true, origin });
}
