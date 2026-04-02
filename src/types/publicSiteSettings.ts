import { z } from 'zod';

const SUPPORTED_INSPIRATION_LANGUAGES = ['en', 'hi', 'gu'] as const;

const LocalizedTextSchema = z
  .object({
    en: z.string().default(''),
    hi: z.string().default(''),
    gu: z.string().default(''),
  })
  .passthrough();

const InspirationHubLocalizedContentSchema = z
  .object({
    sectionTitle: LocalizedTextSchema.default({}),
    sectionSubtitle: LocalizedTextSchema.default({}),
    droneTvTitle: LocalizedTextSchema.default({}),
    droneTvSubtitle: LocalizedTextSchema.default({}),
    dailyWondersHeading: LocalizedTextSchema.default({}),
    quoteText: LocalizedTextSchema.default({}),
    cardText: LocalizedTextSchema.default({}),
    narrationText: LocalizedTextSchema.default({}),
  })
  .passthrough();

export type HomepageModuleKey =
  | 'explore'
  | 'categoryStrip'
  | 'trending'
  | 'quickTools'
  | 'appPromo'
  | 'footer';

const HomepageModuleSchema = z
  .object({
    enabled: z.boolean().default(true),
    order: z.number().int().positive().optional(),
  })
  .passthrough();

const TickerSchema = z
  .object({
    enabled: z.boolean().default(false),
    speedSec: z.number().int().min(5).max(300).optional(),
    maxItems: z.number().int().min(1).max(100).optional(),
  })
  .passthrough();

const InspirationHubSchema = z
  .object({
    enabled: z.boolean().default(false),
    droneTvEnabled: z.boolean().default(false),
    youtubeUrl: z.string().default(''),
    embedUrl: z.string().default(''),
    droneTvYoutubeUrl: z.string().default(''),
    title: z.string().default(''),
    videoTitle: z.string().default(''),
    subtitle: z.string().default(''),
    videoSubtitle: z.string().default(''),
    autoplayMuted: z.boolean().default(true),
    showOnHomepage: z.boolean().default(false),
    showOnCategoryPage: z.boolean().default(true),
    showOnInspirationHubPage: z.boolean().default(true),
    localizedContent: InspirationHubLocalizedContentSchema.default({}),
  })
  .passthrough();

function normalizeLocalizedText(input: unknown, fallback = ''): Record<(typeof SUPPORTED_INSPIRATION_LANGUAGES)[number], string> {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    en: typeof value.en === 'string' ? value.en : fallback,
    hi: typeof value.hi === 'string' ? value.hi : '',
    gu: typeof value.gu === 'string' ? value.gu : '',
  };
}

function normalizeInspirationHubLocalizedContent(input: unknown, legacy: { title: string; subtitle: string }) {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    sectionTitle: normalizeLocalizedText(value.sectionTitle),
    sectionSubtitle: normalizeLocalizedText(value.sectionSubtitle),
    droneTvTitle: normalizeLocalizedText(value.droneTvTitle, legacy.title),
    droneTvSubtitle: normalizeLocalizedText(value.droneTvSubtitle, legacy.subtitle),
    dailyWondersHeading: normalizeLocalizedText(value.dailyWondersHeading),
    quoteText: normalizeLocalizedText(value.quoteText),
    cardText: normalizeLocalizedText(value.cardText),
    narrationText: normalizeLocalizedText(value.narrationText),
  };
}

export function extractYouTubeVideoId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }

    const isYoutubeHost =
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com';

    if (!isYoutubeHost) return null;

    const watchId = url.searchParams.get('v');
    if (watchId) return watchId;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['embed', 'shorts', 'live'].includes(parts[0])) {
      return parts[1] || null;
    }

    return null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(raw: string): string {
  const id = extractYouTubeVideoId(raw);
  return id ? `https://www.youtube.com/embed/${id}` : '';
}

function normalizeInspirationHubSettings(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};

  const value = { ...(input as Record<string, unknown>) };

  const youtubeUrl = typeof value.youtubeUrl === 'string' && value.youtubeUrl.trim()
    ? value.youtubeUrl.trim()
    : typeof value.droneTvYoutubeUrl === 'string'
      ? value.droneTvYoutubeUrl.trim()
      : '';

  const embedUrl = typeof value.embedUrl === 'string' && value.embedUrl.trim()
    ? value.embedUrl.trim()
    : getYouTubeEmbedUrl(youtubeUrl);

  const title = typeof value.title === 'string' && value.title.trim()
    ? value.title
    : typeof value.videoTitle === 'string'
      ? value.videoTitle
      : '';

  const subtitle = typeof value.subtitle === 'string' && value.subtitle.trim()
    ? value.subtitle
    : typeof value.videoSubtitle === 'string'
      ? value.videoSubtitle
      : '';

  const hasShowOnCategoryPage = typeof value.showOnCategoryPage === 'boolean';
  const showOnCategoryPage = hasShowOnCategoryPage
    ? Boolean(value.showOnCategoryPage)
    : typeof value.showOnInspirationHubPage === 'boolean'
      ? Boolean(value.showOnInspirationHubPage)
      : true;

  const localizedContent = normalizeInspirationHubLocalizedContent(value.localizedContent, {
    title,
    subtitle,
  });

  return {
    ...value,
    youtubeUrl,
    embedUrl,
    droneTvYoutubeUrl: youtubeUrl,
    title,
    videoTitle: title,
    subtitle,
    videoSubtitle: subtitle,
    showOnCategoryPage,
    showOnInspirationHubPage: showOnCategoryPage,
    localizedContent,
  };
}

export const PublicSiteSettingsSchema = z
  .object({
    homepage: z
      .object({
        modules: z
          .record(HomepageModuleSchema)
          .default({}),
      })
      .default({}),

    tickers: z
      .object({
        pauseOnHover: z.boolean().default(true),
        breaking: TickerSchema.default({}),
        live: TickerSchema.default({}),
      })
      .default({}),

    liveTv: z
      .object({
        enabled: z.boolean().default(false),
        embedUrl: z.string().default(''),
      })
      .default({}),

    inspirationHub: InspirationHubSchema.default({}),

    languageTheme: z
      .object({
        languages: z.array(z.string()).default(['en']),
        themePreset: z.enum(['light', 'dark', 'system']).default('system'),
      })
      .default({}),
  })
  .passthrough();

export type PublicSiteSettings = z.infer<typeof PublicSiteSettingsSchema>;

export const DEFAULT_PUBLIC_SITE_SETTINGS: PublicSiteSettings = {
  homepage: {
    modules: {
      explore: { enabled: true, order: 1 },
      categoryStrip: { enabled: true, order: 2 },
      trending: { enabled: true, order: 3 },
      quickTools: { enabled: true, order: 6 },
      appPromo: { enabled: false, order: 7 },
      footer: { enabled: true, order: 8 },
    },
  },
  tickers: {
    pauseOnHover: true,
    live: { enabled: false, speedSec: 65, maxItems: 15, order: 4 },
    breaking: { enabled: false, speedSec: 55, maxItems: 12, order: 5 },
  },
  liveTv: { enabled: false, embedUrl: '' },
  inspirationHub: {
    enabled: false,
    droneTvEnabled: false,
    youtubeUrl: '',
    embedUrl: '',
    droneTvYoutubeUrl: '',
    title: '',
    videoTitle: '',
    subtitle: '',
    videoSubtitle: '',
    autoplayMuted: true,
    showOnHomepage: false,
    showOnCategoryPage: true,
    showOnInspirationHubPage: true,
    localizedContent: {
      sectionTitle: { en: '', hi: '', gu: '' },
      sectionSubtitle: { en: '', hi: '', gu: '' },
      droneTvTitle: { en: '', hi: '', gu: '' },
      droneTvSubtitle: { en: '', hi: '', gu: '' },
      dailyWondersHeading: { en: '', hi: '', gu: '' },
      quoteText: { en: '', hi: '', gu: '' },
      cardText: { en: '', hi: '', gu: '' },
      narrationText: { en: '', hi: '', gu: '' },
    },
  },
  languageTheme: { languages: ['en'], themePreset: 'system' },
};

const LEGACY_HOMEPAGE_MODULE_KEY_MAP: Record<string, HomepageModuleKey> = {
  exploreCategories: 'explore',
  trendingStrip: 'trending',
};

function normalizeHomepageModulesRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};

  const modules: Record<string, any> = { ...(input as any) };

  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_HOMEPAGE_MODULE_KEY_MAP)) {
    const legacyValue = modules[legacyKey];
    if (legacyValue && typeof legacyValue === 'object') {
      if (!modules[canonicalKey] || typeof modules[canonicalKey] !== 'object') {
        modules[canonicalKey] = legacyValue;
      } else {
        modules[canonicalKey] = { ...legacyValue, ...modules[canonicalKey] };
      }
    }
    delete modules[legacyKey];
  }

  return modules;
}

export function normalizePublicSiteSettings(input: PublicSiteSettings): PublicSiteSettings {
  return {
    ...input,
    homepage: {
      ...(input.homepage || {}),
      modules: normalizeHomepageModulesRecord((input as any)?.homepage?.modules) as any,
    },
    inspirationHub: normalizeInspirationHubSettings((input as any)?.inspirationHub) as any,
  };
}

export function normalizePublicSiteSettingsPatch<T extends Partial<PublicSiteSettings>>(patch: T): T {
  const rawModules = (patch as any)?.homepage?.modules;
  const rawInspirationHub = (patch as any)?.inspirationHub;
  const next: any = {
    ...(patch as any),
  };

  if (rawModules && typeof rawModules === 'object') {
    next.homepage = {
      ...((patch as any).homepage || {}),
      modules: normalizeHomepageModulesRecord(rawModules),
    };
  }

  if (rawInspirationHub && typeof rawInspirationHub === 'object') {
    next.inspirationHub = normalizeInspirationHubSettings(rawInspirationHub);
  }

  return next;
}
