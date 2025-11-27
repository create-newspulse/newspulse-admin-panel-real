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
  const { data } = await api.get('/api/articles', { params });
  return data;
}
export async function getArticle(id: string) {
  const { data } = await api.get(`/api/articles/${id}`);
  return data;
}
export async function createArticle(body: ArticleInput) {
  const { data } = await api.post('/api/articles', body);
  return data;
}
export async function updateArticle(id: string, body: ArticleInput) {
  const { data } = await api.put(`/api/articles/${id}`, body);
  return data;
}
export async function archiveArticle(id: string) {
  const { data } = await api.patch(`/api/articles/${id}/archive`);
  return data;
}
export async function restoreArticle(id: string) {
  const { data } = await api.patch(`/api/articles/${id}/restore`);
  return data;
}
export async function deleteArticle(id: string) {
  const { data } = await api.delete(`/api/articles/${id}`);
  return data;
}
