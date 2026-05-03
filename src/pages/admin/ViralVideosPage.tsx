import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Play } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import Switch from '@/components/settings/Switch';
import { uploadCoverImage, uploadVideoFile } from '@/lib/api/media';
import {
  getAdminViralVideosFrontendSettings,
  getPublicViralVideosFrontendSettings,
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
const IMAGE_UPLOAD_UNCONFIGURED_MESSAGE = 'Image upload is not configured in this environment. Paste an image URL to continue.';
const THUMBNAIL_VIDEO_LINK_MESSAGE = 'This is a video/social link. Paste it in Video URL. Thumbnail needs an image URL.';
const THUMBNAIL_IMAGE_URL_MESSAGE = 'Thumbnail needs a direct image URL ending in .jpg, .jpeg, .png, .webp, a Cloudinary image URL, S3/R2 image URL, or an uploaded article-cover image URL.';
const CLOUD_VIDEO_UPLOAD_NOT_CONNECTED_MESSAGE = 'Video upload will use admin storage when available. If upload fails, use External video/source URL.';
const THUMBNAIL_FILE_TYPE_MESSAGE = 'Only JPG, JPEG, PNG, and WEBP images are allowed for thumbnail.';
const THUMBNAIL_ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const VIDEO_ACCEPT_ATTR = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';
const MAX_THUMBNAIL_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const ACCEPTED_THUMBNAIL_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ACCEPTED_THUMBNAIL_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const ACCEPTED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ACCEPTED_VIDEO_EXTENSIONS = /\.(mp4|webm|mov)$/i;
const VIDEO_FILE_TYPE_MESSAGE = 'Only MP4, WebM, or MOV videos are allowed.';
const VIDEO_FILE_SIZE_MESSAGE = 'Video file is too large. Please upload below 100MB.';
const DEFAULT_CLOUD_VIDEO_UPLOAD_CAPABILITY = {
  enabled: false,
  available: false,
  provider: null as string | null,
  message: CLOUD_VIDEO_UPLOAD_NOT_CONNECTED_MESSAGE,
};

type EditorState = {
  title: string;
  slug: string;
  summary: string;
  category: string;
  sourceName: string;
  thumbnailUrl: string;
  posterImageUrl: string;
  sourceType: 'video_url' | 'embed_url';
  videoUrl: string;
  videoFileUrl: string;
  embedUrl: string;
  videoType: 'uploaded' | 'youtube' | 'twitter' | 'external';
  playbackMode: 'internal' | 'youtube' | 'twitter' | 'external_link';
  language: string;
  tags: string;
  publish: boolean;
  isActive: boolean;
  featured: boolean;
  publishedAt: string;
  sortOrder: string;
};

const EMPTY_EDITOR: EditorState = {
  title: '',
  slug: '',
  summary: '',
  category: '',
  sourceName: '',
  thumbnailUrl: '',
  posterImageUrl: '',
  sourceType: 'video_url',
  videoUrl: '',
  videoFileUrl: '',
  embedUrl: '',
  videoType: 'external',
  playbackMode: 'external_link',
  language: 'en',
  tags: '',
  publish: false,
  isActive: true,
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

function parseUrl(value: string): URL | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://newspulse.local';
    return new URL(raw, baseUrl);
  } catch {
    return null;
  }
}

function isSocialVideoUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return host === 'instagram.com'
    || host.endsWith('.instagram.com')
    || host === 'facebook.com'
    || host.endsWith('.facebook.com')
    || host === 'fb.watch'
    || host === 'x.com'
    || host.endsWith('.x.com')
    || host === 'twitter.com'
    || host.endsWith('.twitter.com')
    || host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'youtu.be';
}

function isYouTubeUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
}

function isXTwitterStatusUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com'))
    && /\/(status|statuses)\/\d+/i.test(url.pathname);
}

function derivePlaybackFields(videoUrl: string, videoFileUrl: string): Pick<EditorState, 'videoType' | 'playbackMode'> {
  const uploaded = String(videoFileUrl || '').trim();
  const externalUrl = String(videoUrl || '').trim();
  if (uploaded) return { videoType: 'uploaded', playbackMode: 'internal' };
  if (isYouTubeUrl(externalUrl)) return { videoType: 'youtube', playbackMode: 'youtube' };
  if (isXTwitterStatusUrl(externalUrl)) return { videoType: 'twitter', playbackMode: 'twitter' };
  return { videoType: 'external', playbackMode: 'external_link' };
}

function videoTypeLabel(videoType: EditorState['videoType']) {
  if (videoType === 'uploaded') return 'Uploaded News Pulse Video/Reel';
  if (videoType === 'youtube') return 'YouTube Video';
  if (videoType === 'twitter') return 'X/Twitter embed';
  return 'External Source Link';
}

function isDirectVideoUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  return /\.(mp4|webm)$/i.test(url.pathname);
}

function isValidThumbnailImageUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  const storageHost = host.includes('amazonaws.com')
    || host.includes('cloudflarestorage.com')
    || host.endsWith('.r2.dev')
    || host.endsWith('.r2.cloudflarestorage.com');
  if (/\.(jpe?g|png|webp)$/i.test(path)) return true;
  if (host.includes('cloudinary.com') && path.includes('/image/upload')) return true;
  if (storageHost && !isSocialVideoUrl(value) && !isDirectVideoUrl(value)) return true;
  if (/\/(uploads?|media|images?)\//i.test(path) && !isSocialVideoUrl(value) && !isDirectVideoUrl(value)) return true;
  return false;
}

function thumbnailUrlValidationMessage(value: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (isSocialVideoUrl(raw) || isDirectVideoUrl(raw)) return THUMBNAIL_VIDEO_LINK_MESSAGE;
  if (!isValidThumbnailImageUrl(raw)) return THUMBNAIL_IMAGE_URL_MESSAGE;
  return null;
}

function isAcceptedThumbnailFile(file: File): boolean {
  if (file.type && ACCEPTED_THUMBNAIL_TYPES.has(file.type)) return true;
  return ACCEPTED_THUMBNAIL_EXTENSIONS.test(file.name || '');
}

function isAcceptedVideoFile(file: File): boolean {
  if (file.type && ACCEPTED_VIDEO_TYPES.has(file.type)) return true;
  return ACCEPTED_VIDEO_EXTENSIONS.test(file.name || '');
}

function resolveVideoUploadErrorMessage(error: any): string {
  const rawMessage = String(error?.message || '').trim();
  if (!rawMessage) return 'Video upload failed';

  const imageOnlyValidationError = /\b(jpg|jpeg|png|webp|thumbnail|image)\b/i.test(rawMessage);
  if (imageOnlyValidationError) return VIDEO_FILE_TYPE_MESSAGE;

  return rawMessage;
}

function readViralVideoErrorMessage(error: any, fallback: string): string {
  const status = Number(error?.response?.status);
  const url = String(error?.config?.url || error?.response?.config?.url || '').trim();
  const data = error?.response?.data;
  const payload = data?.data && typeof data.data === 'object' ? data.data : data;
  const detail = String(
    payload?.message
    || payload?.error
    || payload?.detail
    || error?.message
    || fallback
  ).trim();

  if (status === 404 && url) {
    return `${detail || fallback} (route: ${url})`;
  }
  return detail || fallback;
}

function readSavedViralVideoId(record: any): string {
  return String(record?._id || record?.id || '').trim();
}

function toPayload(state: EditorState, nextStatus: 'draft' | 'published'): ViralVideoInput {
  const tags = state.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  const publishedAt = nextStatus === 'published'
    ? (state.publishedAt ? new Date(state.publishedAt).toISOString() : new Date().toISOString())
    : null;
  const thumbnailUrl = (state.thumbnailUrl || state.posterImageUrl).trim();
  const videoUrl = state.videoUrl.trim();
  const videoFileUrl = state.videoFileUrl.trim();
  const playbackFields = derivePlaybackFields(videoUrl, videoFileUrl);

  return {
    title: state.title.trim(),
    slug: slugify(state.slug || state.title),
    summary: state.summary.trim(),
    category: state.category.trim(),
    sourceName: state.sourceName.trim(),
    thumbnailUrl,
    posterImageUrl: thumbnailUrl,
    videoUrl,
    videoFileUrl,
    embedUrl: '',
    sourceType: 'video_url',
    videoType: playbackFields.videoType,
    playbackMode: playbackFields.playbackMode,
    language: state.language,
    tags,
    status: nextStatus,
    isActive: state.isActive,
    homepageVisible: nextStatus === 'published',
    showOnHomepage: nextStatus === 'published' && state.featured,
    homepageFeatured: nextStatus === 'published' && state.featured,
    featured: state.featured,
    publishedAt,
    sortOrder: state.sortOrder.trim() ? Number(state.sortOrder) : null,
  };
}

function fromRecord(record: ViralVideoRecord): EditorState {
  const thumbnailUrl = record.thumbnailUrl || record.posterImageUrl || record.posterImage?.url || '';
  const playbackFields = derivePlaybackFields(record.videoUrl || '', record.videoFileUrl || '');
  return {
    title: record.title || '',
    slug: record.slug || '',
    summary: record.summary || '',
    category: record.category || '',
    sourceName: record.sourceName || '',
    thumbnailUrl,
    posterImageUrl: record.posterImageUrl || thumbnailUrl,
    sourceType: 'video_url',
    videoUrl: record.videoUrl || record.embedUrl || '',
    videoFileUrl: record.videoFileUrl || '',
    embedUrl: '',
    videoType: record.videoType || playbackFields.videoType,
    playbackMode: record.playbackMode || playbackFields.playbackMode,
    language: record.language || 'en',
    tags: Array.isArray(record.tags) ? record.tags.join(', ') : '',
    publish: record.status === 'published',
    isActive: record.isActive !== false,
    featured: record.featured === true,
    publishedAt: toDateTimeLocal(record.publishedAt),
    sortOrder: Number.isFinite(Number(record.sortOrder)) ? String(record.sortOrder) : '',
  };
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
  const [thumbnailUploadError, setThumbnailUploadError] = useState<string | null>(null);
  const [thumbnailPreviewFailed, setThumbnailPreviewFailed] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [cloudVideoUploadRequested, setCloudVideoUploadRequested] = useState<boolean | null>(null);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
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
    enabled: Boolean(editingId && !isCreateRoute),
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const homepageFeatureQuery = useQuery({
    queryKey: ['viral-videos', 'homepage-featured', 'admin-preview'],
    queryFn: () => getHomepageFeaturedViralVideo(),
    staleTime: 30_000,
  });

  const frontendSettingsQuery = useQuery({
    queryKey: ['viral-videos', 'frontend-settings', 'admin'],
    queryFn: async () => {
      try {
        return await getAdminViralVideosFrontendSettings();
      } catch {
        return getPublicViralVideosFrontendSettings();
      }
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isEditorOpen) {
      setEditor(EMPTY_EDITOR);
      setSlugTouched(false);
      setShowPreview(false);
      setThumbnailUploadError(null);
      setThumbnailPreviewFailed(false);
      setUploadingVideo(false);
      setCloudVideoUploadRequested(null);
      setVideoUploadError(null);
      return;
    }

    if (editingId && itemQuery.data) {
      setEditor(fromRecord(itemQuery.data));
      setSlugTouched(true);
      setThumbnailUploadError(null);
      setThumbnailPreviewFailed(false);
      setUploadingVideo(false);
      setCloudVideoUploadRequested(null);
      setVideoUploadError(null);
      return;
    }

    if (isCreateRoute) {
      setEditor(EMPTY_EDITOR);
      setSlugTouched(false);
      setThumbnailUploadError(null);
      setThumbnailPreviewFailed(false);
      setUploadingVideo(false);
      setCloudVideoUploadRequested(null);
      setVideoUploadError(null);
    }
  }, [editingId, isCreateRoute, isEditorOpen, itemQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: 'draft' | 'published' }) => {
      const payload = toPayload(editor, status);
      if (!payload.title) throw new Error('Title is required');
      if (!payload.slug) throw new Error('Slug is required');
      if (!payload.thumbnailUrl) throw new Error('Thumbnail image is required');
      const thumbnailError = thumbnailUrlValidationMessage(payload.thumbnailUrl);
      if (thumbnailError) throw new Error(thumbnailError);
      if (!payload.videoFileUrl && !payload.videoUrl) throw new Error('Upload a video file or add an external video/source URL');

      if (editingId) {
        return updateViralVideo(editingId, payload);
      }
      return createViralVideo(payload);
    },
    onSuccess: (saved, vars) => {
      queryClient.invalidateQueries({ queryKey: ['viral-videos'] });
      queryClient.invalidateQueries({ queryKey: ['viral-videos', 'homepage-featured'] });
      const savedId = readSavedViralVideoId(saved);
      const savedHasFrontendCardFields = saved.status === 'published' && saved.isActive === true && Boolean(saved.thumbnailUrl);
      if (import.meta.env.DEV) {
        console.log('[viral-videos:save]', {
          savedId,
          thumbnailUrl: saved.thumbnailUrl,
          posterImageUrl: saved.posterImageUrl || saved.posterImage?.url,
          videoFileUrl: saved.videoFileUrl,
          videoUrl: saved.videoUrl,
          videoType: saved.videoType,
          playbackMode: saved.playbackMode,
        });
      }
      toast.success(savedHasFrontendCardFields
        ? 'Viral video saved: Published, Active ON, thumbnail saved'
        : (vars.status === 'published' ? 'Viral video published' : 'Draft saved'));
      if (savedId) {
        queryClient.setQueryData(['viral-videos', 'admin-item', savedId], saved);
        navigate(`/admin/viral-videos/${savedId}/edit`, { replace: true });
        return;
      }

      // Fallback: save succeeded but backend response did not include an ID.
      navigate('/admin/viral-videos');
    },
    onError: (error: any) => {
      toast.error(readViralVideoErrorMessage(error, 'Failed to save viral video'));
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
      toast.error(readViralVideoErrorMessage(error, 'Failed to update status'));
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
      toast.error(readViralVideoErrorMessage(error, 'Failed to delete viral video'));
    },
  });

  const items = listQuery.data?.rows || [];
  const languages = useMemo(() => {
    const set = new Set(items.map((item) => String(item.language || 'en').trim()).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const playbackFields = derivePlaybackFields(editor.videoUrl, editor.videoFileUrl);
  const currentVideoType = playbackFields.videoType;
  const currentPlaybackMode = playbackFields.playbackMode;
  const previewSource = (editor.videoFileUrl || editor.videoUrl).trim();
  const hasPreviewSource = previewSource.length > 0;
  const isBusy = saveMutation.isPending || statusMutation.isPending || deleteMutation.isPending;
  const homepageFeaturedItem = homepageFeatureQuery.data?.item || null;
  const homepageSelectionMode = homepageFeatureQuery.data?.selectionMode || 'manual';
  const thumbnailUploadDisabled = uploadingThumbnail;
  const thumbnailUploadHelpText = 'Upload or paste a direct image URL. For YouTube and X/Twitter videos, paste the link in Video URL and add a separate thumbnail image.';
  const thumbnailValidationMessage = thumbnailUrlValidationMessage(editor.thumbnailUrl);
  const thumbnailPreviewUrl = !thumbnailValidationMessage && isValidThumbnailImageUrl(editor.thumbnailUrl) ? editor.thumbnailUrl.trim() : '';
  const cloudVideoUpload = frontendSettingsQuery.data?.viralVideosCloudUpload || DEFAULT_CLOUD_VIDEO_UPLOAD_CAPABILITY;
  const cloudVideoUploadProviderLabel = cloudVideoUpload.provider ? String(cloudVideoUpload.provider).toUpperCase() : 'Not connected';
  const cloudVideoUploadProviderConnected = Boolean(String(cloudVideoUpload.provider || '').trim());
  const cloudVideoUploadAvailable = cloudVideoUpload.available === true;
  const cloudVideoUploadCanBeEnabled = cloudVideoUploadAvailable && cloudVideoUploadProviderConnected;
  const cloudVideoUploadDefaultEnabled = cloudVideoUpload.enabled === true;
  const cloudVideoUploadToggleState = cloudVideoUploadRequested ?? cloudVideoUploadDefaultEnabled;
  const cloudVideoUploadEnabled = cloudVideoUploadCanBeEnabled && cloudVideoUploadToggleState;
  const videoUploadDisabled = uploadingVideo || !cloudVideoUploadEnabled;
  const cloudVideoUploadStatusText = cloudVideoUploadEnabled
    ? 'Cloud video upload is enabled. Upload MP4/WebM/MOV or paste a Video URL.'
    : (cloudVideoUploadCanBeEnabled
      ? 'Cloud video upload is available but disabled. Use Video URL unless enabled.'
      : CLOUD_VIDEO_UPLOAD_NOT_CONNECTED_MESSAGE);
  const cloudVideoUploadStatusLabel = cloudVideoUploadEnabled ? 'ON' : 'OFF';

  async function handleThumbnailUpload(file: File | null) {
    if (!file) return;
    if (file.size > MAX_THUMBNAIL_UPLOAD_BYTES) {
      toast.error('Image must be 5MB or smaller');
      return;
    }
    if (!isAcceptedThumbnailFile(file)) {
      setThumbnailUploadError(THUMBNAIL_FILE_TYPE_MESSAGE);
      toast.error(THUMBNAIL_FILE_TYPE_MESSAGE);
      return;
    }
    setUploadingThumbnail(true);
    setThumbnailUploadError(null);
    try {
      const result = await uploadCoverImage(file);
      setEditor((current) => ({ ...current, thumbnailUrl: result.url, posterImageUrl: result.url }));
      setThumbnailUploadError(null);
      setThumbnailPreviewFailed(false);
      setShowPreview(true);
      toast.success('Thumbnail uploaded');
    } catch (error: any) {
      const rawMessage = String(error?.message || '').trim();
      const message = /cloudinary|configured|configuration|env|upload unavailable|status check|media status/i.test(rawMessage)
        ? IMAGE_UPLOAD_UNCONFIGURED_MESSAGE
        : (rawMessage || IMAGE_UPLOAD_UNCONFIGURED_MESSAGE);
      setThumbnailUploadError(message);
      toast.error(message);
    } finally {
      setUploadingThumbnail(false);
    }
  }

  async function handleVideoUpload(file: File | null) {
    if (!file) return;
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setVideoUploadError(VIDEO_FILE_SIZE_MESSAGE);
      toast.error(VIDEO_FILE_SIZE_MESSAGE);
      return;
    }
    if (!isAcceptedVideoFile(file)) {
      setVideoUploadError(VIDEO_FILE_TYPE_MESSAGE);
      toast.error(VIDEO_FILE_TYPE_MESSAGE);
      return;
    }
    setUploadingVideo(true);
    setVideoUploadError(null);
    try {
      const result = await uploadVideoFile(file);
      setEditor((current) => ({
        ...current,
        videoUrl: result.url,
        videoFileUrl: result.url,
        videoType: 'uploaded',
        playbackMode: 'internal',
      }));
      toast.success('Video uploaded');
    } catch (error: any) {
      const message = resolveVideoUploadErrorMessage(error);
      setVideoUploadError(message);
      toast.error(message);
    } finally {
      setUploadingVideo(false);
    }
  }

  function handleCloudVideoUploadToggle(nextChecked: boolean) {
    setVideoUploadError(null);
    if (nextChecked && !cloudVideoUploadCanBeEnabled) {
      toast.error(CLOUD_VIDEO_UPLOAD_NOT_CONNECTED_MESSAGE);
      setCloudVideoUploadRequested(false);
      return;
    }
    setCloudVideoUploadRequested(nextChecked);
  }

  function handleThumbnailUrlChange(value: string) {
    setThumbnailUploadError(null);
    setEditor((current) => ({ ...current, thumbnailUrl: value, posterImageUrl: value }));
    setThumbnailPreviewFailed(false);
    if (isValidThumbnailImageUrl(value) && !thumbnailUrlValidationMessage(value)) {
      setShowPreview(true);
    }
  }

  function handleExternalVideoUrlChange(value: string) {
    setEditor((current) => ({
      ...current,
      sourceType: 'video_url',
      videoUrl: value,
      embedUrl: '',
      ...derivePlaybackFields(value, current.videoFileUrl),
    }));
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
    if (item.isActive === false) return 'Inactive in public API';
    if (item.status !== 'published') return 'Draft only';
    if (item.featured) return 'Published and homepage featured';
    return 'Published in archive';
  };

  const frontendEnabled = frontendSettingsQuery.data?.frontendEnabled ?? homepageFeatureQuery.data?.frontendEnabled ?? true;
  const editLoadErrorStatus = (itemQuery.error as any)?.response?.status;
  const editItemUnavailable = Boolean(editingId && itemQuery.isError && (editLoadErrorStatus === 404 || editLoadErrorStatus == null));
  const frontendVisibilityLabel = frontendSettingsQuery.isLoading
    ? 'Loading...'
    : frontendEnabled
      ? 'ON'
      : 'OFF';
  const frontendVisibilityDisabled = frontendSettingsQuery.isError || globalVisibilityMutation.isPending;

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
                ON allows Viral Videos to appear on homepage and public Viral Videos page. OFF hides them publicly but keeps saved records in admin.
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Frontend visibility ON does not publish drafts. Public display still requires Published status, and homepage display also needs Show on homepage = Yes.
              </div>
            </div>
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${frontendEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              <span className={`min-w-10 text-sm font-bold ${frontendEnabled ? 'text-emerald-700' : 'text-slate-700'}`}>
                {frontendVisibilityLabel}
              </span>
              {canManageFrontendVisibility ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={frontendEnabled}
                  aria-label="Frontend visibility"
                  disabled={frontendVisibilityDisabled}
                  onClick={() => globalVisibilityMutation.mutate(!frontendEnabled)}
                  className={
                    `relative inline-flex h-8 w-16 items-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-60 ` +
                    (frontendEnabled ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-slate-200')
                  }
                >
                  <span
                    className={
                      `inline-block h-6 w-6 transform rounded-full bg-white shadow transition ` +
                      (frontendEnabled ? 'translate-x-8' : 'translate-x-1')
                    }
                  />
                </button>
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
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Active</th>
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
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">Loading viral videos...</td>
                </tr>
              ) : null}

              {!listQuery.isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
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
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {item.isActive !== false ? 'ON' : 'OFF'}
                    </span>
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
          {editItemUnavailable ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
              Viral video not found or unavailable.
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Frontend visibility controls</div>
                <div className="mt-1 text-sm text-slate-600">The single global Frontend visibility toggle at the top of this page controls the whole Viral Videos product. Per-video controls below manage Draft or Published, Active ON/OFF, and Homepage featured.</div>
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
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active ON/OFF</div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className={`text-sm font-semibold ${editor.isActive ? 'text-emerald-700' : 'text-slate-700'}`}>{editor.isActive ? 'Active ON' : 'Active OFF'}</span>
                      <Switch
                        checked={editor.isActive}
                        onCheckedChange={(checked) => setEditor((current) => ({ ...current, isActive: checked }))}
                        label="Active ON/OFF"
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">Active ON allows a Published video with a thumbnail to appear in the public Viral Videos API.</div>
                  </label>
                  <label className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Show on homepage</div>
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
                    <div className="mt-2 text-xs text-slate-500">Shows this published video in the homepage Viral Videos slot. It does not turn the full Viral Videos frontend ON or OFF.</div>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">Language</label>
                  <select value={editor.language} onChange={(event) => setEditor((current) => ({ ...current, language: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="gu">Gujarati</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Source name</label>
                  <input value={editor.sourceName} onChange={(event) => setEditor((current) => ({ ...current, sourceName: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="News Pulse Desk, YouTube, Instagram, Public Source" />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Summary</label>
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
                    <label className={`inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 ${thumbnailUploadDisabled ? 'cursor-not-allowed bg-slate-100 opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}>
                      <span>{uploadingThumbnail ? 'Uploading...' : 'Upload image'}</span>
                      <input
                        type="file"
                        accept={THUMBNAIL_ACCEPT_ATTR}
                        disabled={thumbnailUploadDisabled}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          void handleThumbnailUpload(file);
                          event.currentTarget.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-500">{thumbnailUploadHelpText}</span>
                  </div>
                  {thumbnailUploadError ? (
                    <div className="mb-2 text-xs font-medium text-amber-700">{thumbnailUploadError}</div>
                  ) : null}
                  <input
                    value={editor.thumbnailUrl}
                    onChange={(event) => {
                      handleThumbnailUrlChange(event.target.value);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-slate-500 ${thumbnailValidationMessage ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                    placeholder="https://.../thumbnail.jpg"
                  />
                  {thumbnailValidationMessage ? (
                    <div className="mt-2 text-xs font-medium text-red-700">{thumbnailValidationMessage}</div>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Published at</label>
                  <input type="datetime-local" value={editor.publishedAt} onChange={(event) => setEditor((current) => ({ ...current, publishedAt: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Video upload file</label>
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Uploaded News Pulse Video/Reel</div>
                        <div className={`mt-1 text-xs font-medium ${!cloudVideoUploadAvailable ? 'text-amber-700' : 'text-slate-500'}`}>{cloudVideoUploadStatusText}</div>
                        {cloudVideoUploadEnabled ? (
                          <div className="mt-1 text-xs text-slate-500">Storage provider: {cloudVideoUploadProviderLabel}</div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <span className={`min-w-8 text-sm font-bold ${cloudVideoUploadEnabled ? 'text-emerald-700' : 'text-slate-700'}`}>{cloudVideoUploadStatusLabel}</span>
                        <Switch
                          checked={cloudVideoUploadEnabled}
                          onCheckedChange={handleCloudVideoUploadToggle}
                          disabled={!cloudVideoUploadCanBeEnabled}
                          label="Enable Cloud Video Upload"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className={`inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium ${videoUploadDisabled ? 'cursor-not-allowed text-slate-500 opacity-70' : 'cursor-pointer text-slate-700 hover:bg-slate-50'}`}>
                        <span>{uploadingVideo ? 'Uploading video...' : 'Upload video file'}</span>
                        <input
                          type="file"
                          accept={VIDEO_ACCEPT_ATTR}
                          disabled={videoUploadDisabled}
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            void handleVideoUpload(file);
                            event.currentTarget.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                      <span className="text-xs text-slate-500">Uploaded files save as videoFileUrl and play as News Pulse reels.</span>
                    </div>
                    {editor.videoFileUrl ? (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                        <div className="font-semibold">videoFileUrl saved in form</div>
                        <div className="mt-1 break-all">{editor.videoFileUrl}</div>
                        <button
                          type="button"
                          onClick={() => setEditor((current) => {
                            const playback = derivePlaybackFields(current.videoUrl, '');
                            return { ...current, videoFileUrl: '', videoType: playback.videoType, playbackMode: playback.playbackMode };
                          })}
                          className="mt-2 rounded-full border border-emerald-300 px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Remove uploaded file
                        </button>
                      </div>
                    ) : null}
                    {videoUploadError ? (
                      <div className="mt-2 text-xs font-medium text-amber-700">{videoUploadError}</div>
                    ) : null}
                  </div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">External video/source URL</label>
                  <input value={editor.videoUrl} onChange={(event) => handleExternalVideoUrlChange(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="https://www.youtube.com/watch?v=... or https://instagram.com/..." />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{videoTypeLabel(currentVideoType)}</span>
                    <span>Playback mode: {currentPlaybackMode === 'internal' ? 'Internal News Pulse player' : (currentPlaybackMode === 'youtube' ? 'YouTube embed' : (currentPlaybackMode === 'twitter' ? 'X/Twitter embed' : 'External link only'))}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">YouTube and X/Twitter links will play as embeds. Uploaded MP4 files play in News Pulse player. Other external links open as source.</div>
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
                  <div>Active: <span className="font-semibold text-slate-900">{editor.isActive ? 'ON' : 'OFF'}</span></div>
                  <div>Homepage featured: <span className="font-semibold text-slate-900">{editor.publish && editor.featured ? 'Yes' : 'No'}</span></div>
                  <div>Frontend result: <span className="font-semibold text-slate-900">{!frontendEnabled ? 'Hidden everywhere on the frontend while admin records remain saved' : (!editor.publish ? 'Draft only' : (!editor.isActive ? 'Inactive in public API' : (editor.featured ? 'Homepage feature candidate and archive item' : 'Published in archive')))}</span></div>
                  {editor.sourceName ? <div>Source: <span className="font-semibold text-slate-900">{editor.sourceName}</span></div> : null}
                  {editor.category ? <div>Category: <span className="font-semibold text-slate-900">{editor.category}</span></div> : null}
                </div>
              </div>

              {showPreview || isEditorOpen ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="aspect-[16/10] bg-slate-100">
                    {thumbnailPreviewUrl && !thumbnailPreviewFailed ? (
                      <img
                        src={thumbnailPreviewUrl}
                        alt={editor.title || 'Preview thumbnail'}
                        className="h-full w-full object-cover"
                        onLoad={() => setThumbnailPreviewFailed(false)}
                        onError={() => setThumbnailPreviewFailed(true)}
                      />
                    ) : hasPreviewSource ? (
                      <div className="flex h-full flex-col items-center justify-center bg-slate-950 px-5 text-center text-slate-100">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-sm">
                          <Play className="ml-0.5 h-7 w-7 fill-current" aria-hidden="true" />
                        </div>
                        <div className="mt-3 text-sm font-semibold">Source link added. Add a thumbnail for better preview.</div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">Add a thumbnail to preview</div>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <span>{String(editor.language || 'en').toUpperCase()}</span>
                      <span className={`rounded-full px-2 py-0.5 ${frontendEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>Frontend {frontendEnabled ? 'ON' : 'OFF'}</span>
                      <span className={`rounded-full px-2 py-0.5 ${editor.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>Active {editor.isActive ? 'ON' : 'OFF'}</span>
                      {editor.publish && editor.featured ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Featured</span> : null}
                    </div>
                    <div className="text-xl font-semibold text-slate-900">{editor.title || 'Preview title'}</div>
                    {editor.sourceName ? <div className="text-sm font-medium text-slate-500">Source: {editor.sourceName}</div> : null}
                    {editor.category ? <div className="text-sm font-medium text-slate-500">Category: {editor.category}</div> : null}
                    <div className="text-sm leading-6 text-slate-600">{editor.summary || 'Summary preview will appear here.'}</div>
                    {previewSource ? (
                      <a href={previewSource} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                        Open source preview
                      </a>
                    ) : (
                      <button type="button" disabled className="inline-flex cursor-not-allowed rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
                        Add video URL first
                      </button>
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
