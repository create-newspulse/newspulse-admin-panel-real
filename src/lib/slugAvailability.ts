import apiClient from '@/lib/api';

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

  const res = await apiClient.get('/articles/slug-availability', {
    params: {
      slug,
      ...(excludeId ? { excludeId } : {}),
    },
  });

  const raw = res?.data as any;

  // Tolerate several backend shapes.
  // Examples:
  // - { ok: true, available: true }
  // - { available: false, reason: 'exists' }
  // - { data: { available: true } }
  const candidate = raw?.data && typeof raw.data === 'object' ? raw.data : raw;

  const available =
    candidate?.available === true ||
    candidate?.isAvailable === true ||
    candidate?.ok === true;

  const explicitlyUnavailable =
    candidate?.available === false ||
    candidate?.isAvailable === false;

  if (available && !explicitlyUnavailable) {
    return { available: true };
  }

  return {
    available: false,
    reason: candidate?.reason || candidate?.message || 'Slug already exists',
  };
}

export function buildSlugSuggestions(baseSlug: string, count = 3): string[] {
  const base = (baseSlug || '').trim().replace(/-+$/g, '');
  if (!base) return [];
  const c = Math.max(1, Math.min(10, count));
  return Array.from({ length: c }, (_, i) => `${base}-${i + 2}`);
}
