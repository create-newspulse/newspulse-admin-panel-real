import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFounder } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireFounder(req, res);
  if (!ctx) return; // response already sent

  // Mock summary data
  const now = new Date();
  return res.status(200).json({
    ok: true,
    updatedAt: now.toISOString(),
    systems: {
      system: 'online',
      ai: 'active',
      backup: 'ok',
      security: 'shielded',
    },
  });
}
