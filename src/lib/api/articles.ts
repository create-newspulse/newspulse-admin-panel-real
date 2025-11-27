// Consolidated articles API helpers
// NOTE: This file previously had duplicated sections causing "Cannot redeclare" errors.
// We merge functionality into a single set of exports using the existing apiClient.

import apiClient from '@/lib/api';
import type { ArticleStatus } from '@/types/articles';

export interface Article {
  _id: string;
  title: string;
  slug?: string;
  summary?: string;
  content?: string;
  category?: string;
  status?: ArticleStatus;
  author?: { name?: string };
  language?: string;
  ptiCompliance?: string;
  trustScore?: number;
  createdAt?: string;
  updatedAt?: string;
  publishAt?: string;
  scheduledAt?: string;
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

const ADMIN_ARTICLES_PATH = '/articles';

// --- Core list & actions ---
export async function listArticles(params: {
  status?: 'all' | ArticleStatus;
  category?: string;
  language?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
}): Promise<ListResponse> {
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
  const raw = res.data as any;
  const ok = raw?.ok === true || raw?.success === true || !!raw?.article || !!raw?.data;
  const article = (raw?.article)
    || (raw?.data?.article)
    || (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : null);
  if (!ok || !article || !article._id) {
    throw new Error('Failed to get article');
  }
  return article as Article;
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

// --- Control tower helpers ---
export async function updateArticleStatus(id: string, status: ArticleStatus) {
  // Prefer dedicated status route if backend supports it; fallback to generic update
  try {
    const res = await apiClient.patch(`${ADMIN_ARTICLES_PATH}/${id}/status`, { status });
    return res.data as Article;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const res2 = await apiClient.patch(`${ADMIN_ARTICLES_PATH}/${id}`, { status });
      return res2.data as Article;
    }
    throw err;
  }
}

export async function scheduleArticle(id: string, publishAt: string) {
  // Prefer dedicated schedule route; fallback to generic update with status
  try {
    const res = await apiClient.patch(`${ADMIN_ARTICLES_PATH}/${id}/schedule`, { publishAt });
    return res.data as Article;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const res2 = await apiClient.patch(`${ADMIN_ARTICLES_PATH}/${id}`, { status: 'scheduled', publishAt });
      return res2.data as Article;
    }
    throw err;
  }
}

export async function unscheduleArticle(id: string) {
  // Clear schedule and revert to draft
  const res = await apiClient.patch(`${ADMIN_ARTICLES_PATH}/${id}`, { status: 'draft', publishAt: null, scheduledAt: null });
  return res.data as Article;
}

export async function deleteArticleSoft(id: string) {
  await apiClient.delete(`${ADMIN_ARTICLES_PATH}/${id}`);
}

export async function deleteArticleHard(id: string) {
  await apiClient.delete(`${ADMIN_ARTICLES_PATH}/${id}`, { params: { hard: true } });
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
