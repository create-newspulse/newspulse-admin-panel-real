import { api } from './client';

export interface AdminDraft {
  _id: string; // draft id
  articleId?: string; // underlying article id
  headline?: string; // primary display headline
  title?: string; // fallback legacy title
  language?: string;
  category?: string;
  source?: 'community' | 'editor' | 'pro' | 'founder' | string;
  status?: 'draft' | 'deleted' | string;
  createdAt?: string;
}

export interface DraftListParams {
  deleted?: 0 | 1; // 0 = not deleted, 1 = deleted
  source?: 'community' | 'editor' | 'pro' | 'founder';
  search?: string; // maps to q (headline search)
  page?: number;
  limit?: number;
}

export interface DraftListResponseEnvelope { data?: AdminDraft[]; drafts?: AdminDraft[]; }

function extractDraftArray(raw: any): AdminDraft[] {
  if (Array.isArray(raw)) return raw as AdminDraft[];
  if (Array.isArray(raw?.data)) return raw.data as AdminDraft[];
  if (Array.isArray(raw?.drafts)) return raw.drafts as AdminDraft[];
  if (Array.isArray(raw?.data?.drafts)) return raw.data.drafts as AdminDraft[];
  return [];
}

export async function listDrafts(params: DraftListParams = {}) {
  const { deleted, source, search, page, limit } = params;
  const query: Record<string, any> = {};
  if (typeof deleted === 'number') query.deleted = deleted;
  if (source && source !== 'all') query.source = source;
  if (search) query.q = search;
  if (page) query.page = page;
  if (limit) query.limit = limit;
  const { data } = await api.get('/api/admin/drafts', { params: query });
  return extractDraftArray(data);
}

export async function deleteDraft(id: string) {
  const { data } = await api.post(`/api/admin/drafts/${id}/delete`);
  return data;
}

export async function restoreDraft(id: string) {
  const { data } = await api.post(`/api/admin/drafts/${id}/restore`);
  return data;
}

// Optional permanent delete (hard delete). Backend support assumed; falls back silently if not available.
export async function hardDeleteDraft(id: string) {
  try {
    const { data } = await api.post(`/api/admin/drafts/${id}/hard-delete`);
    return data;
  } catch (e) {
    // If backend doesn't support hard-delete yet, rethrow for caller to handle.
    throw e;
  }
}