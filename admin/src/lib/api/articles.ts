import { api } from './client';

export interface ArticleInput {
  title: string;
  slug?: string;
  summary?: string;
  content?: string;
  category?: string;
  tags?: string[];
  status?: string;
  language?: 'en'|'hi'|'gu';
  scheduledAt?: string;
  publishedAt?: string;
  ptiCompliance?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  coverImage?: { url: string; publicId?: string };
}

// Minimal admin-facing article shape used for filtering & actions
export interface AdminArticle {
  _id: string;
  title?: string;
  language?: 'en'|'hi'|'gu'|string;
  status?: 'draft'|'scheduled'|'published'|'archived'|'deleted'|string;
  source?: 'community'|'editor'|string;
}

export interface AdminArticleListParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  language?: 'en'|'hi'|'gu';
  q?: string;
  from?: string; // yyyy-mm-dd
  to?: string;   // yyyy-mm-dd
  sort?: string; // -createdAt etc.
}

export async function listArticles(params: AdminArticleListParams = {}) {
  // Admin endpoint for listing articles; use status filter like 'draft'.
  const { data } = await api.get('/api/admin/articles', { params });
  return data;
}
export async function getArticle(id: string) {
  const { data } = await api.get(`/api/admin/articles/${id}`);
  return data;
}
export async function createArticle(body: ArticleInput) {
  const { data } = await api.post('/api/admin/articles', body);
  return data;
}
export async function updateArticle(id: string, body: ArticleInput) {
  const { data } = await api.put(`/api/admin/articles/${id}`, body);
  return data;
}
export async function archiveArticle(id: string) {
  const { data } = await api.patch(`/api/admin/articles/${id}/archive`);
  return data;
}
export async function restoreArticle(id: string) {
  const { data } = await api.patch(`/api/admin/articles/${id}/restore`);
  return data;
}
export async function deleteArticle(id: string) {
  // Soft delete via admin endpoint (kept for non-draft flows)
  const { data } = await api.delete(`/api/admin/articles/${id}`);
  return data;
}

export async function hardDeleteArticle(id: string) {
  // Primary hard-delete route; backend also supports DELETE with ?hard=true
  try {
    const { data } = await api.post(`/api/admin/articles/${id}/hard-delete`);
    return data;
  } catch (e) {
    const { data } = await api.delete(`/api/admin/articles/${id}`, { params: { hard: 'true' } });
    return data;
  }
}
