import { z } from 'zod';

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
  }),

  // Public site homepage modules
  homepage: z.object({
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
  }),

  // Public site tickers
  tickers: z.object({
    liveSpeedSec: z.number().min(1).max(60).default(8),
    breakingSpeedSec: z.number().min(1).max(60).default(6),
  }),

  // Public site Live TV embed
  liveTv: z.object({
    enabled: z.boolean().default(false),
    embedUrl: z.string().url().or(z.literal('')).default(''),
  }),

  // Public site footer
  footer: z.object({
    text: z.string().default(''),
  }),

  // Navigation
  navigation: z.object({
    enableTopNav: z.boolean().default(true),
    enableSidebar: z.boolean().default(true),
    enableBreadcrumbs: z.boolean().default(true),
  }),
  // Publishing
  publishing: z.object({
    autoPublishApproved: z.boolean().default(false),
    readOnly: z.boolean().optional(),
    reviewWorkflow: z.enum(['none','basic','strict']).default('basic'),
    defaultVisibility: z.enum(['public','private','scheduled']).default('public'),
  }),
  // AI Modules
  ai: z.object({
    editorialAssistant: z.boolean().default(false),
    autoSummaries: z.boolean().default(false),
    contentTagging: z.boolean().default(true),
    model: z.enum(['gpt','mixtral','claude','local']).default('gpt'),
  }),
  // Voice & Languages
  voice: z.object({
    ttsEnabled: z.boolean().default(false),
    ttsVoice: z.string().default('female_en'),
    rtlEnabled: z.boolean().default(false),
    languages: z.array(z.string()).default(['en']),
  }),
  // Community
  community: z.object({
    reporterPortalEnabled: z.boolean().default(true),
    commentsEnabled: z.boolean().default(true),
    moderationLevel: z.enum(['open','moderated','closed']).default('moderated'),
  }),
  // Monetization
  monetization: z.object({
    adsEnabled: z.boolean().default(false),
    sponsorBlocks: z.boolean().default(false),
    membershipEnabled: z.boolean().default(false),
  }),
  // Integrations
  integrations: z.object({
    analyticsEnabled: z.boolean().default(true),
    analyticsProvider: z.enum(['none','ga4','plausible']).default('ga4'),
    newsletterProvider: z.enum(['none','mailchimp','resend']).default('none'),
    externalFetch: z.boolean().optional(),
  }),
  // Security (founder-only)
  security: z.object({
    lockdown: z.boolean().default(false),
    twoFactorRequired: z.boolean().default(false),
    allowedHosts: z.array(z.string()).default([]),
  }),
  // Backups (founder-only)
  backups: z.object({
    enabled: z.boolean().default(false),
    cadence: z.enum(['daily','weekly','monthly']).default('weekly'),
  }),
  // Audit Logs
  audit: z.object({
    enabled: z.boolean().default(true),
    retentionDays: z.number().min(1).max(365).default(90),
  }),
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
