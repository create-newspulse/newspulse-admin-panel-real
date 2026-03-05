import { AdminApiError, adminJson } from '@/lib/http/adminFetch';

export type GlossaryEntry = {
  id: string;
  term: string; // canonical source term (usually English)
  hi: string;
  gu: string;
};

type GlossaryResponse = { items: GlossaryEntry[] } | GlossaryEntry[];

function normalizeGlossaryResponse(raw: GlossaryResponse): GlossaryEntry[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).items)) return (raw as any).items;
  return [];
}

export async function getTranslationGlossary(): Promise<GlossaryEntry[]> {
  try {
    const raw = await adminJson<GlossaryResponse>('/translation/glossary', { method: 'GET', cache: 'no-store' } as any);
    return normalizeGlossaryResponse(raw);
  } catch (e) {
    // Glossary is optional; some backends do not implement it.
    if (e instanceof AdminApiError && e.status === 404) return [];
    throw e;
  }
}

export async function putTranslationGlossary(items: GlossaryEntry[]): Promise<GlossaryEntry[]> {
  try {
    const raw = await adminJson<GlossaryResponse>('/translation/glossary', { method: 'PUT', json: { items } } as any);
    return normalizeGlossaryResponse(raw);
  } catch (e) {
    if (e instanceof AdminApiError) {
      // Glossary is optional; if not implemented, treat as a no-op save.
      if (e.status === 404) return Array.isArray(items) ? items : [];

      // Some backends expose create-only, not PUT.
      if (e.status === 405) {
        try {
          const raw = await adminJson<GlossaryResponse>('/translation/glossary', { method: 'POST', json: { items } } as any);
          return normalizeGlossaryResponse(raw);
        } catch (e2) {
          if (e2 instanceof AdminApiError && e2.status === 404) return Array.isArray(items) ? items : [];
          throw e2;
        }
      }
    }
    throw e;
  }
}
