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

interface ApiResponse {
  ok: boolean;
  items?: Article[];
  total?: number;
  article?: Article;
  message?: string;
}

interface ListResponse {
  data: Article[];
  page: number;
  pages: number;
  total: number;
}

const ADMIN_ARTICLES_PATH = '/admin/articles';

// --- Core list & actions ---
export async function listArticles(params: Record<string, any>): Promise<ListResponse> {
  // Translate frontend param `status: 'all'` to backend `status: undefined`
  if (params.status === 'all') {
    delete params.status;
  }
  const res = await apiClient.get(ADMIN_ARTICLES_PATH, { params });
  const { ok, items = [], total = 0 } = res.data as ApiResponse;
  if (!ok) throw new Error('Failed to list articles');
  
  const limit = params.limit || 20;
  return {
    data: items,
    total,
    page: params.page || 1,
    pages: Math.ceil(total / limit),
  };
}
export async function getArticle(id: string): Promise<Article> {
  const res = await apiClient.get(`${ADMIN_ARTICLES_PATH}/${id}`);
  const { ok, article } = res.data as ApiResponse;
  if (!ok || !article) throw new Error('Failed to get article');
  return article;
}
export async function archiveArticle(id: string) {
  const res = await apiClient.patch(`${ADMIN_ARTICLES_PATH}/${id}/archive`);
  return res.data;
}
export async function restoreArticle(id: string) {
  const res = await apiClient.patch(`${ADMIN_ARTICLES_PATH}/${id}/restore`);
  return res.data;
}
export async function deleteArticle(id: string) {
  const res = await apiClient.delete(`${ADMIN_ARTICLES_PATH}/${id}`);
  return res.data;
}

// Optional extra helpers (create/update/meta) if needed by other screens
export async function createArticle(data: Partial<Article>) {
  const res = await apiClient.post(ADMIN_ARTICLES_PATH, data);
  return res.data;
}
export async function updateArticle(id: string, data: Partial<Article>) {
  const res = await apiClient.put(`${ADMIN_ARTICLES_PATH}/${id}`, data);
  return res.data;
}
export async function metaCounts(): Promise<{ total: number }> {
  const res = await apiClient.get(`${ADMIN_ARTICLES_PATH}/meta`);
  return res.data;
}
