// ✅ Correct file path: pages/api/live-session.ts
import type { NextApiRequest, NextApiResponse } from 'next';

interface LiveSessionResponse {
  success: boolean;
  currentFeed: string;
  session: string;
  speaker: {
    name: string;
    position: string;
  };
}

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<LiveSessionResponse>
) {
  res.status(200).json({
    success: true,
    currentFeed: 'sansad_tv',
    session: 'Parliament Session Live: Lok Sabha',
    speaker: {
      name: 'Shri Om Birla',
      position: 'Speaker of Lok Sabha',
    },
  });
}
