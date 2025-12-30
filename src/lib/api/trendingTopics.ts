import { adminJson } from '@/lib/http/adminFetch';

export type TrendingTopic = {
  id: string;
  order: number;
  label: string;
  href: string;
  colorKey: string;
  enabled: boolean;
};

type RawTopic = Record<string, any>;

function pickId(t: RawTopic): string {
  return String(t?.id || t?._id || t?.topicId || '');
}

function normalizeTopic(t: RawTopic, index: number): TrendingTopic {
  const orderRaw = t?.order ?? t?.position ?? t?.rank ?? index + 1;
  const order = typeof orderRaw === 'number' ? orderRaw : Number(orderRaw) || index + 1;

  const label = String(t?.label ?? t?.name ?? '').trim();
  const href = String(t?.href ?? t?.url ?? t?.link ?? '').trim();
  const colorKey = String(t?.colorKey ?? t?.color ?? '').trim();
  const enabled = typeof t?.enabled === 'boolean' ? t.enabled : Boolean(t?.isEnabled ?? t?.active ?? true);

  return {
    id: pickId(t),
    order,
    label,
    href,
    colorKey,
    enabled,
  };
}

function extractList(res: any): RawTopic[] {
  if (Array.isArray(res)) return res as RawTopic[];
  if (Array.isArray(res?.items)) return res.items as RawTopic[];
  if (Array.isArray(res?.topics)) return res.topics as RawTopic[];
  if (Array.isArray(res?.data)) return res.data as RawTopic[];
  if (Array.isArray(res?.result)) return res.result as RawTopic[];
  return [];
}

export async function listTrendingTopics(): Promise<TrendingTopic[]> {
  const res = await adminJson<any>('/api/admin/trending-topics', { cache: 'no-store' } as any);
  const raw = extractList(res);
  const normalized = raw.map((t, idx) => normalizeTopic(t, idx)).filter((t) => !!t.id);
  // Stable sort by order, then label
  normalized.sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label));
  return normalized;
}

export async function addTrendingTopic(input: { label: string; href: string; colorKey: string }): Promise<void> {
  await adminJson('/api/admin/trending-topics', {
    method: 'POST',
    json: {
      label: input.label,
      href: input.href,
      colorKey: input.colorKey,
    },
  } as any);
}

export async function patchTrendingTopic(
  id: string,
  patch: Partial<{ label: string; href: string; colorKey: string; enabled: boolean; order: number }>
): Promise<void> {
  const safeId = encodeURIComponent(String(id));
  await adminJson(`/api/admin/trending-topics/${safeId}`, {
    method: 'PATCH',
    json: patch,
  } as any);
}

export async function deleteTrendingTopic(id: string): Promise<void> {
  const safeId = encodeURIComponent(String(id));
  await adminJson(`/api/admin/trending-topics/${safeId}`, { method: 'DELETE' } as any);
}

export async function resetTrendingTopics(): Promise<void> {
  await adminJson('/api/admin/trending-topics/reset', { method: 'POST' } as any);
}
