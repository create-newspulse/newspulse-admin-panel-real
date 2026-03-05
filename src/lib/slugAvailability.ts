import { adminApiClient } from '@/lib/adminApiClient';

export type SlugAvailabilityResult = {
  available: boolean;
  reason?: string;
};

export async function checkSlugAvailability(opts: {
  slug: string;
  excludeId?: string | null;
}): Promise<SlugAvailabilityResult> {
  const slug = (opts.slug || '').trim();
  const excludeId = (opts.excludeId || '').trim();

  if (!slug) return { available: false, reason: 'Slug is required' };

  const endpoint = `articles/slug/${encodeURIComponent(slug)}`;

  try {
    const res = await adminApiClient.get(endpoint, {
      params: excludeId ? { excludeId } : undefined,
    });

    const raw = res?.data as any;
    const candidate = raw?.data && typeof raw.data === 'object' ? raw.data : raw;

    // Backend-approved route may return:
    // - 200 with { available: true }
    // - 200 with { exists: true }
    // - 200 with { article: {...} } (slug taken)
    // - 200 with { ok: true } + additional fields
    const explicitlyAvailable = candidate?.available === true || candidate?.isAvailable === true || candidate?.exists === false;
    if (explicitlyAvailable) return { available: true };

    const explicitlyTaken = candidate?.available === false || candidate?.isAvailable === false || candidate?.exists === true;
    const hasArticle = Boolean(candidate?.article?._id || candidate?._id || candidate?.id);
    if (explicitlyTaken || hasArticle) {
      return { available: false, reason: candidate?.reason || candidate?.message || 'Slug already exists' };
    }

    // Default conservative: if we got a successful response but can't infer, treat as taken.
    return { available: false, reason: candidate?.reason || candidate?.message || 'Slug already exists' };
  } catch (e: any) {
    const status = e?.response?.status;
    // If endpoint isn't implemented or slug not found (commonly 404 => available), do not block.
    if (status === 404 || status === 405) return { available: true };
    throw e;
  }
}

export function buildSlugSuggestions(baseSlug: string, count = 3): string[] {
  const base = (baseSlug || '').trim().replace(/-+$/g, '');
  if (!base) return [];
  const c = Math.max(1, Math.min(10, count));
  return Array.from({ length: c }, (_, i) => `${base}-${i + 2}`);
}
