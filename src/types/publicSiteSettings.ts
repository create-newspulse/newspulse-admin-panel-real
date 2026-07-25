import { z } from 'zod';

const SUPPORTED_INSPIRATION_LANGUAGES = ['en', 'hi', 'gu'] as const;
export const LIVE_TV_MODES = [
  'News Pulse Live',
  'AIRA Bulletin',
  'Offline Replay',
  'Scheduled Show',
  'Breaking Mode',
  'Maintenance / Coming Soon',
] as const;
export const LIVE_TV_PROVIDERS = ['YouTube', 'Custom Embed'] as const;
export const LIVE_TV_LANGUAGES = ['English', 'Hindi', 'Gujarati'] as const;

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

const LiveTvSchema = z
  .object({
    enabled: z.boolean().default(false),
    mode: z.enum(LIVE_TV_MODES).default('News Pulse Live'),
    provider: z.enum(LIVE_TV_PROVIDERS).default('YouTube'),
    embedUrl: z.string().default(''),
    fallbackVideoUrl: z.string().default(''),
    title: z.string().default(''),
    subtitle: z.string().default(''),
    language: z.enum(LIVE_TV_LANGUAGES).default('English'),
    showOnHomepage: z.boolean().default(true),
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

const DailyWondersSchema = z
  .object({
    enabled: z.boolean().default(true),
    showOnHomepage: z.boolean().default(true),
    smallLabel: z.string().default('DAILY WONDERS'),
    title: z.string().default('Thought of the Day'),
    subtitle: z.string().default('One meaningful thought to pause, reflect, and move through the day with clarity.'),
    thoughtLabel: z.string().default("TODAY'S THOUGHT"),
    thoughtText: z.string().default('A peaceful mind does not come from a perfect day, but from choosing calm in the middle of it.'),
    reminderLabel: z.string().default('GENTLE REMINDER'),
    reminderText: z.string().default('You do not need to solve the whole day at once. One honest step is enough.'),
    footerText: z.string().default('A small daily pause for calm, clarity, and inspiration.'),
    publishDate: z.string().default(''),
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

function normalizeDailyWondersSettings(input: unknown): Record<string, unknown> {
  const value = input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : {};

  return {
    ...value,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    showOnHomepage: typeof value.showOnHomepage === 'boolean' ? value.showOnHomepage : true,
    smallLabel: typeof value.smallLabel === 'string' && value.smallLabel.trim() ? value.smallLabel : 'DAILY WONDERS',
    title: typeof value.title === 'string' && value.title.trim() ? value.title : 'Thought of the Day',
    subtitle: typeof value.subtitle === 'string' && value.subtitle.trim()
      ? value.subtitle
      : 'One meaningful thought to pause, reflect, and move through the day with clarity.',
    thoughtLabel: typeof value.thoughtLabel === 'string' && value.thoughtLabel.trim()
      ? value.thoughtLabel
      : "TODAY'S THOUGHT",
    thoughtText: typeof value.thoughtText === 'string' && value.thoughtText.trim()
      ? value.thoughtText
      : 'A peaceful mind does not come from a perfect day, but from choosing calm in the middle of it.',
    reminderLabel: typeof value.reminderLabel === 'string' && value.reminderLabel.trim()
      ? value.reminderLabel
      : 'GENTLE REMINDER',
    reminderText: typeof value.reminderText === 'string' && value.reminderText.trim()
      ? value.reminderText
      : 'You do not need to solve the whole day at once. One honest step is enough.',
    footerText: typeof value.footerText === 'string' && value.footerText.trim()
      ? value.footerText
      : 'A small daily pause for calm, clarity, and inspiration.',
    publishDate: typeof value.publishDate === 'string' ? value.publishDate : '',
  };
}

function normalizeLiveTvMode(value: unknown): (typeof LIVE_TV_MODES)[number] {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return 'News Pulse Live';
  if (raw === 'news pulse live' || raw === 'live' || raw === 'news' || raw === 'news_pulse_live') return 'News Pulse Live';
  if (raw === 'aira bulletin' || raw === 'aira' || raw === 'bulletin' || raw === 'aira_bulletin') return 'AIRA Bulletin';
  if (raw === 'offline replay' || raw === 'offline' || raw === 'replay' || raw === 'offline_replay') return 'Offline Replay';
  if (raw === 'scheduled show' || raw === 'scheduled' || raw === 'scheduled_show') return 'Scheduled Show';
  if (raw === 'breaking mode' || raw === 'breaking' || raw === 'breaking_mode') return 'Breaking Mode';
  if (raw === 'maintenance / coming soon' || raw === 'maintenance' || raw === 'coming soon' || raw === 'maintenance_coming_soon') return 'Maintenance / Coming Soon';
  return 'News Pulse Live';
}

function normalizeLiveTvProvider(value: unknown): (typeof LIVE_TV_PROVIDERS)[number] {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'custom embed' || raw === 'custom' || raw === 'embed') return 'Custom Embed';
  return 'YouTube';
}

function normalizeLiveTvLanguage(value: unknown): (typeof LIVE_TV_LANGUAGES)[number] {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'hindi' || raw === 'hi') return 'Hindi';
  if (raw === 'gujarati' || raw === 'gu') return 'Gujarati';
  return 'English';
}

function normalizeHttpUrl(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizeYouTubeUrl(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return '';

  const validHttpUrl = normalizeHttpUrl(value);
  if (!validHttpUrl) return '';

  try {
    const url = new URL(validHttpUrl);
    const host = url.hostname.toLowerCase();
    const isYoutubeHost =
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtu.be' ||
      host === 'www.youtu.be' ||
      host === 'www.youtube-nocookie.com' ||
      host === 'youtube-nocookie.com';

    if (!isYoutubeHost) return '';
    if (url.pathname.includes('/embed/')) return url.toString();

    const embedUrl = getYouTubeEmbedUrl(validHttpUrl);
    return embedUrl || '';
  } catch {
    return '';
  }
}

function normalizeLiveTvVideoUrl(raw: unknown, provider: (typeof LIVE_TV_PROVIDERS)[number]): string {
  return provider === 'YouTube' ? normalizeYouTubeUrl(raw) : normalizeHttpUrl(raw);
}

export function normalizeLiveTvSettingsValue(input: unknown): z.infer<typeof LiveTvSchema> {
  const value = input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : {};
  const provider = normalizeLiveTvProvider(value.provider);

  return {
    ...value,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : false,
    mode: normalizeLiveTvMode(value.mode),
    provider,
    embedUrl: normalizeLiveTvVideoUrl(value.embedUrl, provider),
    fallbackVideoUrl: normalizeLiveTvVideoUrl(value.fallbackVideoUrl, provider),
    title: typeof value.title === 'string' ? value.title : '',
    subtitle: typeof value.subtitle === 'string' ? value.subtitle : '',
    language: normalizeLiveTvLanguage(value.language),
    showOnHomepage: typeof value.showOnHomepage === 'boolean' ? value.showOnHomepage : true,
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

    liveTv: LiveTvSchema.default({}),

    inspirationHub: InspirationHubSchema.default({}),

    dailyWonders: DailyWondersSchema.default({}),

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
  liveTv: {
    enabled: false,
    mode: 'News Pulse Live',
    provider: 'YouTube',
    embedUrl: '',
    fallbackVideoUrl: '',
    title: '',
    subtitle: '',
    language: 'English',
    showOnHomepage: true,
  },
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
  dailyWonders: {
    enabled: true,
    showOnHomepage: true,
    smallLabel: 'DAILY WONDERS',
    title: 'Thought of the Day',
    subtitle: 'One meaningful thought to pause, reflect, and move through the day with clarity.',
    thoughtLabel: "TODAY'S THOUGHT",
    thoughtText: 'A peaceful mind does not come from a perfect day, but from choosing calm in the middle of it.',
    reminderLabel: 'GENTLE REMINDER',
    reminderText: 'You do not need to solve the whole day at once. One honest step is enough.',
    footerText: 'A small daily pause for calm, clarity, and inspiration.',
    publishDate: '',
  },
  languageTheme: { languages: ['en'], themePreset: 'system' },
};

const PUBLIC_SITE_LANGUAGE_ORDER = ['en', 'hi', 'gu'] as const;
const PUBLIC_SITE_LANGUAGE_ALIASES: Record<string, (typeof PUBLIC_SITE_LANGUAGE_ORDER)[number]> = {
  en: 'en',
  english: 'en',
  hi: 'hi',
  hindi: 'hi',
  gu: 'gu',
  gujarati: 'gu',
  'gu-in': 'gu',
  gu_in: 'gu',
  gj: 'gu',
};

export function normalizePublicSiteLanguageCode(input: unknown): 'en' | 'hi' | 'gu' | '' {
  const key = String(input || '').trim().toLowerCase();
  return PUBLIC_SITE_LANGUAGE_ALIASES[key] || '';
}

export function normalizePublicSiteLanguageCodes(input: unknown): Array<'en' | 'hi' | 'gu'> {
  const raw = Array.isArray(input)
    ? input
    : String(input || '').split(',');

  const seen = new Set<string>();
  const out: Array<'en' | 'hi' | 'gu'> = [];
  raw.forEach((value) => {
    const code = normalizePublicSiteLanguageCode(value);
    if (!code || seen.has(code)) return;
    seen.add(code);
    out.push(code);
  });
  return out;
}

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
  const rawLanguageTheme = (input as any)?.languageTheme;
  const rawLanguages = rawLanguageTheme && typeof rawLanguageTheme === 'object' && 'languages' in rawLanguageTheme
    ? rawLanguageTheme.languages
    : undefined;
  return {
    ...input,
    homepage: {
      ...(input.homepage || {}),
      modules: normalizeHomepageModulesRecord((input as any)?.homepage?.modules) as any,
    },
    liveTv: normalizeLiveTvSettingsValue((input as any)?.liveTv) as any,
    inspirationHub: normalizeInspirationHubSettings((input as any)?.inspirationHub) as any,
    dailyWonders: normalizeDailyWondersSettings((input as any)?.dailyWonders) as any,
    languageTheme: {
      ...(rawLanguageTheme || {}),
      ...(rawLanguages === undefined ? {} : { languages: normalizePublicSiteLanguageCodes(rawLanguages) }),
    },
  };
}

export function normalizePublicSiteSettingsPatch<T extends Partial<PublicSiteSettings>>(patch: T): T {
  const rawModules = (patch as any)?.homepage?.modules;
  const rawLiveTv = (patch as any)?.liveTv;
  const rawInspirationHub = (patch as any)?.inspirationHub;
  const rawDailyWonders = (patch as any)?.dailyWonders;
  const rawLanguageTheme = (patch as any)?.languageTheme;
  const next: any = {
    ...(patch as any),
  };

  if (rawModules && typeof rawModules === 'object') {
    next.homepage = {
      ...((patch as any).homepage || {}),
      modules: normalizeHomepageModulesRecord(rawModules),
    };
  }

  if (rawLiveTv && typeof rawLiveTv === 'object') {
    next.liveTv = normalizeLiveTvSettingsValue(rawLiveTv);
  }

  if (rawInspirationHub && typeof rawInspirationHub === 'object') {
    next.inspirationHub = normalizeInspirationHubSettings(rawInspirationHub);
  }

  if (rawDailyWonders && typeof rawDailyWonders === 'object') {
    next.dailyWonders = normalizeDailyWondersSettings(rawDailyWonders);
  }

  if (rawLanguageTheme && typeof rawLanguageTheme === 'object') {
    const hasLanguages = 'languages' in rawLanguageTheme;
    next.languageTheme = {
      ...rawLanguageTheme,
      ...(hasLanguages ? { languages: normalizePublicSiteLanguageCodes(rawLanguageTheme.languages) } : {}),
    };
  }

  return next;
}
