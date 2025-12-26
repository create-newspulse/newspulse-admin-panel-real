import { slugify } from '@/lib/slug';

export function generateArticleSlug(opts: { title: string; slug?: string | null }): string {
  const raw = String(opts.slug || '').trim();
  const base = raw || String(opts.title || '').trim();
  return slugify(base);
}
