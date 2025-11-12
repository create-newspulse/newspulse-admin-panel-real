// Central list of article categories used across the admin UI.
// Aligned with the homepage cards shown in the design (Breaking, Regional, National, ...).
// The FIRST item becomes the default for new articles.

export const ARTICLE_CATEGORIES: string[] = [
  'Breaking',
  'Regional',
  'National',
  'International',
  'Business',
  'Sci-Tech',
  'Sports',
  'Lifestyle',
  'Glamour',
  'Web Stories',
  'Viral Videos',
  'Editorial',
  'Youth Pulse',
  'Inspiration Hub',
];

// Optional synonyms/aliases that will be canonicalized to the above list.
const ALIASES: Record<string, string> = {
  // Canonicals (self-map for case-insensitive match)
  ...Object.fromEntries(ARTICLE_CATEGORIES.map(c => [c.toLowerCase(), c])),
  // Common alternates
  'world': 'International',
  'global': 'International',
  'india': 'National',
  'bharat': 'National',
  'local': 'Regional',
  'state': 'Regional',
  'technology': 'Sci-Tech',
  'tech': 'Sci-Tech',
  'science': 'Sci-Tech',
  'entertainment': 'Glamour',
  'bollywood': 'Glamour',
  'hollywood': 'Glamour',
  'videos': 'Viral Videos',
  'viral': 'Viral Videos',
  'stories': 'Web Stories',
  'webstories': 'Web Stories',
  'web story': 'Web Stories',
  'life': 'Lifestyle',
  'health': 'Lifestyle',
  'fitness': 'Lifestyle',
  'finance': 'Business',
  'economy': 'Business',
  'markets': 'Business',
  'sport': 'Sports',
  'education': 'Youth Pulse',
  'campus': 'Youth Pulse',
  'youth': 'Youth Pulse',
  'inspiration': 'Inspiration Hub',
  'motivation': 'Inspiration Hub',
};

export function isValidCategory(cat: string): boolean {
  return ARTICLE_CATEGORIES.includes(cat);
}

export function canonicalizeCategory(input?: string | null): string {
  const key = (input || '').trim().toLowerCase();
  return ALIASES[key] || ARTICLE_CATEGORIES[0];
}
