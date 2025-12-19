import type { SiteSettings } from '@/types/siteSettings';

export type SettingScope = 'frontend' | 'admin' | 'both';
export type ControlType = 'toggle' | 'select' | 'input';

export type SettingItem = {
  key: string; // dot path within SiteSettings (e.g., 'ui.showFooter')
  label: string;
  description?: string;
  section: 'Frontend UI' | 'Navigation' | 'Publishing' | 'AI Modules' | 'Voice & Languages' | 'Monetization' | 'Integrations' | 'Community';
  scope: SettingScope;
  control: ControlType;
  options?: { value: string; label: string }[]; // for select
  tooltip?: string;
};

// Central registry: add new settings here to auto-render in the hub
export const SETTINGS_REGISTRY: SettingItem[] = [
  // Frontend UI
  { key: 'ui.showExploreCategories', label: 'Show Explore Categories', description: 'Display the categories discovery strip on homepage.', section: 'Frontend UI', scope: 'frontend', control: 'toggle' },
  { key: 'ui.showCategoryStrip', label: 'Show Category Strip', description: 'Enable the top category navigation strip.', section: 'Frontend UI', scope: 'frontend', control: 'toggle' },
  { key: 'ui.showTrendingStrip', label: 'Show Trending Strip', description: 'Show trending topics ribbon under hero.', section: 'Frontend UI', scope: 'frontend', control: 'toggle' },
  { key: 'ui.showLiveUpdatesTicker', label: 'Live Updates Ticker', description: 'Enable live updates ticker for breaking changes.', section: 'Frontend UI', scope: 'frontend', control: 'toggle' },
  { key: 'ui.showBreakingTicker', label: 'Breaking Ticker', description: 'Highlight urgent breaking headlines.', section: 'Frontend UI', scope: 'frontend', control: 'toggle' },
  { key: 'ui.showQuickTools', label: 'Quick Tools', description: 'Show shortcuts to tools (e.g., grammar).', section: 'Frontend UI', scope: 'frontend', control: 'toggle' },
  { key: 'ui.showAppPromo', label: 'App Promo', description: 'Display app promotion card.', section: 'Frontend UI', scope: 'frontend', control: 'toggle' },
  { key: 'ui.showFooter', label: 'Footer', description: 'Control footer visibility.', section: 'Frontend UI', scope: 'frontend', control: 'toggle' },
  { key: 'ui.theme', label: 'Theme', description: 'Default visual theme for site.', section: 'Frontend UI', scope: 'frontend', control: 'select', options: [
    { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }
  ] },
  { key: 'ui.density', label: 'Density', description: 'Spacing preference for components.', section: 'Frontend UI', scope: 'frontend', control: 'select', options: [
    { value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }
  ] },

  // Navigation
  { key: 'navigation.enableTopNav', label: 'Top Navigation', section: 'Navigation', scope: 'frontend', control: 'toggle' },
  { key: 'navigation.enableSidebar', label: 'Sidebar', section: 'Navigation', scope: 'frontend', control: 'toggle' },
  { key: 'navigation.enableBreadcrumbs', label: 'Breadcrumbs', section: 'Navigation', scope: 'frontend', control: 'toggle' },

  // Publishing
  { key: 'publishing.autoPublishApproved', label: 'Auto Publish Approved', section: 'Publishing', scope: 'admin', control: 'toggle' },
  { key: 'publishing.reviewWorkflow', label: 'Review Workflow', section: 'Publishing', scope: 'admin', control: 'select', options: [
    { value: 'none', label: 'None' }, { value: 'basic', label: 'Basic' }, { value: 'strict', label: 'Strict' }
  ] },
  { key: 'publishing.defaultVisibility', label: 'Default Visibility', section: 'Publishing', scope: 'both', control: 'select', options: [
    { value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }, { value: 'scheduled', label: 'Scheduled' }
  ] },

  // AI Modules
  { key: 'ai.editorialAssistant', label: 'Editorial Assistant', section: 'AI Modules', scope: 'admin', control: 'toggle' },
  { key: 'ai.autoSummaries', label: 'Auto Summaries', section: 'AI Modules', scope: 'admin', control: 'toggle' },
  { key: 'ai.contentTagging', label: 'Content Tagging', section: 'AI Modules', scope: 'admin', control: 'toggle' },
  { key: 'ai.model', label: 'AI Model', section: 'AI Modules', scope: 'admin', control: 'select', options: [
    { value: 'gpt', label: 'GPT' }, { value: 'mixtral', label: 'Mixtral' }, { value: 'claude', label: 'Claude' }, { value: 'local', label: 'Local' }
  ] },

  // Voice & Languages
  { key: 'voice.ttsEnabled', label: 'Text-to-Speech', section: 'Voice & Languages', scope: 'both', control: 'toggle' },
  { key: 'voice.ttsVoice', label: 'TTS Voice', section: 'Voice & Languages', scope: 'frontend', control: 'input' },
  { key: 'voice.rtlEnabled', label: 'RTL Enabled', section: 'Voice & Languages', scope: 'frontend', control: 'toggle' },
  { key: 'voice.languages', label: 'Languages', section: 'Voice & Languages', scope: 'both', control: 'input', tooltip: 'Comma-separated language codes (e.g., en,hi,ta)'} ,

  // Monetization
  { key: 'monetization.adsEnabled', label: 'Ads Enabled', section: 'Monetization', scope: 'frontend', control: 'toggle' },
  { key: 'monetization.sponsorBlocks', label: 'Sponsor Blocks', section: 'Monetization', scope: 'frontend', control: 'toggle' },
  { key: 'monetization.membershipEnabled', label: 'Membership Enabled', section: 'Monetization', scope: 'both', control: 'toggle' },

  // Integrations
  { key: 'integrations.analyticsEnabled', label: 'Analytics Enabled', section: 'Integrations', scope: 'frontend', control: 'toggle' },
  { key: 'integrations.analyticsProvider', label: 'Analytics Provider', section: 'Integrations', scope: 'frontend', control: 'select', options: [
    { value: 'none', label: 'None' }, { value: 'ga4', label: 'GA4' }, { value: 'plausible', label: 'Plausible' }
  ] },
  { key: 'integrations.newsletterProvider', label: 'Newsletter Provider', section: 'Integrations', scope: 'admin', control: 'select', options: [
    { value: 'none', label: 'None' }, { value: 'mailchimp', label: 'Mailchimp' }, { value: 'resend', label: 'Resend' }
  ] },
];

export function getValue(settings: SiteSettings, path: string): any {
  return path.split('.').reduce((acc: any, seg) => (acc ? acc[seg] : undefined), settings as any);
}

export function setValue(settings: SiteSettings, path: string, value: any): SiteSettings {
  const segments = path.split('.');
  const next = { ...settings } as any;
  let cursor = next;
  for (let i = 0; i < segments.length - 1; i++) {
    const s = segments[i];
    cursor[s] = { ...(cursor[s] || {}) };
    cursor = cursor[s];
  }
  cursor[segments[segments.length - 1]] = value;
  return next as SiteSettings;
}
