// Unicode-aware slugify that preserves Hindi (Devanagari) and Gujarati characters
// while normalizing separators to hyphens and trimming length. This keeps
// Gujarati slugs readable instead of collapsing to numbers only.
export function slugify(input: string) {
  const s = (input || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u2019'"`]+/g, '') // strip quotes/apostrophes
    // Allow: a-z, 0-9, Devanagari (\u0900-\u097F), Gujarati (\u0A80-\u0AFF)
    .replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return s;
}

export async function uniqueSlug(base: string, existing: Set<string>) {
  const attempt = slugify(base) || 'article';
  if (!existing.has(attempt)) return attempt;
  let i = 1;
  while (existing.has(`${attempt}-${i}`)) i++;
  return `${attempt}-${i}`;
}
