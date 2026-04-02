import { useMemo, useState } from 'react';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from '@/types/publicSiteSettings';

const LANGUAGE_OPTIONS = [
  { key: 'en', label: 'EN', name: 'English' },
  { key: 'hi', label: 'HI', name: 'Hindi' },
  { key: 'gu', label: 'GU', name: 'Gujarati' },
] as const;

type LocalizedFieldKey =
  | 'sectionTitle'
  | 'sectionSubtitle'
  | 'droneTvTitle'
  | 'droneTvSubtitle'
  | 'dailyWondersHeading'
  | 'quoteText'
  | 'cardText'
  | 'narrationText';

type LanguageKey = (typeof LANGUAGE_OPTIONS)[number]['key'];

function normalizeLocalizedText(value: any) {
  return {
    en: typeof value?.en === 'string' ? value.en : '',
    hi: typeof value?.hi === 'string' ? value.hi : '',
    gu: typeof value?.gu === 'string' ? value.gu : '',
  };
}

export default function InspirationHubSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();
  const [touchedUrl, setTouchedUrl] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<LanguageKey>('en');

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
    const localizedContent = value.localizedContent || {};

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
      localizedContent: {
        sectionTitle: normalizeLocalizedText(localizedContent.sectionTitle),
        sectionSubtitle: normalizeLocalizedText(localizedContent.sectionSubtitle),
        droneTvTitle: normalizeLocalizedText(localizedContent.droneTvTitle || { en: title }),
        droneTvSubtitle: normalizeLocalizedText(localizedContent.droneTvSubtitle || { en: subtitle }),
        dailyWondersHeading: normalizeLocalizedText(localizedContent.dailyWondersHeading),
        quoteText: normalizeLocalizedText(localizedContent.quoteText),
        cardText: normalizeLocalizedText(localizedContent.cardText),
        narrationText: normalizeLocalizedText(localizedContent.narrationText),
      },
    };
  }, [draft]);

  const youtubeUrlOk = !inspirationHub.youtubeUrl || !!extractYouTubeVideoId(inspirationHub.youtubeUrl);
  const derivedEmbedUrl = getYouTubeEmbedUrl(inspirationHub.youtubeUrl);

  const updateLocalizedField = (field: LocalizedFieldKey, language: LanguageKey, value: string) => {
    patchDraft({
      inspirationHub: {
        localizedContent: {
          [field]: {
            [language]: value,
          },
        },
      },
    } as any);
  };

  const localizedFieldValue = (field: LocalizedFieldKey) => inspirationHub.localizedContent[field][activeLanguage] || '';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Inspiration Hub</div>
        <div className="mt-1 text-sm text-slate-600">Add an optional DroneTV block without changing any existing Public Site Settings behavior.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Enable Inspiration Hub</div>
            <div className="text-xs text-slate-600">Keeps this feature fully optional. Existing site behavior stays unchanged when off.</div>
          </div>
          <Switch
            checked={inspirationHub.enabled}
            onCheckedChange={(value) => patchDraft({ inspirationHub: { enabled: value } } as any)}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Enable DroneTV Video</div>
            <div className="text-xs text-slate-600">Lets admin attach a YouTube video for Inspiration Hub surfaces.</div>
          </div>
          <Switch
            checked={inspirationHub.droneTvEnabled}
            onCheckedChange={(value) => patchDraft({ inspirationHub: { droneTvEnabled: value } } as any)}
          />
        </div>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
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

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Embed URL</div>
          <div className="mt-1 text-xs text-slate-600">Auto-derived and persisted during save/publish so the frontend can iframe the published value directly.</div>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
            value={inspirationHub.embedUrl}
            readOnly
            placeholder="https://www.youtube.com/embed/..."
          />
        </label>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Video Title</div>
          <div className="mt-1 text-xs text-slate-600">Optional headline shown with the DroneTV block.</div>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={inspirationHub.title}
            onChange={(event) => patchDraft({ inspirationHub: { title: event.target.value, videoTitle: event.target.value } } as any)}
            placeholder="DroneTV"
          />
        </label>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Video Subtitle</div>
          <div className="mt-1 text-xs text-slate-600">Optional supporting copy for homepage or category placement.</div>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={inspirationHub.subtitle}
            onChange={(event) => patchDraft({ inspirationHub: { subtitle: event.target.value, videoSubtitle: event.target.value } } as any)}
            placeholder="Stories, views, and inspiration from above"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Autoplay Muted</div>
              <div className="text-xs text-slate-600">Stores the preferred autoplay-safe playback mode.</div>
            </div>
            <Switch
              checked={inspirationHub.autoplayMuted}
              onCheckedChange={(value) => patchDraft({ inspirationHub: { autoplayMuted: value } } as any)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Show on Homepage</div>
              <div className="text-xs text-slate-600">Controls homepage visibility only for the new Inspiration Hub block.</div>
            </div>
            <Switch
              checked={inspirationHub.showOnHomepage}
              onCheckedChange={(value) => patchDraft({ inspirationHub: { showOnHomepage: value } } as any)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
            <div>
              <div className="text-sm font-semibold">Show on Inspiration Hub Page</div>
              <div className="text-xs text-slate-600">Controls the Inspiration Hub category page independently of homepage placement.</div>
            </div>
            <Switch
              checked={inspirationHub.showOnCategoryPage}
              onCheckedChange={(value) => patchDraft({ inspirationHub: { showOnCategoryPage: value, showOnInspirationHubPage: value } } as any)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-4">
          <div>
            <div className="text-sm font-semibold">Localized Content</div>
            <div className="mt-1 text-xs text-slate-600">Optional EN / HI / GU copy for Inspiration Hub. Existing single-language video fields remain active and unchanged.</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((language) => {
              const active = activeLanguage === language.key;
              return (
                <button
                  key={language.key}
                  type="button"
                  onClick={() => setActiveLanguage(language.key)}
                  className={
                    'rounded-lg border px-3 py-2 text-sm font-semibold ' +
                    (active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100')
                  }
                >
                  {language.label} · {language.name}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold">Section Title</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={localizedFieldValue('sectionTitle')}
                onChange={(event) => updateLocalizedField('sectionTitle', activeLanguage, event.target.value)}
                placeholder="Inspiration Hub"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold">Section Subtitle</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={localizedFieldValue('sectionSubtitle')}
                onChange={(event) => updateLocalizedField('sectionSubtitle', activeLanguage, event.target.value)}
                placeholder="Uplifting visual stories and calm moments"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold">DroneTV Title</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={localizedFieldValue('droneTvTitle')}
                onChange={(event) => updateLocalizedField('droneTvTitle', activeLanguage, event.target.value)}
                placeholder="DroneTV"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold">DroneTV Subtitle</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={localizedFieldValue('droneTvSubtitle')}
                onChange={(event) => updateLocalizedField('droneTvSubtitle', activeLanguage, event.target.value)}
                placeholder="Stories, views, and inspiration from above"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Daily Wonders Heading</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={localizedFieldValue('dailyWondersHeading')}
                onChange={(event) => updateLocalizedField('dailyWondersHeading', activeLanguage, event.target.value)}
                placeholder="Daily Wonders"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Quote Text</div>
              <textarea
                rows={3}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={localizedFieldValue('quoteText')}
                onChange={(event) => updateLocalizedField('quoteText', activeLanguage, event.target.value)}
                placeholder="A short uplifting quote for this language"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Card Text</div>
              <textarea
                rows={3}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={localizedFieldValue('cardText')}
                onChange={(event) => updateLocalizedField('cardText', activeLanguage, event.target.value)}
                placeholder="Optional descriptive card copy for this language"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Narration Text</div>
              <div className="mt-1 text-xs text-slate-600">Optional voice-ready text for site narration only. Frontend can fall back to visible translated text if this is empty.</div>
              <textarea
                rows={4}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={localizedFieldValue('narrationText')}
                onChange={(event) => updateLocalizedField('narrationText', activeLanguage, event.target.value)}
                placeholder="Optional narration script for this language"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}