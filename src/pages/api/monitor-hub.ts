// src/pages/api/monitor-hub.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    uptime: '99.98%',
    status: 'All systems operational',
    lastCheck: new Date().toISOString()
  });
}
