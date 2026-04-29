import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { getPublicViralVideosFrontendSettings, listPublicViralVideos } from '@/lib/api/viralVideos';

function getVideoHref(item: { embedUrl?: string; videoUrl?: string }) {
  return item.embedUrl || item.videoUrl || '#';
}

function formatDate(value?: string | null) {
  if (!value) return 'Unpublished';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unpublished';
}

export default function ViralVideosArchivePage() {
  const settingsQuery = useQuery({
    queryKey: ['viral-videos', 'frontend-settings'],
    queryFn: () => getPublicViralVideosFrontendSettings(),
    staleTime: 60_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['viral-videos', 'archive'],
    queryFn: () => listPublicViralVideos(),
    staleTime: 60_000,
    enabled: settingsQuery.data?.frontendEnabled !== false,
  });

  if (settingsQuery.data?.frontendEnabled === false) {
    return <Navigate to="/" replace />;
  }

  const items = Array.isArray(data) ? data : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">Viral Videos</div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">Latest viral video archive</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Published editorial video picks from the NewsPulse desk. Featured items rise to the homepage teaser, while this archive keeps the full published feed.
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
                <div className="aspect-[16/10] bg-slate-200">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">No thumbnail</div>
                  )}
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <span>{String(item.language || 'en').toUpperCase()}</span>
                    <span>{formatDate(item.publishedAt)}</span>
                    {item.featured ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Featured</span> : null}
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
                  {item.summary ? <p className="text-sm leading-6 text-slate-600">{item.summary}</p> : null}
                  <a href={getVideoHref(item)} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                    Open video
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}