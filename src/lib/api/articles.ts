// Consolidated articles API helpers
// NOTE: This file previously had duplicated sections causing "Cannot redeclare" errors.
// We merge functionality into a single set of exports using the existing apiClient.

import apiClient from '@/lib/api';

export interface Article {
  _id: string;
  title: string;
  slug?: string;
  summary?: string;
  content?: string;
  category?: string;
  status?: string;
  author?: { name?: string };
  language?: string;
  ptiCompliance?: string;
  trustScore?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ListResponse {
  data: Article[];
  page: number;
  pages: number;
  total: number;
}

// --- Core list & actions ---
export async function listArticles(params: Record<string, any>): Promise<ListResponse> {
  const res = await apiClient.get('/articles', { params });
  return res.data;
}
export async function getArticle(id: string): Promise<Article> {
  const res = await apiClient.get(`/articles/${id}`);
  return res.data;
}
export async function archiveArticle(id: string) {
  const res = await apiClient.patch(`/articles/${id}/archive`);
  return res.data;
}
export async function restoreArticle(id: string) {
  const res = await apiClient.patch(`/articles/${id}/restore`);
  return res.data;
}
export async function deleteArticle(id: string) {
  const res = await apiClient.delete(`/articles/${id}`);
  return res.data;
}

// Optional extra helpers (create/update/meta) if needed by other screens
export async function createArticle(data: Partial<Article>) {
  const res = await apiClient.post('/articles', data);
  return res.data;
}
export async function updateArticle(id: string, data: Partial<Article>) {
  const res = await apiClient.put(`/articles/${id}`, data);
  return res.data;
}
export async function metaCounts(): Promise<{ total: number }> {
  const res = await apiClient.get('/articles/meta');
  return res.data;
}
