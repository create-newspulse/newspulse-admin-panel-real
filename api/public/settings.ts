import type { VercelRequest, VercelResponse } from '@vercel/node';
import { defaultSiteSettings, SiteSettingsSchema } from '../../src/types/siteSettings';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  // Attempt to read admin settings via backend if present, else fallback to defaults
  try {
    const base = process.env.ADMIN_BACKEND_URL?.replace(/\/$/, '');
    let raw: any = null;
    if (base) {
      const url = `${base}/api/admin/settings`;
      const upstream = await fetch(url, { method: 'GET' });
      if (upstream.ok) {
        try { raw = await upstream.json(); } catch { raw = null; }
      }
    }
    const parsed = SiteSettingsSchema.safeParse(raw ?? {});
    const s = parsed.success ? parsed.data : defaultSiteSettings;
    const safe = { ui: s.ui, navigation: s.navigation, voice: s.voice };
    return res.status(200).json(safe);
  } catch {
    const s = defaultSiteSettings;
    const safe = { ui: s.ui, navigation: s.navigation, voice: s.voice };
    return res.status(200).json(safe);
  }
}
