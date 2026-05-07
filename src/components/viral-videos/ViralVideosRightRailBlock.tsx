import { useQuery } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHomepageFeaturedViralVideo, type ViralVideoRecord } from '@/lib/api/viralVideos';

function isEligibleVideo(item: ViralVideoRecord | null | undefined) {
  if (!item) return false;
  const status = String(item.status || '').toLowerCase();
  const hasVideoSource = Boolean(String(item.videoFileUrl || item.videoUrl || item.embedUrl || '').trim());
  const hasThumbnail = Boolean(String(item.thumbnailUrl || '').trim());
  return status === 'published'
    && item.isActive !== false
    && item.homepageVisible === true
    && (item.homepageFeatured === true || item.featured === true)
    && hasThumbnail
    && hasVideoSource;
}

function videoPlayerPath(item: ViralVideoRecord) {
  const slugOrId = String(item.slug || item._id || '').trim();
  return slugOrId ? `/viral-videos/${encodeURIComponent(slugOrId)}` : '/viral-videos';
}

export default function ViralVideosRightRailBlock() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['viral-videos', 'right-rail-featured'],
    queryFn: () => getHomepageFeaturedViralVideo(),
    staleTime: 60_000,
  });

  const item = data?.item || null;

  if (isLoading || isError || data?.frontendEnabled === false || !isEligibleVideo(item)) {
    return null;
  }

  const featuredItem = item as ViralVideoRecord;
  const href = videoPlayerPath(featuredItem);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-label="Viral Videos">
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">Short Video Desk</div>
      </div>

      <Link to={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
        <div className="relative aspect-video bg-slate-100">
          {featuredItem.thumbnailUrl ? (
            <img src={featuredItem.thumbnailUrl} alt={featuredItem.title} className="h-full w-full object-cover" loading="lazy" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm">
            <PlayCircle className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </Link>

      <div className="space-y-2 p-3">
        <Link to={href} className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 hover:text-rose-700">
          {featuredItem.title}
        </Link>
        {featuredItem.summary ? <p className="line-clamp-2 text-xs leading-5 text-slate-600">{featuredItem.summary}</p> : null}
      </div>
    </section>
  );
}
