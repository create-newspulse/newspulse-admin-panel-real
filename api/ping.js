// Simple debug function to verify serverless deployment.
// GET /api/ping should return JSON when functions are included.
export default function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, method: req.method, error: 'Method not allowed' });
  return res.status(200).json({ ok: true, ts: new Date().toISOString(), host: req.headers.host, url: req.url });
}
