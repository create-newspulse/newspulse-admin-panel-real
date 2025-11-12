import apiClient from '@/lib/api';

export async function ptiCheck(body: { title?: string; content?: string }) {
  const { data } = await apiClient.post('/compliance/pti-check', body);
  return data as { status: 'compliant'|'needs_review'; reasons: string[] };
}
