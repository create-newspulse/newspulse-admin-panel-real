import { adminApiClient } from '@/lib/adminApiClient';
import { z } from 'zod';
import type { PulseDialogueContributor, PulseDialogueSeries } from '@/lib/pulseDialogue';

const CONTRIBUTORS_PATH = 'admin/pulse-dialogue/contributors';
const SERIES_PATH = 'admin/pulse-dialogue/series';

const contributorCapabilitiesSchema = z.object({ slugRename: z.boolean() });
const capabilitiesResponseSchema = z.object({
  ok: z.literal(true),
  success: z.literal(true),
  capabilities: contributorCapabilitiesSchema.optional(),
  data: z.object({ capabilities: contributorCapabilitiesSchema.optional() }).optional(),
});

export async function getPulseDialogueContributorCapabilities(signal?: AbortSignal): Promise<{ slugRename: boolean }> {
  try {
    const response = await adminApiClient.get(`${CONTRIBUTORS_PATH}/capabilities`, {
      signal,
      timeout: 5000,
      headers: { 'Cache-Control': 'no-store' },
    });
    const parsed = capabilitiesResponseSchema.safeParse(response.data);
    if (!parsed.success) return { slugRename: false };
    const values = [parsed.data.capabilities, parsed.data.data?.capabilities].filter((value) => value !== undefined);
    return { slugRename: values.length > 0 && values.every((value) => value?.slugRename === true) };
  } catch {
    return { slugRename: false };
  }
}

export type ContributorProfileInput = Omit<Partial<PulseDialogueContributor>, 'slug'>;
export type SeriesCreateInput = Pick<PulseDialogueSeries, 'title'> & Partial<Pick<PulseDialogueSeries, 'slug' | 'description' | 'ownerContributorId' | 'profileVisible'>>;
export type SeriesUpdateInput = Omit<SeriesCreateInput, 'slug'>;

export type ListPulseDialogueContributorsParams = {
  q?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export type ListPulseDialogueContributorsResponse = {
  items: PulseDialogueContributor[];
  total: number;
  page: number;
  limit: number;
};

function normalizeContributor(raw: any): PulseDialogueContributor {
  return {
    ...(raw && typeof raw === 'object' ? raw : {}),
    id: raw?.id || (raw?._id ? String(raw._id) : null),
    socialLinks: raw?.socialLinks && typeof raw.socialLinks === 'object' ? raw.socialLinks : {},
    rightsConsent: raw?.rightsConsent && typeof raw.rightsConsent === 'object' ? raw.rightsConsent : {},
  };
}

function extractContributor(raw: any): PulseDialogueContributor {
  const contributor = raw?.contributor || raw?.data?.contributor || raw?.data || raw;
  return normalizeContributor(contributor);
}

export async function listPulseDialogueContributors(params: ListPulseDialogueContributorsParams = {}): Promise<ListPulseDialogueContributorsResponse> {
  const query = {
    page: params.page || 1,
    limit: params.limit || 20,
    ...(params.q || params.search ? { q: params.q || params.search } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
  };
  const res = await adminApiClient.get(CONTRIBUTORS_PATH, { params: query });
  const raw = res.data as any;
  const itemsRaw = Array.isArray(raw?.items)
    ? raw.items
    : (Array.isArray(raw?.contributors)
      ? raw.contributors
      : (Array.isArray(raw?.data?.items) ? raw.data.items : []));
  return {
    items: itemsRaw.map(normalizeContributor),
    total: Number(raw?.total ?? raw?.data?.total ?? itemsRaw.length) || 0,
    page: Number(raw?.page ?? raw?.data?.page ?? query.page) || query.page,
    limit: Number(raw?.limit ?? raw?.data?.limit ?? query.limit) || query.limit,
  };
}

export async function getPulseDialogueContributor(id: string): Promise<PulseDialogueContributor> {
  const res = await adminApiClient.get(`${CONTRIBUTORS_PATH}/${encodeURIComponent(id)}`);
  return extractContributor(res.data);
}

export async function createPulseDialogueContributor(data: Partial<PulseDialogueContributor>): Promise<PulseDialogueContributor> {
  const res = await adminApiClient.post(CONTRIBUTORS_PATH, data);
  return extractContributor(res.data);
}

export async function updatePulseDialogueContributor(id: string, data: ContributorProfileInput): Promise<PulseDialogueContributor> {
  const { slug: _slug, ...profile } = data as Partial<PulseDialogueContributor>;
  const res = await adminApiClient.put(`${CONTRIBUTORS_PATH}/${encodeURIComponent(id)}`, profile);
  return extractContributor(res.data);
}

export async function changePulseDialogueContributorSlug(id: string, slug: string): Promise<PulseDialogueContributor> {
  const res = await adminApiClient.patch(`${CONTRIBUTORS_PATH}/${encodeURIComponent(id)}/slug`, { slug });
  return extractContributor(res.data);
}

function normalizeSeries(raw: any): PulseDialogueSeries {
  return {
    id: String(raw?.id || raw?._id || ''),
    title: String(raw?.title || ''),
    slug: String(raw?.slug || ''),
    description: raw?.description ?? null,
    ownerContributorId: raw?.ownerContributorId == null ? null : String(raw.ownerContributorId?.id || raw.ownerContributorId?._id || raw.ownerContributorId),
    profileVisible: raw?.profileVisible ?? true,
  };
}

function extractSeries(raw: any): PulseDialogueSeries {
  return normalizeSeries(raw?.series || raw?.data?.series || raw?.data || raw);
}

export async function listPulseDialogueSeries(params: { page?: number; limit?: number } = {}) {
  const query = { page: params.page || 1, limit: params.limit || 20 };
  const res = await adminApiClient.get(SERIES_PATH, { params: query });
  const raw = res.data as any;
  const data = raw?.data || raw;
  const items = Array.isArray(data) ? data : (data?.items || data?.series || []);
  return {
    items: (Array.isArray(items) ? items : []).map(normalizeSeries),
    total: Number(data?.total ?? items.length) || 0,
    page: Number(data?.page ?? query.page),
    limit: Number(data?.limit ?? query.limit),
  };
}

export async function getPulseDialogueSeries(id: string): Promise<PulseDialogueSeries> {
  const res = await adminApiClient.get(`${SERIES_PATH}/${encodeURIComponent(id)}`);
  return extractSeries(res.data);
}

export async function createPulseDialogueSeries(data: SeriesCreateInput): Promise<PulseDialogueSeries> {
  const res = await adminApiClient.post(SERIES_PATH, data);
  return extractSeries(res.data);
}

export async function updatePulseDialogueSeries(id: string, data: SeriesUpdateInput): Promise<PulseDialogueSeries> {
  const { slug: _slug, ...profile } = data as SeriesCreateInput;
  const res = await adminApiClient.put(`${SERIES_PATH}/${encodeURIComponent(id)}`, profile);
  return extractSeries(res.data);
}