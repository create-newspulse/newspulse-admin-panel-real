import { useMemo, useState } from 'react';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from '@/types/publicSiteSettings';

export default function InspirationHubSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();
  const [touchedUrl, setTouchedUrl] = useState(false);

  const inspirationHub = useMemo(() => {
    const value = (draft as any)?.inspirationHub || {};
    const youtubeUrl =
      typeof value.youtubeUrl === 'string' && value.youtubeUrl.trim()
        ? value.youtubeUrl
        : typeof value.droneTvYoutubeUrl === 'string'
          ? value.droneTvYoutubeUrl
          : '';
    const embedUrl =
      typeof value.embedUrl === 'string' && value.embedUrl.trim()
        ? value.embedUrl
        : getYouTubeEmbedUrl(youtubeUrl);
    const title =
      typeof value.title === 'string' && value.title.trim()
        ? value.title
        : typeof value.videoTitle === 'string'
          ? value.videoTitle
          : '';
    const subtitle =
      typeof value.subtitle === 'string' && value.subtitle.trim()
        ? value.subtitle
        : typeof value.videoSubtitle === 'string'
          ? value.videoSubtitle
          : '';
    const showOnCategoryPage =
      typeof value.showOnCategoryPage === 'boolean'
        ? value.showOnCategoryPage
        : typeof value.showOnInspirationHubPage === 'boolean'
          ? value.showOnInspirationHubPage
          : true;

    return {
      enabled: !!value.enabled,
      droneTvEnabled: !!value.droneTvEnabled,
      youtubeUrl,
      embedUrl,
      title,
      subtitle,
      autoplayMuted: typeof value.autoplayMuted === 'boolean' ? value.autoplayMuted : true,
      showOnHomepage: !!value.showOnHomepage,
      showOnCategoryPage,
    };
  }, [draft]);

  const youtubeUrlOk = !inspirationHub.youtubeUrl || !!extractYouTubeVideoId(inspirationHub.youtubeUrl);
  const derivedEmbedUrl = getYouTubeEmbedUrl(inspirationHub.youtubeUrl);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Inspiration Hub</div>
        <div className="mt-1 text-sm text-slate-600">Add an optional DroneTV block without changing any existing Public Site Settings behavior.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="mb-3 text-sm font-semibold text-slate-900">Inspiration Hub Master</div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Enable Inspiration Hub</div>
              <div className="text-xs text-slate-600">Master switch for the whole Inspiration Hub section.</div>
            </div>
            <Switch
              checked={inspirationHub.enabled}
              onCheckedChange={(value) => patchDraft({ inspirationHub: { enabled: value } } as any)}
            />
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            If Inspiration Hub is OFF, DroneTV will not appear even if DroneTV Video is ON.
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
          <div className="text-sm font-semibold text-slate-900">DroneTV Video Block</div>
          {!inspirationHub.enabled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              Turn on Inspiration Hub to show DroneTV publicly.
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Enable DroneTV Video</div>
              <div className="text-xs text-slate-600">Shows or hides only the DroneTV video block inside Inspiration Hub.</div>
            </div>
            <Switch
              checked={inspirationHub.droneTvEnabled}
              onCheckedChange={(value) => patchDraft({ inspirationHub: { droneTvEnabled: value } } as any)}
            />
          </div>

          <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-sm font-semibold">DroneTV YouTube URL</div>
            <div className="mt-1 text-xs text-slate-600">Paste a normal YouTube watch link, short link, shorts link, live link, or embed link.</div>
            <input
              className={
                `mt-2 w-full rounded border bg-white px-3 py-2 text-sm ` +
                (!touchedUrl || youtubeUrlOk ? 'border-slate-300' : 'border-red-300')
              }
              value={inspirationHub.youtubeUrl}
              onChange={(event) => {
                setTouchedUrl(true);
                const youtubeUrl = event.target.value;
                const embedUrl = getYouTubeEmbedUrl(youtubeUrl);
                patchDraft({
                  inspirationHub: {
                    youtubeUrl,
                    embedUrl,
                    droneTvYoutubeUrl: youtubeUrl,
                  },
                } as any);
              }}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            {!touchedUrl || youtubeUrlOk ? null : (
              <div className="mt-2 text-xs text-red-700">Enter a valid YouTube URL. You do not need to paste an embed URL manually.</div>
            )}
            {derivedEmbedUrl ? (
              <div className="mt-2 text-xs text-slate-600">Detected embed URL: {derivedEmbedUrl}</div>
            ) : null}
          </label>

          <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-sm font-semibold">Embed URL</div>
            <div className="mt-1 text-xs text-slate-600">Auto-derived and persisted during save/publish so the frontend can iframe the published value directly.</div>
            <input
              className="mt-2 w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
              value={inspirationHub.embedUrl}
              readOnly
              placeholder="https://www.youtube.com/embed/..."
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold">Video Title</div>
              <div className="mt-1 text-xs text-slate-600">Optional headline shown with the DroneTV block.</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={inspirationHub.title}
                onChange={(event) => patchDraft({ inspirationHub: { title: event.target.value, videoTitle: event.target.value } } as any)}
                placeholder="DroneTV"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold">Video Subtitle</div>
              <div className="mt-1 text-xs text-slate-600">Optional supporting copy for homepage or category placement.</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={inspirationHub.subtitle}
                onChange={(event) => patchDraft({ inspirationHub: { subtitle: event.target.value, videoSubtitle: event.target.value } } as any)}
                placeholder="Stories, views, and inspiration from above"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Autoplay Muted</div>
              <div className="text-xs text-slate-600">Recommended ON because browsers allow autoplay only when muted.</div>
            </div>
            <Switch
              checked={inspirationHub.autoplayMuted}
              onCheckedChange={(value) => patchDraft({ inspirationHub: { autoplayMuted: value } } as any)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
          <div className="text-sm font-semibold text-slate-900">Public Placement</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Show on Homepage</div>
                <div className="text-xs text-slate-600">Display this block on the public homepage.</div>
              </div>
              <Switch
                checked={inspirationHub.showOnHomepage}
                onCheckedChange={(value) => patchDraft({ inspirationHub: { showOnHomepage: value } } as any)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Show on Inspiration Hub Page</div>
                <div className="text-xs text-slate-600">Display this block on the Inspiration Hub category/page.</div>
              </div>
              <Switch
                checked={inspirationHub.showOnCategoryPage}
                onCheckedChange={(value) => patchDraft({ inspirationHub: { showOnCategoryPage: value, showOnInspirationHubPage: value } } as any)}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}