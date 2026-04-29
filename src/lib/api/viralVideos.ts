import { adminApiClient } from '@/lib/adminApiClient';

export type ViralVideoStatus = 'draft' | 'published';
export type ViralVideoSourceType = 'video_url' | 'embed_url';

export interface ViralVideoRecord {
  _id: string;
  title: string;
  slug: string;
  summary?: string;
  category?: string;
  thumbnailUrl?: string;
  posterImage?: {
    url: string;
    publicId?: string;
  };
  videoUrl?: string;
  embedUrl?: string;
  sourceType: ViralVideoSourceType;
  language: 'en' | 'hi' | 'gu' | string;
  tags: string[];
  status: ViralVideoStatus;
  homepageVisible: boolean;
  homepageFeatured: boolean;
  featured: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
  sortOrder?: number | null;
}

export interface ViralVideoInput {
  title: string;
  slug: string;
  summary?: string;
  category?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  embedUrl?: string;
  sourceType: ViralVideoSourceType;
  language: string;
  tags: string[];
  status: ViralVideoStatus;
  homepageVisible: boolean;
  homepageFeatured: boolean;
  featured: boolean;
  publishedAt?: string | null;
  sortOrder?: number | null;
}

export interface ViralVideoListParams {
  status?: 'all' | ViralVideoStatus;
  language?: string;
  category?: string;
  featured?: boolean;
  homepageVisible?: boolean;
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface ViralVideoListResponse {
  rows: ViralVideoRecord[];
  total: number;
  page: number;
  pages: number;
}

export interface HomepageViralVideoSelection {
  item: ViralVideoRecord | null;
  selectionMode: 'manual' | 'latest' | 'list';
  frontendEnabled: boolean;
}

export interface ViralVideosFrontendSettings {
  frontendEnabled: boolean;
}

const VIRAL_VIDEOS_PATH = 'admin/viral-videos';
const PUBLIC_VIRAL_VIDEOS_PATH = '/admin-api/public/viral-videos';

function unwrapPayload(payload: any) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data;
  }
  return payload;
}

function normalizeRecord(input: any): ViralVideoRecord {
  const poster = input?.posterImage && typeof input.posterImage === 'object'
    ? input.posterImage
    : undefined;
  const thumbnailUrl = String(
    input?.thumbnailUrl
    || poster?.url
    || input?.posterUrl
    || ''
  ).trim();
  const tags = Array.isArray(input?.tags)
    ? input.tags.map((tag: unknown) => String(tag || '').trim()).filter(Boolean)
    : [];
  const sourceType = String(input?.sourceType || (input?.embedUrl ? 'embed_url' : 'video_url')).trim().toLowerCase();
  const status = String(input?.status || '').trim().toLowerCase() === 'published' ? 'published' : 'draft';
  const sortOrderRaw = input?.sortOrder;
  const sortOrder = Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : null;

  return {
    _id: String(input?._id || input?.id || '').trim(),
    title: String(input?.title || '').trim(),
    slug: String(input?.slug || '').trim(),
    summary: String(input?.summary || input?.caption || '').trim() || undefined,
    category: String(input?.category || '').trim() || undefined,
    thumbnailUrl: thumbnailUrl || undefined,
    posterImage: thumbnailUrl ? { url: thumbnailUrl, ...(poster?.publicId ? { publicId: String(poster.publicId) } : {}) } : undefined,
    videoUrl: String(input?.videoUrl || '').trim() || undefined,
    embedUrl: String(input?.embedUrl || '').trim() || undefined,
    sourceType: sourceType === 'embed_url' ? 'embed_url' : 'video_url',
    language: String(input?.language || input?.lang || 'en').trim() || 'en',
    tags,
    status,
    homepageVisible: input?.homepageVisible === true,
    homepageFeatured: input?.homepageFeatured === true || input?.featured === true,
    featured: input?.homepageFeatured === true || input?.featured === true,
    publishedAt: input?.publishedAt ? String(input.publishedAt) : null,
    updatedAt: input?.updatedAt ? String(input.updatedAt) : undefined,
    createdAt: input?.createdAt ? String(input.createdAt) : undefined,
    sortOrder,
  };
}

function normalizeListResponse(payload: any, requestedPage: number, limit: number): ViralVideoListResponse {
  const root = unwrapPayload(payload);
  const rawRows = Array.isArray(root?.items)
    ? root.items
    : (Array.isArray(root?.rows)
      ? root.rows
      : (Array.isArray(root?.data)
        ? root.data
        : (Array.isArray(root?.videos)
          ? root.videos
          : (Array.isArray(root?.viralVideos)
            ? root.viralVideos
            : []))));

  const rows = rawRows.map(normalizeRecord);
  const total = typeof root?.total === 'number'
    ? root.total
    : (typeof root?.count === 'number'
      ? root.count
      : (typeof root?.totalCount === 'number' ? root.totalCount : rows.length));
  const page = typeof root?.page === 'number' ? root.page : requestedPage;
  const pages = typeof root?.pages === 'number' ? root.pages : Math.max(1, Math.ceil(total / limit));

  return { rows, total, page, pages };
}

function buildPayload(input: Partial<ViralVideoInput>) {
  return {
    title: String(input.title || '').trim(),
    slug: String(input.slug || '').trim(),
    summary: String(input.summary || '').trim(),
    category: String(input.category || '').trim(),
    thumbnailUrl: String(input.thumbnailUrl || '').trim(),
    videoUrl: String(input.videoUrl || '').trim(),
    embedUrl: String(input.embedUrl || '').trim(),
    sourceType: input.sourceType === 'embed_url' ? 'embed_url' : 'video_url',
    language: String(input.language || 'en').trim() || 'en',
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
    status: input.status === 'published' ? 'published' : 'draft',
    homepageVisible: input.homepageVisible === true,
    homepageFeatured: input.homepageFeatured === true || input.featured === true,
    featured: input.homepageFeatured === true || input.featured === true,
    publishedAt: input.publishedAt || null,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : null,
  };
}

async function readPublicJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to load viral videos');
    throw new Error(message || 'Failed to load viral videos');
  }
  return response.json() as Promise<T>;
}

function readFrontendEnabled(payload: any, fallback: boolean) {
  if (typeof payload?.settings?.frontendEnabled === 'boolean') return payload.settings.frontendEnabled;
  if (typeof payload?.data?.settings?.frontendEnabled === 'boolean') return payload.data.settings.frontendEnabled;
  if (typeof payload?.frontendEnabled === 'boolean') return payload.frontendEnabled;
  return fallback;
}

export async function listViralVideos(params: ViralVideoListParams = {}): Promise<ViralVideoListResponse> {
  const requestedPage = params.page || 1;
  const limit = params.limit || 20;
  const query: Record<string, unknown> = {
    ...params,
    page: requestedPage,
    limit,
  };
  if (query.status === 'all') delete query.status;
  if (query.featured == null) delete query.featured;
  const res = await adminApiClient.get(VIRAL_VIDEOS_PATH, { params: query });
  return normalizeListResponse(res.data, requestedPage, limit);
}

export async function getViralVideo(id: string): Promise<ViralVideoRecord> {
  const res = await adminApiClient.get(`${VIRAL_VIDEOS_PATH}/${encodeURIComponent(id)}`);
  const payload = unwrapPayload(res.data);
  return normalizeRecord(payload?.item || payload?.viralVideo || payload?.video || payload?.data || payload);
}

export async function createViralVideo(input: ViralVideoInput): Promise<ViralVideoRecord> {
  const res = await adminApiClient.post(VIRAL_VIDEOS_PATH, buildPayload(input));
  const payload = unwrapPayload(res.data);
  return normalizeRecord(payload?.item || payload?.viralVideo || payload?.video || payload?.data || payload);
}

export async function updateViralVideo(id: string, input: Partial<ViralVideoInput>): Promise<ViralVideoRecord> {
  const res = await adminApiClient.patch(`${VIRAL_VIDEOS_PATH}/${encodeURIComponent(id)}`, buildPayload(input));
  const payload = unwrapPayload(res.data);
  return normalizeRecord(payload?.item || payload?.viralVideo || payload?.video || payload?.data || payload);
}

export async function updateViralVideoStatus(
  id: string,
  status: ViralVideoStatus,
  options: { publishedAt?: string | null; homepageFeatured?: boolean; featured?: boolean } = {}
): Promise<ViralVideoRecord> {
  const res = await adminApiClient.patch(`${VIRAL_VIDEOS_PATH}/${encodeURIComponent(id)}/status`, {
    status,
    publishedAt: status === 'published' ? (options.publishedAt || new Date().toISOString()) : null,
    homepageFeatured: status === 'published' ? (options.homepageFeatured === true || options.featured === true) : false,
    featured: status === 'published' ? (options.featured === true || options.homepageFeatured === true) : false,
  });
  const payload = unwrapPayload(res.data);
  return normalizeRecord(payload?.item || payload?.viralVideo || payload?.video || payload?.data || payload);
}

export async function deleteViralVideo(id: string): Promise<void> {
  await adminApiClient.delete(`${VIRAL_VIDEOS_PATH}/${encodeURIComponent(id)}`);
}

export async function listPublicViralVideos(params: { language?: string; category?: string; featuredOnly?: boolean; fallbackLatest?: boolean; limit?: number } = {}): Promise<ViralVideoRecord[]> {
  const query = new URLSearchParams();
  if (params.language) query.set('language', params.language);
  if (params.category) query.set('category', params.category);
  if (params.featuredOnly) query.set('featured', 'true');
  if (params.fallbackLatest) query.set('fallbackLatest', 'true');
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const payload = await readPublicJson<any>(`${PUBLIC_VIRAL_VIDEOS_PATH}${suffix}`);
  const rows = Array.isArray(payload?.items)
    ? payload.items
    : (Array.isArray(payload?.rows) ? payload.rows : []);
  return rows.map(normalizeRecord);
}

export async function listHomepageFeaturedViralVideos(limit = 3): Promise<ViralVideoRecord[]> {
  const rows = await listPublicViralVideos({ featuredOnly: true, fallbackLatest: true, limit });
  return rows.slice(0, limit);
}

export async function getHomepageFeaturedViralVideo(): Promise<HomepageViralVideoSelection> {
  const payload = await readPublicJson<any>(`${PUBLIC_VIRAL_VIDEOS_PATH}/featured`);
  const root = unwrapPayload(payload);
  const rawItem = root?.item || root?.video || root?.viralVideo || root?.featuredVideo || null;
  const rows = Array.isArray(root?.items) ? root.items : [];
  const item = rawItem || rows[0] || null;
  return {
    item: item ? normalizeRecord(item) : null,
    selectionMode: root?.selectionMode === 'latest' ? 'latest' : 'manual',
    frontendEnabled: readFrontendEnabled(payload, true),
  };
}

export async function getPublicViralVideosFrontendSettings(): Promise<ViralVideosFrontendSettings> {
  const payload = await readPublicJson<any>(`${PUBLIC_VIRAL_VIDEOS_PATH}/settings`);
  return {
    frontendEnabled: readFrontendEnabled(payload, true),
  };
}

export async function getAdminViralVideosFrontendSettings(): Promise<ViralVideosFrontendSettings> {
  const res = await adminApiClient.get(`${VIRAL_VIDEOS_PATH}/settings`);
  return {
    frontendEnabled: readFrontendEnabled(res.data, true),
  };
}

export async function updateAdminViralVideosFrontendSettings(frontendEnabled: boolean): Promise<ViralVideosFrontendSettings> {
  const res = await adminApiClient.put(`${VIRAL_VIDEOS_PATH}/settings`, { frontendEnabled });
  return {
    frontendEnabled: readFrontendEnabled(res.data, frontendEnabled),
  };
}
