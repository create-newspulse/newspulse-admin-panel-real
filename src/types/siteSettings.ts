import { z } from 'zod';

export type HomepageModuleKey =
  | 'explore'
  | 'categoryStrip'
  | 'trending'
  | 'liveUpdatesTicker'
  | 'breakingTicker'
  | 'quickTools'
  | 'appPromo'
  | 'footer';

export type HomepageModuleConfig = {
  enabled: boolean;
  order?: number;
};

export const SiteSettingsSchema = z.object({
  // Frontend UI
  ui: z.object({
    showExploreCategories: z.boolean().default(true),
    showCategoryStrip: z.boolean().default(true),
    showTrendingStrip: z.boolean().default(true),
    showLiveUpdatesTicker: z.boolean().default(false),
    showBreakingTicker: z.boolean().default(false),
    showQuickTools: z.boolean().default(true),
    showAppPromo: z.boolean().default(false),
    showFooter: z.boolean().default(true),
    theme: z.enum(['light','dark','system']).default('system'),
    density: z.enum(['comfortable','compact']).default('comfortable'),
  }).default({}),

  // Public site homepage modules
  homepage: z.object({
    modules: z
      .object({
        explore: z.object({
          enabled: z.boolean().default(true),
          order: z.number().optional(),
        }).default({ enabled: true }),
        categoryStrip: z.object({
          enabled: z.boolean().default(true),
          order: z.number().optional(),
        }).default({ enabled: true }),
        trending: z.object({
          enabled: z.boolean().default(true),
          order: z.number().optional(),
        }).default({ enabled: true }),
        liveUpdatesTicker: z.object({
          enabled: z.boolean().default(false),
          order: z.number().optional(),
        }).default({ enabled: false }),
        breakingTicker: z.object({
          enabled: z.boolean().default(false),
          order: z.number().optional(),
        }).default({ enabled: false }),
        quickTools: z.object({
          enabled: z.boolean().default(true),
          order: z.number().optional(),
        }).default({ enabled: true }),
        appPromo: z.object({
          enabled: z.boolean().default(false),
          order: z.number().optional(),
        }).default({ enabled: false }),
        footer: z.object({
          enabled: z.boolean().default(true),
          order: z.number().optional(),
        }).default({ enabled: true }),
      })
      .default({}),
    modulesOrder: z.array(
      z.enum([
        'explore',
        'categoryStrip',
        'trending',
        'liveUpdatesTicker',
        'breakingTicker',
        'quickTools',
        'appPromo',
        'footer',
      ])
    ).default([
      'explore',
      'categoryStrip',
      'trending',
      'liveUpdatesTicker',
      'breakingTicker',
      'quickTools',
      'appPromo',
      'footer',
    ]),
  }).default({}),

  // Public site tickers
  tickers: z.object({
    liveSpeedSec: z.number().min(1).max(60).default(8),
    breakingSpeedSec: z.number().min(1).max(60).default(6),
  }).default({}),

  // Public site Live TV embed
  liveTv: z.object({
    enabled: z.boolean().default(false),
    embedUrl: z.string().url().or(z.literal('')).default(''),
  }).default({}),

  // Public site footer
  footer: z.object({
    text: z.string().default(''),
  }).default({}),

  // Navigation
  navigation: z.object({
    enableTopNav: z.boolean().default(true),
    enableSidebar: z.boolean().default(true),
    enableBreadcrumbs: z.boolean().default(true),
  }).default({}),
  // Publishing
  publishing: z.object({
    autoPublishApproved: z.boolean().default(false),
    readOnly: z.boolean().optional(),
    reviewWorkflow: z.enum(['none','basic','strict']).default('basic'),
    defaultVisibility: z.enum(['public','private','scheduled']).default('public'),
  }).default({}),
  // AI Modules
  ai: z.object({
    editorialAssistant: z.boolean().default(false),
    autoSummaries: z.boolean().default(false),
    contentTagging: z.boolean().default(true),
    model: z.enum(['gpt','mixtral','claude','local']).default('gpt'),
  }).default({}),
  // Voice & Languages
  voice: z.object({
    ttsEnabled: z.boolean().default(false),
    ttsVoice: z.string().default('female_en'),
    rtlEnabled: z.boolean().default(false),
    languages: z.array(z.string()).default(['en']),
  }).default({}),

  // Translation
  translation: z.object({
    qualityMode: z.enum(['standard', 'strict']).default('standard'),
  }).default({}),

  // Community
  community: z.object({
    reporterPortalEnabled: z.boolean().default(true),
    commentsEnabled: z.boolean().default(true),
    moderationLevel: z.enum(['open','moderated','closed']).default('moderated'),
  }).default({}),
  // Monetization
  monetization: z.object({
    adsEnabled: z.boolean().default(false),
    sponsorBlocks: z.boolean().default(false),
    membershipEnabled: z.boolean().default(false),
  }).default({}),
  // Integrations
  integrations: z.object({
    analyticsEnabled: z.boolean().default(true),
    analyticsProvider: z.enum(['none','ga4','plausible']).default('ga4'),
    newsletterProvider: z.enum(['none','mailchimp','resend']).default('none'),
    externalFetch: z.boolean().optional(),
  }).default({}),
  // Security (founder-only)
  security: z.object({
    lockdown: z.boolean().default(false),
    twoFactorRequired: z.boolean().default(false),
    allowedHosts: z.array(z.string()).default([]),
  }).default({}),
  // Backups (founder-only)
  backups: z.object({
    enabled: z.boolean().default(false),
    cadence: z.enum(['daily','weekly','monthly']).default('weekly'),
  }).default({}),
  // Audit Logs
  audit: z.object({
    enabled: z.boolean().default(true),
    retentionDays: z.number().min(1).max(365).default(90),
  }).default({}),
  // Versioning meta
  version: z.number().default(1),
  updatedAt: z.string().default(new Date().toISOString()),
  updatedBy: z.string().default('system'),
});

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

// Default settings with safe fallback to ensure no runtime crashes.
const _safeDefault = SiteSettingsSchema.safeParse({});
export const DEFAULT_SETTINGS: SiteSettings = _safeDefault.success ? _safeDefault.data : ({} as any);
export const defaultSiteSettings: SiteSettings = DEFAULT_SETTINGS;
