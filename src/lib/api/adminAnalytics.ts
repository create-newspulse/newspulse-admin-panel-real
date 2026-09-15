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
  pageViews?: number | string;
  views?: number | string;
  totalViews?: number | string;
  uniqueVisitors?: number | string;
  uniqueReaders?: number | string;
  readers?: number | string;
  totals?: {
    pageViews?: number | string;
    views?: number | string;
    totalViews?: number | string;
    uniqueVisitors?: number | string;
    uniqueReaders?: number | string;
    readers?: number | string;
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

export type AdPerformanceAnalyticsResponse = {
  connected?: boolean;
  source?: string;
  scope?: string;
  dateRangeSupported?: boolean;
  message?: string;
  metrics?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  impressions?: number | string;
  clicks?: number | string;
  ctr?: number | string;
  totalAds?: number | string;
  activeAds?: number | string;
  total?: number | string;
  active?: number | string;
  adsWithActivity?: number | string;
  daily?: unknown[];
  dailyTrend?: unknown[];
  trend?: unknown[];
  days?: unknown[];
  ads?: unknown[];
  perAd?: unknown[];
  perAds?: unknown[];
  perAdPerformance?: unknown[];
  adPerformance?: unknown[];
  placements?: unknown[];
  perPlacement?: unknown[];
  placementPerformance?: unknown[];
  topAds?: unknown;
  topByImpressions?: unknown[];
  topByClicks?: unknown[];
  topByCtr?: unknown[];
};

export type AdPerformanceAnalyticsRange = 'today' | '7d' | '30d' | 'custom';

export type AdPerformanceAnalyticsFilters = {
  range?: AdPerformanceAnalyticsRange;
  from?: string;
  to?: string;
};

export type RevenueAnalyticsFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type RevenueAnalyticsResponse = {
  connected?: boolean;
  source?: string;
  message?: string;
  metrics?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  totalRevenue?: number | string;
  paidAmount?: number | string;
  outstandingAmount?: number | string;
  recordCount?: number | string;
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

export async function getAdminAnalyticsAdPerformance(filters: AdPerformanceAnalyticsFilters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
  const res = Object.keys(params).length
    ? await adminApi.get('/analytics/ad-performance', { params })
    : await adminApi.get('/analytics/ad-performance');
  return unwrap<AdPerformanceAnalyticsResponse>((res as any)?.data);
}

export async function getAdminAnalyticsRevenue(filters: RevenueAnalyticsFilters = {}) {
  const res = await adminApi.get('/analytics/revenue', { params: filters });
  return unwrap<RevenueAnalyticsResponse>((res as any)?.data);
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
