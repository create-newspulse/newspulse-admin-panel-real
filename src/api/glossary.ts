import { adminJson } from '@/lib/http/adminFetch';

export type GlossaryEntry = {
  id?: string;
  _id?: string;
  key: string;
  en?: string;
  hi?: string;
  gu?: string;
  preferredTerms?: {
    en?: string;
    hi?: string;
    gu?: string;
  };
  doNotTranslate?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeEntry(raw: any): GlossaryEntry {
  const id = raw?.id ?? raw?._id;
  const _id = raw?._id ?? raw?.id;

  const preferredRaw = raw?.preferredTerms ?? raw?.preferred ?? raw?.preferredByLang ?? raw?.preferred_terms;
  const preferredTerms = preferredRaw && typeof preferredRaw === 'object'
    ? {
      en: typeof preferredRaw?.en === 'string' ? preferredRaw.en : undefined,
      hi: typeof preferredRaw?.hi === 'string' ? preferredRaw.hi : undefined,
      gu: typeof preferredRaw?.gu === 'string' ? preferredRaw.gu : undefined,
    }
    : undefined;

  return {
    ...raw,
    id: id ? String(id) : undefined,
    _id: _id ? String(_id) : undefined,
    key: String(raw?.key || ''),
    en: typeof raw?.en === 'string' ? raw.en : (typeof raw?.translations?.en === 'string' ? raw.translations.en : undefined),
    hi: typeof raw?.hi === 'string' ? raw.hi : (typeof raw?.translations?.hi === 'string' ? raw.translations.hi : undefined),
    gu: typeof raw?.gu === 'string' ? raw.gu : (typeof raw?.translations?.gu === 'string' ? raw.translations.gu : undefined),
    preferredTerms,
    doNotTranslate: !!(raw?.doNotTranslate ?? raw?.do_not_translate ?? raw?.noTranslate),
  };
}

function normalizeList(raw: any): GlossaryEntry[] {
  const arr = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.items) ? raw.items
    : (Array.isArray(raw?.data) ? raw.data
    : (Array.isArray(raw?.data?.items) ? raw.data.items : [])));
  return (arr || []).map(normalizeEntry);
}

function entryIdOrKey(e: GlossaryEntry): string {
  const id = e.id ?? e._id;
  if (id && String(id).trim()) return String(id);
  return String(e.key || '').trim();
}

export async function listGlossary(opts?: { q?: string; signal?: AbortSignal }): Promise<GlossaryEntry[]> {
  const qs = new URLSearchParams();
  const q = String(opts?.q || '').trim();
  if (q) qs.set('q', q);
  const url = qs.toString() ? `/admin/glossary?${qs.toString()}` : '/admin/glossary';
  const raw = await adminJson<any>(url, { method: 'GET', signal: opts?.signal, cache: 'no-store' } as any);
  return normalizeList(raw);
}

export async function createGlossary(entry: Omit<GlossaryEntry, 'id' | '_id'>): Promise<GlossaryEntry> {
  const raw = await adminJson<any>('/admin/glossary', { method: 'POST', json: entry });
  return normalizeEntry(raw?.item ?? raw?.data ?? raw);
}

export async function updateGlossary(entry: GlossaryEntry): Promise<GlossaryEntry> {
  const idOrKey = entryIdOrKey(entry);
  const raw = await adminJson<any>(`/admin/glossary/${encodeURIComponent(idOrKey)}`,
    {
      method: 'PUT',
      json: {
        key: entry.key,
        en: entry.en,
        hi: entry.hi,
        gu: entry.gu,
        preferredTerms: entry.preferredTerms,
        doNotTranslate: !!entry.doNotTranslate,
      },
    }
  );
  return normalizeEntry(raw?.item ?? raw?.data ?? raw);
}

export async function deleteGlossary(entry: GlossaryEntry): Promise<{ ok: true } | any> {
  const idOrKey = entryIdOrKey(entry);
  return adminJson<any>(`/admin/glossary/${encodeURIComponent(idOrKey)}`, { method: 'DELETE' });
}
