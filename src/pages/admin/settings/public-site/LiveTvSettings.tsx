import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import { normalizeError } from '@/lib/error';
import {
  LIVE_TV_LANGUAGES,
  LIVE_TV_MODES,
  LIVE_TV_PROVIDERS,
  extractYouTubeVideoId,
  normalizeLiveTvSettingsValue,
} from '@/types/publicSiteSettings';

function isValidHttpUrl(raw: string): boolean {
  if (!raw) return true;
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    return true;
  } catch {
    return false;
  }
}

function isValidLiveTvUrl(raw: string, provider: (typeof LIVE_TV_PROVIDERS)[number]): boolean {
  if (!raw.trim()) return true;
  if (provider === 'Custom Embed') return isValidHttpUrl(raw);
  if (!isValidHttpUrl(raw)) return false;
  try {
    const url = new URL(raw.trim());
    if (url.pathname.includes('/embed/')) return true;
  } catch {
    return false;
  }
  return !!extractYouTubeVideoId(raw);
}

export default function LiveTvSettings() {
  const { draft, dirty, patchDraft, saveDraftRemote, status } = usePublicSiteSettingsDraft();
  const liveTv = useMemo(() => {
    return normalizeLiveTvSettingsValue((draft as any)?.liveTv || {});
  }, [draft]);

  const [touchedEmbed, setTouchedEmbed] = useState(false);
  const [touchedFallback, setTouchedFallback] = useState(false);
  const embedUrlOk = isValidLiveTvUrl(liveTv.embedUrl, liveTv.provider);
  const fallbackUrlOk = isValidLiveTvUrl(liveTv.fallbackVideoUrl, liveTv.provider);
  const busy = status === 'saving' || status === 'publishing' || status === 'loading';

  const saveLiveTvSettings = async () => {
    if (!embedUrlOk || !fallbackUrlOk) {
      toast.error('Fix the Live TV URL fields before saving.');
      return;
    }

    try {
      await saveDraftRemote('save-public-site-settings:live-tv');
      toast.success('Live TV settings saved.');
    } catch (error: unknown) {
      toast.error(normalizeError(error as any, 'Failed to save Live TV settings').message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Live TV</div>
        <div className="mt-1 text-sm text-slate-600">Configure News Pulse Live TV for the public homepage without adding partner or source-management features.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Enable Live TV</div>
            <div className="text-xs text-slate-600">If OFF, the public site hides the Live TV section completely.</div>
          </div>
          <Switch checked={liveTv.enabled} onCheckedChange={(v) => patchDraft({ liveTv: { enabled: v } } as any)} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold">Mode</div>
            <div className="mt-1 text-xs text-slate-600">Choose only from the approved Live TV modes.</div>
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={liveTv.mode}
              onChange={(event) => patchDraft({ liveTv: { mode: event.target.value } } as any)}
            >
              {LIVE_TV_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </label>

          <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold">Provider</div>
            <div className="mt-1 text-xs text-slate-600">Use YouTube for the approved current build, or Custom Embed for future external embeds.</div>
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={liveTv.provider}
              onChange={(event) => patchDraft({ liveTv: { provider: event.target.value } } as any)}
            >
              {LIVE_TV_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Embed URL</div>
          <div className="mt-1 text-xs text-slate-600">
            {liveTv.provider === 'YouTube'
              ? 'Paste a YouTube embed URL or a normal YouTube video/live URL. If empty, the public site shows a clean coming soon message.'
              : 'Paste a direct http(s) embed URL. If empty, the public site shows a clean coming soon message.'}
          </div>
          <input
            className={
              `mt-2 w-full rounded border bg-white px-3 py-2 text-sm ` +
              (!touchedEmbed || embedUrlOk ? 'border-slate-300' : 'border-red-300')
            }
            value={liveTv.embedUrl}
            onChange={(e) => {
              setTouchedEmbed(true);
              patchDraft({ liveTv: { embedUrl: e.target.value } } as any);
            }}
            placeholder="https://…"
          />
          {!touchedEmbed || embedUrlOk ? null : (
            <div className="mt-2 text-xs text-red-700">Enter a valid {liveTv.provider === 'YouTube' ? 'YouTube or embed' : 'http(s) embed'} URL.</div>
          )}
        </label>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Fallback Video URL</div>
          <div className="mt-1 text-xs text-slate-600">Used for Offline Replay when you want a replay video instead of the main live player.</div>
          <input
            className={
              `mt-2 w-full rounded border bg-white px-3 py-2 text-sm ` +
              (!touchedFallback || fallbackUrlOk ? 'border-slate-300' : 'border-red-300')
            }
            value={liveTv.fallbackVideoUrl}
            onChange={(e) => {
              setTouchedFallback(true);
              patchDraft({ liveTv: { fallbackVideoUrl: e.target.value } } as any);
            }}
            placeholder="https://…"
          />
          {!touchedFallback || fallbackUrlOk ? null : (
            <div className="mt-2 text-xs text-red-700">Enter a valid fallback video URL.</div>
          )}
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold">Show Title</div>
            <div className="mt-1 text-xs text-slate-600">Public section headline shown above the player or message.</div>
            <input
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={liveTv.title}
              onChange={(event) => patchDraft({ liveTv: { title: event.target.value } } as any)}
              placeholder="News Pulse Live TV"
            />
          </label>

          <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold">Language</div>
            <div className="mt-1 text-xs text-slate-600">Choose the public language label for this block.</div>
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={liveTv.language}
              onChange={(event) => patchDraft({ liveTv: { language: event.target.value } } as any)}
            >
              {LIVE_TV_LANGUAGES.map((language) => (
                <option key={language} value={language}>{language}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Subtitle</div>
          <div className="mt-1 text-xs text-slate-600">Short supporting text for live, bulletin, replay, or maintenance states.</div>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={liveTv.subtitle}
            onChange={(event) => patchDraft({ liveTv: { subtitle: event.target.value } } as any)}
            placeholder="Latest live coverage, bulletin replay, and breaking updates"
          />
        </label>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Homepage Visibility</div>
            <div className="text-xs text-slate-600">If OFF, the homepage hides the Live TV section even when Live TV is enabled.</div>
          </div>
          <Switch checked={liveTv.showOnHomepage} onCheckedChange={(value) => patchDraft({ liveTv: { showOnHomepage: value } } as any)} />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Save Live TV Settings</div>
            <div className="mt-1 text-xs text-slate-600">Saves and publishes these Live TV settings so the public site keeps them after refresh.</div>
          </div>
          <button
            type="button"
            onClick={() => void saveLiveTvSettings()}
            disabled={busy || !dirty || !embedUrlOk || !fallbackUrlOk}
            className={
              `rounded-lg px-4 py-2 text-sm font-semibold transition ` +
              (busy || !dirty || !embedUrlOk || !fallbackUrlOk
                ? 'bg-slate-300 text-slate-700'
                : 'bg-blue-600 text-white hover:bg-blue-500')
            }
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
