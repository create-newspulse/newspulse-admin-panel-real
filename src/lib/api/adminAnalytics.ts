import { adminApi } from '@/lib/api';

export type AnalyticsRangeKey = '24h' | '7d' | '30d' | 'custom';

export type AnalyticsCommonFilters = {
  range?: AnalyticsRangeKey;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  status?: string;
  category?: string;
  language?: string;
};

export type DashboardAnalyticsResponse = {
  totals?: {
    views?: number;
    totalViews?: number;
    uniqueReaders?: number;
    readers?: number;
    engagedReads?: number;
    engaged?: number;
    avgReadTimeSec?: number;
    avgReadTimeSeconds?: number;
    avgReadTime?: number; // seconds
    completionRate?: number; // 0..1 or 0..100
    scrollCompletion?: number; // 0..1 or 0..100
  };
  topSource?: { source?: string; views?: number };
  sources?: Array<{ source?: string; views?: number; readers?: number }>;
  languages?: Array<{ language?: string; views?: number; readers?: number }>;
  languageBreakdown?: Record<string, number>;
};

export type ArticlesAnalyticsRow = {
  articleId: string;
  title?: string;
  views?: number;
  uniqueReaders?: number;
  readers?: number;
  engagedReads?: number;
  avgReadTimeSec?: number;
  completionRate?: number;
};

export type ArticlesAnalyticsListResponse = {
  rows?: ArticlesAnalyticsRow[];
  items?: ArticlesAnalyticsRow[];
};

export type ArticleAnalyticsBreakdownRow = {
  key: string;
  views?: number;
  readers?: number;
};

export type ArticleAnalyticsRange = {
  totals?: {
    views?: number;
    uniqueReaders?: number;
    readers?: number;
    engagedReads?: number;
    avgReadTimeSec?: number;
    completionRate?: number;
  };
  scrollFunnel?: {
    p25?: number;
    p50?: number;
    p75?: number;
    p100?: number;
    // tolerate alternative keys
    '25'?: number;
    '50'?: number;
    '75'?: number;
    '100'?: number;
  };
  sources?: Array<{ source?: string; views?: number; readers?: number }>;
  languages?: Array<{ language?: string; views?: number; readers?: number }>;
};

export type ArticleAnalyticsResponse = {
  articleId?: string;
  ranges?: Partial<Record<'24h' | '7d' | '30d', ArticleAnalyticsRange>>;
  byRange?: Partial<Record<'24h' | '7d' | '30d', ArticleAnalyticsRange>>;
  totals?: ArticleAnalyticsRange['totals'];
  scrollFunnel?: ArticleAnalyticsRange['scrollFunnel'];
  sources?: ArticleAnalyticsRange['sources'];
  languages?: ArticleAnalyticsRange['languages'];
};

export type CategoryAnalyticsRow = {
  category: string;
  views?: number;
  uniqueReaders?: number;
  readers?: number;
  engagedReads?: number;
  avgReadTimeSec?: number;
  completionRate?: number;
  topArticles?: Array<{ articleId: string; title?: string; views?: number }>;
};

export type CategoriesAnalyticsResponse = {
  rows?: CategoryAnalyticsRow[];
  items?: CategoryAnalyticsRow[];
};

function unwrap<T = any>(raw: any): T {
  // common backend shapes: { ok:true, data }, { success:true, data }, { data }, or plain
  if (raw && typeof raw === 'object') {
    if ('data' in raw) return (raw as any).data as T;
    if ('result' in raw) return (raw as any).result as T;
  }
  return raw as T;
}

export async function getAdminAnalyticsDashboard(filters: AnalyticsCommonFilters = {}) {
  const res = await adminApi.get('/analytics/dashboard', { params: filters });
  return unwrap<DashboardAnalyticsResponse>((res as any)?.data);
}

export async function listAdminAnalyticsArticles(filters: AnalyticsCommonFilters & { page?: number; limit?: number } = {}) {
  const res = await adminApi.get('/analytics/articles', { params: filters });
  return unwrap<ArticlesAnalyticsListResponse>((res as any)?.data);
}

export async function getAdminAnalyticsArticle(articleId: string, filters: AnalyticsCommonFilters = {}) {
  const safe = encodeURIComponent(String(articleId));
  const res = await adminApi.get(`/analytics/articles/${safe}`, { params: filters });
  return unwrap<ArticleAnalyticsResponse>((res as any)?.data);
}

export async function listAdminAnalyticsCategories(filters: AnalyticsCommonFilters = {}) {
  const res = await adminApi.get('/analytics/categories', { params: filters });
  return unwrap<CategoriesAnalyticsResponse>((res as any)?.data);
}
