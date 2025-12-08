import { api } from './client';

export async function ptiCheck(body: { title?: string; content?: string }) {
  const { data } = await api.post('/api/compliance/pti-check', body);
  return data as { status: 'compliant'|'needs_review'; reasons: string[] };
}
