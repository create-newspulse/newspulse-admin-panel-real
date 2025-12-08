import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const feedUrl = req.query.feed as string;

  if (!feedUrl) {
    return res.status(400).json({ error: 'Missing feed URL' });
  }

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error('Feed fetch failed');

    const xml = await response.text();
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err: any) {
    console.error('❌ Proxy Error:', err.message);
    res.status(500).json({ error: 'RSS fetch failed' });
  }
}
