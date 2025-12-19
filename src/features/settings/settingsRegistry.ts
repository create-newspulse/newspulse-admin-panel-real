export type SettingsSection = {
  id: string;
  label: string;
  key: string; // used for URL (?tab=...)
  order: number;
  icon?: string;
  description?: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'overview',          label: 'Overview',          key: 'overview',          order: 1 },
  { id: 'publishing',        label: 'Publishing',        key: 'publishing',        order: 2 },
  { id: 'navigation',        label: 'Navigation',        key: 'navigation',        order: 3 },
  { id: 'frontend-ui',       label: 'Frontend UI',       key: 'frontend-ui',       order: 4 },
  { id: 'ai-modules',        label: 'AI Modules',        key: 'ai-modules',        order: 5 },
  { id: 'voice-languages',   label: 'Voice & Languages', key: 'voice-languages',   order: 6 },
  { id: 'community',         label: 'Community',         key: 'community',         order: 7 },
  { id: 'monetization',      label: 'Monetization',      key: 'monetization',      order: 8 },
  { id: 'integrations',      label: 'Integrations',      key: 'integrations',      order: 9 },
];

function findDuplicates<T extends { [k: string]: any }>(items: T[], field: keyof T): string[] {
  const seen = new Map<string, number>();
  const dupes: string[] = [];
  for (const item of items) {
    const val = String(item[field] ?? '');
    if (!val) continue;
    const count = (seen.get(val) ?? 0) + 1;
    seen.set(val, count);
    if (count === 2) dupes.push(val);
  }
  return dupes;
}

export function assertUnique(sections: SettingsSection[] = SETTINGS_SECTIONS) {
  const fields: (keyof SettingsSection)[] = ['id', 'label', 'key'];
  const problems: Record<string, string[]> = {};
  for (const f of fields) {
    const dup = findDuplicates(sections, f);
    if (dup.length) problems[String(f)] = dup;
  }
  if (Object.keys(problems).length) {
    // Dev-only signal; do not throw to avoid breaking hot dev server
    console.error('[settingsRegistry] Duplicate values detected:', problems);
  }
}

if (import.meta.env && import.meta.env.DEV) {
  assertUnique();
}
