import { CommunitySubmission } from '@/types/CommunitySubmission';
import { adminApi } from '@/lib/adminApi';
import { debug } from '@/lib/debug';

// Legacy-style simple fetch without AI/risk mapping
export async function fetchCommunitySubmissions(): Promise<CommunitySubmission[]> {
  const res = await fetch('/api/admin/community-reporter');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data ?? []).map((s: any) => ({
    id: String(s.id ?? s._id ?? s.ID ?? s.uuid ?? ''),
    headline: s.headline ?? '',
    body: s.body ?? '',
    category: s.category ?? '',
    status: s.status ?? 'pending',
    ...s,
  }));
}

export async function fetchCommunitySubmissionById(id: string): Promise<CommunitySubmission> {
  const path = `/api/admin/community-reporter/submissions/${id}`;
  try {
    const res = await adminApi.get(path);
    const s = res.data?.submission ?? res.data ?? {};
    return {
      id: String(s.id ?? s._id ?? s.ID ?? s.uuid ?? id),
      headline: s.headline ?? '',
      body: s.body ?? '',
      category: s.category ?? '',
      status: s.status ?? 'pending',
      ...s,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    if (status) throw new Error(`HTTP ${status}`);
    throw e;
  }
}

export async function fetchCommunityReporterSubmissions() {
  const path = '/api/admin/community-reporter/submissions';
  const res = await adminApi.get(path);
  if (import.meta.env.DEV) debug('[communityReporterApi] GET', path, 'status=', res.status);
  return res.data;
}
