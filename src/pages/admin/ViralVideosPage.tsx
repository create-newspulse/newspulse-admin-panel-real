import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import Switch from '@/components/settings/Switch';
import {
  getAdminViralVideosFrontendSettings,
  createViralVideo,
  deleteViralVideo,
  getViralVideo,
  getHomepageFeaturedViralVideo,
  listViralVideos,
  updateAdminViralVideosFrontendSettings,
  updateViralVideo,
  updateViralVideoStatus,
  type HomepageViralVideoSelection,
  type ViralVideoInput,
  type ViralVideoRecord,
  type ViralVideosFrontendSettings,
} from '@/lib/api/viralVideos';

const FRONTEND_VISIBILITY_TOAST_ID = 'viral-videos-frontend-visibility';

type EditorState = {
  title: string;
  slug: string;
  summary: string;
  category: string;
  thumbnailUrl: string;
  sourceType: 'video_url' | 'embed_url';
  videoUrl: string;
  embedUrl: string;
  language: string;
  tags: string;
  publish: boolean;
  featured: boolean;
  publishedAt: string;
  sortOrder: string;
};

const EMPTY_EDITOR: EditorState = {
  title: '',
  slug: '',
  summary: '',
  category: '',
  thumbnailUrl: '',
  sourceType: 'video_url',
  videoUrl: '',
  embedUrl: '',
  language: 'en',
  tags: '',
  publish: false,
  featured: false,
  publishedAt: '',
  sortOrder: '',
};

function slugify(input: string) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '-';
}

function toPayload(state: EditorState, nextStatus: 'draft' | 'published'): ViralVideoInput {
  const tags = state.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  const publishedAt = nextStatus === 'published'
    ? (state.publishedAt ? new Date(state.publishedAt).toISOString() : new Date().toISOString())
    : null;

  return {
    title: state.title.trim(),
    slug: slugify(state.slug || state.title),
    summary: state.summary.trim(),
    category: state.category.trim(),
    thumbnailUrl: state.thumbnailUrl.trim(),
    videoUrl: state.videoUrl.trim(),
    embedUrl: state.embedUrl.trim(),
    sourceType: state.sourceType,
    language: state.language,
    tags,
    status: nextStatus,
    homepageVisible: nextStatus === 'published',
    homepageFeatured: nextStatus === 'published' && state.featured,
    featured: state.featured,
    publishedAt,
    sortOrder: state.sortOrder.trim() ? Number(state.sortOrder) : null,
  };
}

function fromRecord(record: ViralVideoRecord): EditorState {
  return {
    title: record.title || '',
    slug: record.slug || '',
    summary: record.summary || '',
    category: record.category || '',
    thumbnailUrl: record.thumbnailUrl || '',
    sourceType: record.sourceType || 'video_url',
    videoUrl: record.videoUrl || '',
    embedUrl: record.embedUrl || '',
    language: record.language || 'en',
    tags: Array.isArray(record.tags) ? record.tags.join(', ') : '',
    publish: record.status === 'published',
    featured: record.featured === true,
    publishedAt: toDateTimeLocal(record.publishedAt),
    sortOrder: Number.isFinite(Number(record.sortOrder)) ? String(record.sortOrder) : '',
  };
}

function getAdminToken(): string {
  try {
    return localStorage.getItem('admin_token') || localStorage.getItem('np_token') || '';
  } catch {
    return '';
  }
}

async function uploadViralVideoThumbnail(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('thumbnail', file);

  const token = getAdminToken();
  const resp = await fetch('/admin-api/admin/viral-videos/thumbnail-upload', {
    method: 'POST',
    body: fd,
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let payload: any = null;
  try {
    payload = await resp.json();
  } catch {
    payload = null;
  }

  if (!resp.ok || payload?.ok === false) {
    const msg = payload?.message || payload?.error || `Thumbnail upload failed (${resp.status})`;
    throw new Error(String(msg));
  }

  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const url = String(data?.url || payload?.url || '').trim();
  if (!url) throw new Error('Thumbnail upload succeeded but no URL was returned');
  return { url };
}

async function uploadViralVideoFile(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('video', file);

  const token = getAdminToken();
  const resp = await fetch('/admin-api/admin/viral-videos/upload', {
    method: 'POST',
    body: fd,
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let payload: any = null;
  try {
    payload = await resp.json();
  } catch {
    payload = null;
  }

  if (!resp.ok || payload?.ok === false) {
    const msg = payload?.message || payload?.error || payload?.data?.message || `Video upload failed (${resp.status})`;
    throw new Error(String(msg));
  }

  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const url = String(data?.url || payload?.url || '').trim();
  if (!url) throw new Error('Video upload succeeded but no URL was returned');
  return { url };
}

export default function ViralVideosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const queryClient = useQueryClient();
  const editingId = params.id;
  const isCreateRoute = location.pathname.endsWith('/new');
  const isEditorOpen = isCreateRoute || Boolean(editingId);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured'>('all');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [slugTouched, setSlugTouched] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const userRole = String(user?.role || '').trim().toLowerCase();
  const canManageFrontendVisibility = userRole === 'founder' || userRole === 'admin';

  const listQuery = useQuery({
    queryKey: ['viral-videos', 'admin-list', statusFilter, languageFilter, featuredFilter, search],
    queryFn: () => listViralVideos({
      status: statusFilter,
      language: languageFilter === 'all' ? undefined : languageFilter,
      featured: featuredFilter === 'featured' ? true : undefined,
      q: search.trim() || undefined,
      page: 1,
      limit: 50,
      sort: 'sortOrder,-publishedAt,-updatedAt',
    }),
  });

  const itemQuery = useQuery({
    queryKey: ['viral-videos', 'admin-item', editingId],
    queryFn: () => getViralVideo(editingId!),
    enabled: Boolean(editingId),
  });

  const homepageFeatureQuery = useQuery({
    queryKey: ['viral-videos', 'homepage-featured', 'admin-preview'],
    queryFn: () => getHomepageFeaturedViralVideo(),
    staleTime: 30_000,
  });

  const frontendSettingsQuery = useQuery({
    queryKey: ['viral-videos', 'frontend-settings', 'admin'],
    queryFn: () => getAdminViralVideosFrontendSettings(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isEditorOpen) {
      setEditor(EMPTY_EDITOR);
      setSlugTouched(false);
      setShowPreview(false);
      return;
    }

    if (editingId && itemQuery.data) {
      setEditor(fromRecord(itemQuery.data));
      setSlugTouched(true);
      return;
    }

    if (isCreateRoute) {
      setEditor(EMPTY_EDITOR);
      setSlugTouched(false);
    }
  }, [editingId, isCreateRoute, isEditorOpen, itemQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: 'draft' | 'published' }) => {
      const payload = toPayload(editor, status);
      if (!payload.title) throw new Error('Title is required');
      if (!payload.slug) throw new Error('Slug is required');
      if (!payload.thumbnailUrl) throw new Error('Thumbnail image is required');
      if (payload.sourceType === 'video_url' && !payload.videoUrl) throw new Error('Video URL is required');
      if (payload.sourceType === 'embed_url' && !payload.embedUrl) throw new Error('Embed URL is required');

      if (editingId) {
        return updateViralVideo(editingId, payload);
      }
      return createViralVideo(payload);
    },
    onSuccess: (saved, vars) => {
      queryClient.invalidateQueries({ queryKey: ['viral-videos'] });
      queryClient.invalidateQueries({ queryKey: ['viral-videos', 'homepage-featured'] });
      toast.success(vars.status === 'published' ? 'Viral video published' : 'Draft saved');
      navigate(`/admin/viral-videos/${saved._id}/edit`, { replace: true });
    },
    onError: (error: any) => {
      toast.error(String(error?.message || 'Failed to save viral video'));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, featured, publishedAt }: { id: string; status: 'draft' | 'published'; featured?: boolean; publishedAt?: string | null }) => updateViralVideoStatus(id, status, { featured, homepageFeatured: featured, publishedAt }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['viral-videos'] });
      queryClient.invalidateQueries({ queryKey: ['viral-videos', 'homepage-featured'] });
      toast.success(vars.status === 'published' ? 'Video published' : 'Video unpublished');
    },
    onError: (error: any) => {
      toast.error(String(error?.message || 'Failed to update status'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteViralVideo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viral-videos'] });
      queryClient.invalidateQueries({ queryKey: ['viral-videos', 'homepage-featured'] });
      toast.success('Viral video deleted');
      navigate('/admin/viral-videos');
    },
    onError: (error: any) => {
      toast.error(String(error?.message || 'Failed to delete viral video'));
    },
  });

  const items = listQuery.data?.rows || [];
  const languages = useMemo(() => {
    const set = new Set(items.map((item) => String(item.language || 'en').trim()).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const previewSource = editor.sourceType === 'embed_url' ? editor.embedUrl : editor.videoUrl;
  const isBusy = saveMutation.isPending || statusMutation.isPending || deleteMutation.isPending;
  const homepageFeaturedItem = homepageFeatureQuery.data?.item || null;
  const homepageSelectionMode = homepageFeatureQuery.data?.selectionMode || 'manual';

  async function handleThumbnailUpload(file: File | null) {
    if (!file) return;
    setUploadingThumbnail(true);
    try {
      const result = await uploadViralVideoThumbnail(file);
      setEditor((current) => ({ ...current, thumbnailUrl: result.url }));
      toast.success('Thumbnail uploaded');
    } catch (error: any) {
      toast.error(String(error?.message || 'Thumbnail upload failed'));
    } finally {
      setUploadingThumbnail(false);
    }
  }

  async function handleVideoUpload(file: File | null) {
    if (!file) return;
    setUploadingVideo(true);
    try {
      const result = await uploadViralVideoFile(file);
      setEditor((current) => ({
        ...current,
        sourceType: 'video_url',
        videoUrl: result.url,
        embedUrl: '',
      }));
      toast.success('Video uploaded');
    } catch (error: any) {
      toast.error(String(error?.message || 'Video upload failed'));
    } finally {
      setUploadingVideo(false);
    }
  }

  const globalVisibilityMutation = useMutation({
    mutationFn: (frontendEnabled: boolean) => updateAdminViralVideosFrontendSettings(frontendEnabled),
    onMutate: async (frontendEnabled) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['viral-videos', 'frontend-settings'] }),
        queryClient.cancelQueries({ queryKey: ['viral-videos', 'homepage-featured'] }),
        queryClient.cancelQueries({ queryKey: ['viral-videos', 'right-rail-featured'] }),
      ]);
      const previousAdminSettings = queryClient.getQueryData<ViralVideosFrontendSettings>(['viral-videos', 'frontend-settings', 'admin']);
      const previousPublicSettings = queryClient.getQueryData<ViralVideosFrontendSettings>(['viral-videos', 'frontend-settings']);
      const previousHomepageSelections = queryClient.getQueriesData<HomepageViralVideoSelection>({ queryKey: ['viral-videos', 'homepage-featured'] });
      const previousRightRailSelection = queryClient.getQueryData<HomepageViralVideoSelection>(['viral-videos', 'right-rail-featured']);
      queryClient.setQueryData<ViralVideosFrontendSettings>(['viral-videos', 'frontend-settings', 'admin'], { frontendEnabled });
      queryClient.setQueryData<ViralVideosFrontendSettings>(['viral-videos', 'frontend-settings'], { frontendEnabled });
      queryClient.setQueriesData<HomepageViralVideoSelection>({ queryKey: ['viral-videos', 'homepage-featured'] }, (current) => (
        current ? { ...current, frontendEnabled } : current
      ));
      queryClient.setQueryData<HomepageViralVideoSelection>(['viral-videos', 'right-rail-featured'], (current) => (
        current ? { ...current, frontendEnabled } : current
      ));
      return { previousAdminSettings, previousPublicSettings, previousHomepageSelections, previousRightRailSelection };
    },
    onSuccess: async (settings) => {
      queryClient.setQueryData<ViralVideosFrontendSettings>(['viral-videos', 'frontend-settings', 'admin'], settings);
      queryClient.setQueryData<ViralVideosFrontendSettings>(['viral-videos', 'frontend-settings'], settings);
      queryClient.setQueriesData<HomepageViralVideoSelection>({ queryKey: ['viral-videos', 'homepage-featured'] }, (current) => (
        current ? { ...current, frontendEnabled: settings.frontendEnabled } : current
      ));
      queryClient.setQueryData<HomepageViralVideoSelection>(['viral-videos', 'right-rail-featured'], (current) => (
        current ? { ...current, frontendEnabled: settings.frontendEnabled } : current
      ));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['viral-videos', 'frontend-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['viral-videos', 'homepage-featured'] }),
        queryClient.invalidateQueries({ queryKey: ['viral-videos', 'right-rail-featured'] }),
      ]);
      toast.success(`Frontend Viral Videos visibility saved: ${settings.frontendEnabled ? 'ON' : 'OFF'}`, { id: FRONTEND_VISIBILITY_TOAST_ID });
    },
    onError: (error: any, _frontendEnabled, context) => {
      if (context?.previousAdminSettings) {
        queryClient.setQueryData<ViralVideosFrontendSettings>(['viral-videos', 'frontend-settings', 'admin'], context.previousAdminSettings);
      }
      if (context?.previousPublicSettings) {
        queryClient.setQueryData<ViralVideosFrontendSettings>(['viral-videos', 'frontend-settings'], context.previousPublicSettings);
      }
      context?.previousHomepageSelections?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      queryClient.setQueryData<HomepageViralVideoSelection>(['viral-videos', 'right-rail-featured'], context?.previousRightRailSelection);
      toast.error(String(error?.message || 'Failed to update frontend visibility'), { id: FRONTEND_VISIBILITY_TOAST_ID });
    },
  });

  const frontendStateLabel = (item: ViralVideoRecord) => {
    if (item.status !== 'published') return 'Draft only';
    if (item.featured) return 'Published and homepage featured';
    return 'Published in archive';
  };

  const hasFrontendSettings = typeof frontendSettingsQuery.data?.frontendEnabled === 'boolean';
  const frontendEnabled = frontendSettingsQuery.data?.frontendEnabled === true;
  const frontendVisibilityLabel = frontendSettingsQuery.isLoading
    ? 'Loading...'
    : frontendSettingsQuery.isError
      ? 'Unavailable'
      : frontendEnabled
        ? 'ON'
        : 'OFF';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">Editorial Media</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Viral Videos</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Founder-friendly workflow for short-form video picks. The global frontend switch is separate from per-video Draft or Published state, and saved records stay in admin even when the frontend is OFF.
            </p>
          </div>
          {!isEditorOpen ? (
            <button
              type="button"
              onClick={() => navigate('/admin/viral-videos/new')}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Add viral video
            </button>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Frontend visibility</div>
              <div className="mt-1 text-sm text-slate-600">
                OFF hides Viral Videos from the homepage and public Viral Videos page. Saved records remain available in admin.
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className={`text-sm font-semibold ${frontendEnabled ? 'text-emerald-700' : 'text-slate-600'}`}>
                {frontendVisibilityLabel}
              </span>
              {canManageFrontendVisibility ? (
                <Switch
                  checked={frontendEnabled}
                  onCheckedChange={(next) => globalVisibilityMutation.mutate(next)}
                  disabled={!hasFrontendSettings || frontendSettingsQuery.isError || globalVisibilityMutation.isPending}
                  label="Frontend visibility"
                />
              ) : null}
            </div>
          </div>
          {!canManageFrontendVisibility ? <div className="mt-3 text-xs text-slate-500">Only admins and the founder can change the global frontend visibility for Viral Videos.</div> : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or summary"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'published' | 'draft')} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Language</label>
            <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              {languages.map((language) => (
                <option key={language} value={language}>{language === 'all' ? 'All languages' : String(language).toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Featured</label>
            <select value={featuredFilter} onChange={(event) => setFeaturedFilter(event.target.value as 'all' | 'featured')} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="featured">Featured only</option>
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Thumbnail</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Title</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Language</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Publish status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Global frontend</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Homepage feature</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Published at</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Updated at</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">Loading viral videos...</td>
                </tr>
              ) : null}

              {!listQuery.isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    {listQuery.isError ? String((listQuery.error as Error | undefined)?.message || 'Failed to load viral videos.') : 'No viral videos found for the current filters.'}
                  </td>
                </tr>
              ) : null}

              {items.map((item) => (
                <tr key={item._id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="h-16 w-28 overflow-hidden rounded-lg bg-slate-100">
                      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">/{item.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{String(item.language || 'en').toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {item.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    <div className="mt-1 text-xs text-slate-500">{frontendStateLabel(item)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${frontendEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {frontendEnabled ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.featured && item.status === 'published'
                      ? <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">YES</span>
                      : <span className="text-slate-400">NO</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(item.publishedAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => navigate(`/admin/viral-videos/${item._id}/edit`)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                      <button type="button" onClick={() => window.open(item.embedUrl || item.videoUrl || '/viral-videos', '_blank', 'noopener,noreferrer')} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Preview</button>
                      {item.status === 'published' ? (
                        <button type="button" onClick={() => statusMutation.mutate({ id: item._id, status: 'draft' })} className="rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">Unpublish</button>
                      ) : (
                        <button type="button" onClick={() => statusMutation.mutate({ id: item._id, status: 'published', featured: item.featured, publishedAt: item.publishedAt || null })} className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Publish</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isEditorOpen ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">{editingId ? 'Edit viral video' : 'Create viral video'}</h2>
              <p className="mt-1 text-sm text-slate-600">Simple editorial fields only. This stays separate from ads and sponsored products.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate('/admin/viral-videos')} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
              <button type="button" onClick={() => setShowPreview((value) => !value)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Preview</button>
              <button type="button" disabled={isBusy} onClick={() => saveMutation.mutate({ status: editor.publish ? 'published' : 'draft' })} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">Save video</button>
              {editingId ? (
                <>
                  {editor.publish ? (
                    <button type="button" disabled={isBusy} onClick={() => statusMutation.mutate({ id: editingId, status: 'draft' })} className="rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60">Unpublish</button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      if (!window.confirm('Delete this viral video?')) return;
                      deleteMutation.mutate(editingId);
                    }}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {itemQuery.isLoading ? <div className="py-4 text-sm text-slate-500">Loading viral video...</div> : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Frontend visibility controls</div>
                <div className="mt-1 text-sm text-slate-600">The single global Frontend visibility toggle at the top of this page controls the whole Viral Videos product. Per-video controls below only manage Draft or Published and Homepage featured.</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publish status</div>
                    <select
                      value={editor.publish ? 'published' : 'draft'}
                      onChange={(event) => {
                        const publish = event.target.value === 'published';
                        setEditor((current) => ({
                          ...current,
                          publish,
                          featured: publish ? current.featured : false,
                        }));
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                    <div className="mt-2 text-xs text-slate-500">Published records can render on the frontend only when the global frontend switch is ON.</div>
                  </label>
                  <label className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Homepage featured</div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-700">{editor.publish && editor.featured ? 'Yes' : 'No'}</span>
                      <input
                        type="checkbox"
                        checked={editor.publish && editor.featured}
                        disabled={!editor.publish}
                        onChange={(event) => setEditor((current) => ({ ...current, featured: event.target.checked }))}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">Homepage featured is per-video only. It does not turn the full Viral Videos frontend ON or OFF.</div>
                  </label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                  <input
                    value={editor.title}
                    onChange={(event) => {
                      const title = event.target.value;
                      setEditor((current) => ({
                        ...current,
                        title,
                        slug: slugTouched ? current.slug : slugify(title),
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    placeholder="Viral video title"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
                  <input
                    value={editor.slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setEditor((current) => ({ ...current, slug: slugify(event.target.value) }));
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    placeholder="viral-video-slug"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Language</label>
                  <select value={editor.language} onChange={(event) => setEditor((current) => ({ ...current, language: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="gu">Gujarati</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Short caption / summary</label>
                  <textarea
                    value={editor.summary}
                    onChange={(event) => setEditor((current) => ({ ...current, summary: event.target.value }))}
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    placeholder="Short summary for archive cards and teaser blocks"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                  <input value={editor.category} onChange={(event) => setEditor((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="Entertainment, Sports, News" />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Thumbnail / poster image</label>
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <span>{uploadingThumbnail ? 'Uploading...' : 'Upload image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingThumbnail}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          void handleThumbnailUpload(file);
                          event.currentTarget.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-500">You can upload a thumbnail or paste an existing image URL below.</span>
                  </div>
                  <input value={editor.thumbnailUrl} onChange={(event) => setEditor((current) => ({ ...current, thumbnailUrl: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="https://.../thumbnail.jpg" />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Source type</label>
                  <select value={editor.sourceType} onChange={(event) => setEditor((current) => ({ ...current, sourceType: event.target.value as 'video_url' | 'embed_url' }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value="video_url">Video URL</option>
                    <option value="embed_url">Embed URL</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Published at</label>
                  <input type="datetime-local" value={editor.publishedAt} onChange={(event) => setEditor((current) => ({ ...current, publishedAt: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" />
                </div>

                {editor.sourceType === 'video_url' ? (
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Upload video file</label>
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <span>{uploadingVideo ? 'Uploading...' : 'Upload video file'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                          disabled={uploadingVideo}
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            void handleVideoUpload(file);
                            event.currentTarget.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                      <span className="text-xs text-slate-500">Accepted formats: mp4, mov, webm.</span>
                    </div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Or paste video URL</label>
                    <input value={editor.videoUrl} onChange={(event) => setEditor((current) => ({ ...current, videoUrl: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="https://.../video.mp4" />
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Embed URL</label>
                    <input value={editor.embedUrl} onChange={(event) => setEditor((current) => ({ ...current, embedUrl: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="https://www.youtube.com/embed/..." />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tags</label>
                  <input value={editor.tags} onChange={(event) => setEditor((current) => ({ ...current, tags: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="viral, social, sports" />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Sort order / priority</label>
                  <input type="number" value={editor.sortOrder} onChange={(event) => setEditor((current) => ({ ...current, sortOrder: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="1" />
                </div>
              </div>

            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Homepage teaser control</div>
                <div className="mt-3 text-sm text-slate-600">
                  {homepageFeaturedItem ? (
                    <>
                      <div className="font-semibold text-slate-900">Current homepage video</div>
                      <div className="mt-1">{homepageFeaturedItem.title}</div>
                      <div className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                        {homepageSelectionMode === 'manual' ? 'Manual featured selection' : 'Latest published fallback'}
                      </div>
                    </>
                  ) : (
                    <div>No published viral video is currently available for the homepage.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Workflow summary</div>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>Frontend Viral Videos visibility: <span className="font-semibold text-slate-900">{frontendEnabled ? 'ON' : 'OFF'}</span></div>
                  <div>Status: <span className="font-semibold text-slate-900">{editor.publish ? 'Published' : 'Draft'}</span></div>
                  <div>Homepage featured: <span className="font-semibold text-slate-900">{editor.publish && editor.featured ? 'Yes' : 'No'}</span></div>
                  <div>Frontend result: <span className="font-semibold text-slate-900">{!frontendEnabled ? 'Hidden everywhere on the frontend while admin records remain saved' : (!editor.publish ? 'Draft only' : (editor.featured ? 'Homepage feature candidate and archive item' : 'Published in archive'))}</span></div>
                  {editor.category ? <div>Category: <span className="font-semibold text-slate-900">{editor.category}</span></div> : null}
                </div>
              </div>

              {showPreview ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="aspect-[16/10] bg-slate-100">
                    {editor.thumbnailUrl ? <img src={editor.thumbnailUrl} alt={editor.title || 'Preview thumbnail'} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Add a thumbnail to preview</div>}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <span>{String(editor.language || 'en').toUpperCase()}</span>
                      <span className={`rounded-full px-2 py-0.5 ${frontendEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>Frontend {frontendEnabled ? 'ON' : 'OFF'}</span>
                      {editor.publish && editor.featured ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Featured</span> : null}
                    </div>
                    <div className="text-xl font-semibold text-slate-900">{editor.title || 'Preview title'}</div>
                    {editor.category ? <div className="text-sm font-medium text-slate-500">Category: {editor.category}</div> : null}
                    <div className="text-sm leading-6 text-slate-600">{editor.summary || 'Summary preview will appear here.'}</div>
                    {previewSource ? (
                      <a href={previewSource} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                        Open source preview
                      </a>
                    ) : (
                      <div className="text-sm text-slate-500">Add a video or embed URL for preview.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
