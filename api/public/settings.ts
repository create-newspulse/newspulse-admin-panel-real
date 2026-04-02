import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PublicSiteSettingsSchema, DEFAULT_PUBLIC_SITE_SETTINGS } from '../../src/types/publicSiteSettings';

function mergeDefaults(value: any) {
  return {
    ...DEFAULT_PUBLIC_SITE_SETTINGS,
    ...(value || {}),
    homepage: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.homepage,
      ...(value?.homepage || {}),
      modules: {
        ...DEFAULT_PUBLIC_SITE_SETTINGS.homepage.modules,
        ...(value?.homepage?.modules || {}),
      },
    },
    tickers: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.tickers,
      ...(value?.tickers || {}),
      breaking: {
        ...DEFAULT_PUBLIC_SITE_SETTINGS.tickers.breaking,
        ...(value?.tickers?.breaking || {}),
      },
      live: {
        ...DEFAULT_PUBLIC_SITE_SETTINGS.tickers.live,
        ...(value?.tickers?.live || {}),
      },
    },
    liveTv: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.liveTv,
      ...(value?.liveTv || {}),
    },
    inspirationHub: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub,
      ...(value?.inspirationHub || {}),
      localizedContent: {
        ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent,
        ...(value?.inspirationHub?.localizedContent || {}),
        sectionTitle: {
          ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent.sectionTitle,
          ...(value?.inspirationHub?.localizedContent?.sectionTitle || {}),
        },
        sectionSubtitle: {
          ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent.sectionSubtitle,
          ...(value?.inspirationHub?.localizedContent?.sectionSubtitle || {}),
        },
        droneTvTitle: {
          ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent.droneTvTitle,
          ...(value?.inspirationHub?.localizedContent?.droneTvTitle || {}),
        },
        droneTvSubtitle: {
          ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent.droneTvSubtitle,
          ...(value?.inspirationHub?.localizedContent?.droneTvSubtitle || {}),
        },
        dailyWondersHeading: {
          ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent.dailyWondersHeading,
          ...(value?.inspirationHub?.localizedContent?.dailyWondersHeading || {}),
        },
        quoteText: {
          ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent.quoteText,
          ...(value?.inspirationHub?.localizedContent?.quoteText || {}),
        },
        cardText: {
          ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent.cardText,
          ...(value?.inspirationHub?.localizedContent?.cardText || {}),
        },
        narrationText: {
          ...DEFAULT_PUBLIC_SITE_SETTINGS.inspirationHub.localizedContent.narrationText,
          ...(value?.inspirationHub?.localizedContent?.narrationText || {}),
        },
      },
    },
    languageTheme: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.languageTheme,
      ...(value?.languageTheme || {}),
    },
  };
}

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
    const data = parsed.success ? mergeDefaults(parsed.data) : DEFAULT_PUBLIC_SITE_SETTINGS;

    return res.status(200).json({
      ...data,
      version: typeof (envelope as any)?.version === 'number' ? (envelope as any).version : undefined,
      updatedAt: typeof (envelope as any)?.updatedAt === 'string' ? (envelope as any).updatedAt : undefined,
    });
  } catch {
    return res.status(200).json({ ...DEFAULT_PUBLIC_SITE_SETTINGS });
  }
}
