import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getHomepageFeaturedViralVideo, getPublicViralVideosFrontendSettings } from '@/lib/api/viralVideos';

function openVideoHref(item: { embedUrl?: string; videoUrl?: string; videoFileUrl?: string; slug?: string }) {
  return item.videoFileUrl || item.embedUrl || item.videoUrl || (item.slug ? `/viral-videos#${encodeURIComponent(item.slug)}` : '/viral-videos');
}

export default function ViralVideosTeaserBlock() {
  const settingsQuery = useQuery({
    queryKey: ['viral-videos', 'frontend-settings'],
    queryFn: () => getPublicViralVideosFrontendSettings(),
    staleTime: 60_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['viral-videos', 'homepage-featured'],
    queryFn: () => getHomepageFeaturedViralVideo(),
    staleTime: 60_000,
    enabled: settingsQuery.data?.frontendEnabled !== false,
  });

  if (settingsQuery.data?.frontendEnabled === false) {
    return null;
  }

  const item = data?.item || null;
  const selectionMode = data?.selectionMode || 'manual';
  const activeItem = item?.isActive === false ? null : item;

  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">Viral Videos</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Homepage viral video</h2>
          <p className="mt-1 text-sm text-slate-600">One editorial video is shown here. News Pulse uses the manual homepage feature when set, or falls back to the latest published video.</p>
        </div>
        <Link to="/viral-videos" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          View archive
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 text-sm text-slate-500">Loading viral videos...</div>
      ) : null}

      {!isLoading && error ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Viral video teaser is unavailable right now.
        </div>
      ) : null}

      {!isLoading && !error && !activeItem ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No published viral videos are available yet.
        </div>
      ) : null}

      {activeItem ? (
        <article className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 md:grid md:grid-cols-[1.2fr_1fr]">
          <div className="aspect-[16/10] bg-slate-200 md:aspect-auto">
            {activeItem.thumbnailUrl ? (
              <img src={activeItem.thumbnailUrl} alt={activeItem.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">No thumbnail</div>
            )}
          </div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span>{String(activeItem.language || 'en').toUpperCase()}</span>
              <span className={`rounded-full px-2 py-0.5 ${selectionMode === 'manual' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                {selectionMode === 'manual' ? 'Manual homepage feature' : 'Latest published fallback'}
              </span>
            </div>
            <div className="text-2xl font-semibold text-slate-900">{activeItem.title}</div>
            {activeItem.sourceName ? <div className="text-sm font-medium text-slate-500">Source: {activeItem.sourceName}</div> : null}
            {activeItem.category ? <div className="text-sm font-medium text-slate-500">Category: {activeItem.category}</div> : null}
            {activeItem.summary ? <p className="text-sm leading-6 text-slate-600">{activeItem.summary}</p> : null}
            <a href={openVideoHref(activeItem)} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Watch now
            </a>
          </div>
        </article>
      ) : null}
    </section>
  );
}