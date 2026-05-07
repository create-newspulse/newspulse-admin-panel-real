import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { getPublicViralVideosFrontendSettings, listPublicViralVideos, type ViralVideoRecord } from '@/lib/api/viralVideos';

function publicViralVideoPath(item: Pick<ViralVideoRecord, '_id' | 'slug'>) {
  const slugOrId = String(item.slug || item._id || '').trim();
  return slugOrId ? `/viral-videos/${encodeURIComponent(slugOrId)}` : '/viral-videos';
}

function externalVideoHref(item: ViralVideoRecord) {
  return item.externalSourceUrl || item.embedUrl || item.videoUrl || '#';
}

function posterUrl(item: ViralVideoRecord) {
  return item.thumbnailUrl || item.posterImageUrl || item.posterImage?.url || '';
}

function getYouTubeEmbedUrl(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const id = host === 'youtu.be' ? url.pathname.replace(/^\/+/, '') : url.searchParams.get('v');
    if ((host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') && id) {
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
  } catch {
    return '';
  }
  return '';
}

function formatDate(value?: string | null) {
  if (!value) return 'Unpublished';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unpublished';
}

export default function ViralVideosArchivePage() {
  const params = useParams();
  const activeSlug = String(params.slug || '').trim();
  const settingsQuery = useQuery({
    queryKey: ['viral-videos', 'frontend-settings'],
    queryFn: () => getPublicViralVideosFrontendSettings(),
    staleTime: 60_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['viral-videos', 'archive', activeSlug ? 'detail' : 'list'],
    queryFn: () => listPublicViralVideos(activeSlug ? { limit: 100 } : {}),
    staleTime: 60_000,
    enabled: settingsQuery.data?.frontendEnabled !== false,
  });

  if (settingsQuery.data?.frontendEnabled === false) {
    return <Navigate to="/" replace />;
  }

  const items = Array.isArray(data) ? data : [];
  const activeItem = activeSlug
    ? items.find((item) => {
      const candidates = [item.slug, item._id].map((value) => String(value || '').trim()).filter(Boolean);
      return candidates.some((candidate) => candidate === activeSlug || encodeURIComponent(candidate) === activeSlug);
    }) || null
    : null;

  if (activeSlug) {
    const item = activeItem;
    const embedUrl = item ? getYouTubeEmbedUrl(item.videoUrl || item.embedUrl) : '';
    const poster = item ? posterUrl(item) : '';

    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <Link to="/viral-videos" className="text-sm font-semibold text-rose-700 hover:text-rose-900">Back to viral videos</Link>

        {isLoading ? <div className="mt-8 text-sm text-slate-500">Loading viral video...</div> : null}
        {!isLoading && error ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            The viral video could not be loaded right now.
          </div>
        ) : null}
        {!isLoading && !error && !item ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            This viral video is not available.
          </div>
        ) : null}

        {item ? (
          <article className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
              <div className="aspect-[9/16]">
                {item.videoFileUrl ? (
                  <video
                    src={item.videoFileUrl}
                    poster={poster || undefined}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-contain"
                  />
                ) : embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title={item.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                ) : poster ? (
                  <a href={externalVideoHref(item)} target="_blank" rel="noreferrer" className="relative block h-full w-full">
                    <img src={poster} alt={item.title} className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                      <PlayCircle className="h-16 w-16" aria-hidden="true" />
                    </span>
                  </a>
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">Video unavailable</div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span>{String(item.language || 'en').toUpperCase()}</span>
                <span>{formatDate(item.publishedAt)}</span>
                {item.featured ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Featured</span> : null}
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{item.title}</h1>
              {item.summary ? <p className="mt-4 text-base leading-7 text-slate-600">{item.summary}</p> : null}
              {item.sourceName ? <div className="mt-4 text-sm font-medium text-slate-500">Source: {item.sourceName}</div> : null}
              {item.relatedNewsUrl ? (
                <a href={item.relatedNewsUrl} className="mt-5 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Read related news
                </a>
              ) : null}
              {!item.videoFileUrl && externalVideoHref(item) !== '#' ? (
                <a href={externalVideoHref(item)} target="_blank" rel="noreferrer" className="ml-2 mt-5 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                  Open source
                </a>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">Viral Videos</div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">Latest viral video archive</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Published editorial video picks from the News Pulse desk. Featured items rise to the homepage teaser, while this archive keeps the full published feed.
          </p>
        </div>

        {isLoading ? <div className="mt-8 text-sm text-slate-500">Loading viral videos...</div> : null}
        {!isLoading && error ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            The archive could not be loaded right now.
          </div>
        ) : null}
        {!isLoading && !error && items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            No published viral videos are available yet.
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article id={item.slug} key={item._id} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                <Link to={publicViralVideoPath(item)} className="block aspect-[9/16] bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
                  {posterUrl(item) ? (
                    <img src={posterUrl(item)} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">No thumbnail</div>
                  )}
                </Link>
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <span>{String(item.language || 'en').toUpperCase()}</span>
                    <span>{formatDate(item.publishedAt)}</span>
                    {item.featured ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Featured</span> : null}
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
                  {item.summary ? <p className="text-sm leading-6 text-slate-600">{item.summary}</p> : null}
                  <Link to={publicViralVideoPath(item)} className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Watch now</Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}