export function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

export async function uniqueSlug(base: string, existing: Set<string>) {
  let attempt = slugify(base) || 'article';
  if (!existing.has(attempt)) return attempt;
  let i = 1;
  while (existing.has(`${attempt}-${i}`)) i++;
  return `${attempt}-${i}`;
}
