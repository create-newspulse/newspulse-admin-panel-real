export default function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  return res.status(200).json({ ok: true, msg: 'hello function deployed', ts: Date.now() });
}
