import { adminApiClient } from '@/lib/adminApiClient';
import type { PulseDialogueContributor } from '@/lib/pulseDialogue';

const CONTRIBUTORS_PATH = 'admin/pulse-dialogue/contributors';

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

export async function updatePulseDialogueContributor(id: string, data: Partial<PulseDialogueContributor>): Promise<PulseDialogueContributor> {
  const res = await adminApiClient.put(`${CONTRIBUTORS_PATH}/${encodeURIComponent(id)}`, data);
  return extractContributor(res.data);
}