import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PublicSiteSettingsSchema, DEFAULT_PUBLIC_SITE_SETTINGS } from '../../src/types/publicSiteSettings';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  // Serve the published public-site settings bundle from the backend if present, else fallback to defaults.
  try {
    const base = process.env.ADMIN_BACKEND_URL?.replace(/\/$/, '');
    let raw: any = null;
    if (base) {
      // IMPORTANT:
      // Public site settings must be readable without admin auth.
      // The backend's public endpoint should return the published settings.
      const url = `${base}/api/public/settings`;
      const upstream = await fetch(url, { method: 'GET' });
      if (upstream.ok) {
        try {
          raw = await upstream.json();
        } catch {
          raw = null;
        }
      }
    }

    const envelope = raw && typeof raw === 'object' && raw.settings ? raw.settings : raw;
    // Tolerate both shapes:
    // - backend public endpoint: returns settings object directly
    // - admin bundle envelope: { published, draft, version, updatedAt }
    const picked = (() => {
      if (!envelope || typeof envelope !== 'object') return {};
      const anyEnv: any = envelope as any;
      if (anyEnv.published || anyEnv.draft) return anyEnv.published ?? anyEnv.draft ?? {};
      return anyEnv;
    })();

    const parsed = PublicSiteSettingsSchema.safeParse(picked);
    const data = parsed.success ? parsed.data : DEFAULT_PUBLIC_SITE_SETTINGS;

    return res.status(200).json({
      ...DEFAULT_PUBLIC_SITE_SETTINGS,
      ...data,
      version: typeof (envelope as any)?.version === 'number' ? (envelope as any).version : undefined,
      updatedAt: typeof (envelope as any)?.updatedAt === 'string' ? (envelope as any).updatedAt : undefined,
    });
  } catch {
    return res.status(200).json({ ...DEFAULT_PUBLIC_SITE_SETTINGS });
  }
}
