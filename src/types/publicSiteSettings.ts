import { z } from 'zod';

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
    speedSec: z.number().int().min(1).max(60).optional(),
  })
  .passthrough();

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
    live: { enabled: false, speedSec: 8, order: 4 },
    breaking: { enabled: false, speedSec: 6, order: 5 },
  },
  liveTv: { enabled: false, embedUrl: '' },
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
  };
}

export function normalizePublicSiteSettingsPatch<T extends Partial<PublicSiteSettings>>(patch: T): T {
  const rawModules = (patch as any)?.homepage?.modules;
  if (!rawModules || typeof rawModules !== 'object') return patch;

  const normalizedModules = normalizeHomepageModulesRecord(rawModules);
  return {
    ...(patch as any),
    homepage: {
      ...((patch as any).homepage || {}),
      modules: normalizedModules,
    },
  };
}
