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
  const raw = await adminJson<GlossaryResponse>('/translation/glossary', { method: 'GET', cache: 'no-store' } as any);
  return normalizeGlossaryResponse(raw);
}

export async function putTranslationGlossary(items: GlossaryEntry[]): Promise<GlossaryEntry[]> {
  try {
    const raw = await adminJson<GlossaryResponse>('/translation/glossary', { method: 'PUT', json: { items } } as any);
    return normalizeGlossaryResponse(raw);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 405) {
      const raw = await adminJson<GlossaryResponse>('/translation/glossary', { method: 'POST', json: { items } } as any);
      return normalizeGlossaryResponse(raw);
    }
    throw e;
  }
}
