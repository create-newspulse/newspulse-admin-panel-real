import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { publicSiteSettingsApi } from '@/lib/publicSiteSettingsApi';
import {
  DEFAULT_PUBLIC_SITE_SETTINGS,
  LIVE_TV_LANGUAGES,
  LIVE_TV_MODES,
  LIVE_TV_PROVIDERS,
  normalizeLiveTvSettingsValue,
  type PublicSiteSettings,
} from '@/types/publicSiteSettings';

type LiveTvDraft = PublicSiteSettings['liveTv'] & Record<string, any>;
type LoadState = 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';
type LiveStatus = 'LIVE' | 'REPLAY' | 'OFFLINE' | 'SCHEDULED' | 'MAINTENANCE';
type ScheduleStatus = 'Draft' | 'Scheduled' | 'Live' | 'Ended';
type ActivityAction = 'Draft saved' | 'Live published' | 'Live stopped' | 'Replay activated' | 'URL changed' | 'Mode changed' | 'Time updated';

const SCHEDULE_STATUSES: ScheduleStatus[] = ['Draft', 'Scheduled', 'Live', 'Ended'];

const emptyLiveTv: LiveTvDraft = {
  ...DEFAULT_PUBLIC_SITE_SETTINGS.liveTv,
  startTime: '',
  endTime: '',
  nextLiveTime: '',
  countdownText: '',
  scheduleStatus: 'Draft',
};

function normalizeForForm(value: unknown): LiveTvDraft {
  const raw = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  return {
    ...emptyLiveTv,
    ...raw,
    ...normalizeLiveTvSettingsValue({ ...emptyLiveTv, ...raw }),
    startTime: typeof raw.startTime === 'string' ? raw.startTime : '',
    endTime: typeof raw.endTime === 'string' ? raw.endTime : '',
    nextLiveTime: typeof raw.nextLiveTime === 'string' ? raw.nextLiveTime : '',
    countdownText: typeof raw.countdownText === 'string' ? raw.countdownText : '',
    scheduleStatus: SCHEDULE_STATUSES.includes(raw.scheduleStatus) ? raw.scheduleStatus : 'Draft',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : '',
  };
}

function normalizeForSave(value: LiveTvDraft, action: ActivityAction): LiveTvDraft {
  const normalized = normalizeLiveTvSettingsValue(value) as LiveTvDraft;
  return {
    ...value,
    ...normalized,
    startTime: value.startTime || '',
    endTime: value.endTime || '',
    nextLiveTime: value.nextLiveTime || '',
    countdownText: value.countdownText || '',
    scheduleStatus: SCHEDULE_STATUSES.includes(value.scheduleStatus) ? value.scheduleStatus : 'Draft',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin Control Center',
    lastAction: action,
  };
}

function titleFor(settings: LiveTvDraft): string {
  const title = String(settings.title || '').trim();
  if (title) return title;
  if (settings.mode === 'AIRA Bulletin') return 'AIRA Bulletin';
  if (settings.mode === 'Offline Replay') return 'News Pulse Replay';
  return 'News Pulse Live TV';
}

function previewUrlFor(settings: LiveTvDraft): string {
  const normalized = normalizeLiveTvSettingsValue(settings) as LiveTvDraft;
  if (normalized.mode === 'Maintenance / Coming Soon') return '';
  if (normalized.mode === 'Offline Replay' && normalized.fallbackVideoUrl) return normalized.fallbackVideoUrl;
  return normalized.embedUrl || '';
}

function isPreviewableUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function liveStatusFor(settings: LiveTvDraft, previewUrl: string): LiveStatus {
  if (!settings.enabled) return 'OFFLINE';
  if (settings.mode === 'Maintenance / Coming Soon') return 'MAINTENANCE';
  if (settings.scheduleStatus === 'Scheduled' || settings.mode === 'Scheduled Show') return 'SCHEDULED';
  if (settings.mode === 'Offline Replay') return 'REPLAY';
  if (previewUrl) return 'LIVE';
  return 'OFFLINE';
}

function statusClasses(status: LiveStatus): string {
  if (status === 'LIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'REPLAY') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'SCHEDULED') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'MAINTENANCE') return 'border-violet-200 bg-violet-50 text-violet-800';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function formatWhen(value: string): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function fieldClass(extra = ''): string {
  return `w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${extra}`;
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: LiveStatus | 'SAFE' }) {
  const toneClass = tone && tone !== 'SAFE' ? statusClasses(tone) : tone === 'SAFE' ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-950';
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-xl font-bold">{value}</div>
    </div>
  );
}

function ActivityLog({ entries }: { entries: Array<{ action: ActivityAction; detail: string; at: string }> }) {
  if (!entries.length) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Activity Log</h2>
      <div className="mt-4 space-y-3">
        {entries.map((entry, index) => (
          <div key={`${entry.at}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="font-semibold text-slate-950">{entry.action}</div>
            <div className="mt-1 text-slate-600">{entry.detail}</div>
            <div className="mt-1 text-xs text-slate-500">{formatWhen(entry.at)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LiveTVControl() {
  const [draftSettings, setDraftSettings] = useState<PublicSiteSettings>(DEFAULT_PUBLIC_SITE_SETTINGS);
  const [publishedSettings, setPublishedSettings] = useState<PublicSiteSettings>(DEFAULT_PUBLIC_SITE_SETTINGS);
  const [formLiveTv, setFormLiveTv] = useState<LiveTvDraft>(emptyLiveTv);
  const [previewLiveTv, setPreviewLiveTv] = useState<LiveTvDraft>(emptyLiveTv);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [updatedBy, setUpdatedBy] = useState<string>('');
  const [activity, setActivity] = useState<Array<{ action: ActivityAction; detail: string; at: string }>>([]);

  const previewUrl = useMemo(() => previewUrlFor(previewLiveTv), [previewLiveTv]);
  const validPreviewUrl = isPreviewableUrl(previewUrl);
  const currentStatus = liveStatusFor(formLiveTv, previewUrlFor(formLiveTv));
  const currentTitle = titleFor(formLiveTv);
  const busy = loadState === 'loading' || loadState === 'saving' || loadState === 'publishing';

  const addActivity = useCallback((action: ActivityAction, detail: string) => {
    setActivity((entries) => [{ action, detail, at: new Date().toISOString() }, ...entries].slice(0, 8));
  }, []);

  const refreshSettings = useCallback(async () => {
    setLoadState('loading');
    try {
      const bundle = await publicSiteSettingsApi.getAdminPublicSiteSettingsBundle();
      const nextDraft = bundle.draft || bundle.published || DEFAULT_PUBLIC_SITE_SETTINGS;
      const nextLiveTv = normalizeForForm(nextDraft.liveTv);
      const meta: any = bundle.meta || {};
      setDraftSettings(nextDraft);
      setPublishedSettings(bundle.published || nextDraft);
      setFormLiveTv(nextLiveTv);
      setPreviewLiveTv(nextLiveTv);
      setLastUpdated(meta.draftUpdatedAt || meta.updatedAt || nextLiveTv.updatedAt || '');
      setUpdatedBy(nextLiveTv.updatedBy || meta.draftUpdatedBy || meta.updatedBy || '');
      setLoadState('ready');
    } catch (error: any) {
      setDraftSettings(DEFAULT_PUBLIC_SITE_SETTINGS);
      setPublishedSettings(DEFAULT_PUBLIC_SITE_SETTINGS);
      setFormLiveTv(emptyLiveTv);
      setPreviewLiveTv(emptyLiveTv);
      setLoadState('error');
      toast.error(error?.message || 'Failed to load Live TV settings');
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const updateLiveTv = useCallback((patch: Partial<LiveTvDraft>) => {
    setFormLiveTv((current) => ({ ...current, ...patch }));
  }, []);

  const saveDraft = useCallback(async (nextLiveTv: LiveTvDraft, action: ActivityAction, detail: string) => {
    setLoadState('saving');
    try {
      const liveTv = normalizeForSave(nextLiveTv, action);
      const nextSettings = { ...draftSettings, liveTv } as PublicSiteSettings;
      const saved = await publicSiteSettingsApi.putAdminPublicSiteSettingsDraft(nextSettings, { action: `live-tv-control:${action.toLowerCase().replace(/\s+/g, '-')}` });
      const savedLiveTv = normalizeForForm(saved.liveTv);
      setDraftSettings(saved);
      setFormLiveTv(savedLiveTv);
      setPreviewLiveTv(savedLiveTv);
      setLastUpdated(savedLiveTv.updatedAt || new Date().toISOString());
      setUpdatedBy(savedLiveTv.updatedBy || 'Admin Control Center');
      setLoadState('ready');
      addActivity(action, detail);
      toast.success(detail);
      return saved;
    } catch (error: any) {
      setLoadState('error');
      toast.error(error?.message || 'Failed to save Live TV draft');
      throw error;
    }
  }, [addActivity, draftSettings]);

  const publishSettings = useCallback(async (nextLiveTv: LiveTvDraft, action: ActivityAction, detail: string) => {
    setLoadState('publishing');
    try {
      const liveTv = normalizeForSave(nextLiveTv, action);
      const nextSettings = { ...draftSettings, liveTv } as PublicSiteSettings;
      await publicSiteSettingsApi.putAdminPublicSiteSettingsDraft(nextSettings, { action: `live-tv-control:${action.toLowerCase().replace(/\s+/g, '-')}:draft` });
      const published = await publicSiteSettingsApi.publishAdminPublicSiteSettings(nextSettings, { action: `live-tv-control:${action.toLowerCase().replace(/\s+/g, '-')}:publish` });
      const publishedLiveTv = normalizeForForm(published.liveTv);
      setDraftSettings(published);
      setPublishedSettings(published);
      setFormLiveTv(publishedLiveTv);
      setPreviewLiveTv(publishedLiveTv);
      setLastUpdated(publishedLiveTv.updatedAt || new Date().toISOString());
      setUpdatedBy(publishedLiveTv.updatedBy || 'Admin Control Center');
      setLoadState('ready');
      addActivity(action, detail);
      toast.success(detail);
      return published;
    } catch (error: any) {
      setLoadState('error');
      toast.error(error?.message || 'Failed to publish Live TV settings');
      throw error;
    }
  }, [addActivity, draftSettings]);

  const handleSaveDraft = () => {
    void saveDraft(formLiveTv, 'Draft saved', 'Live TV draft saved.');
  };

  const handlePreview = () => {
    const nextPreview = normalizeForForm(formLiveTv);
    setPreviewLiveTv(nextPreview);
    toast.success('Preview refreshed.');
  };

  const handlePublishLive = () => {
    const nextLiveTv = { ...formLiveTv, enabled: true, showOnHomepage: true, scheduleStatus: 'Live' as ScheduleStatus };
    void publishSettings(nextLiveTv, 'Live published', 'Live TV published.');
  };

  const handleDeactivate = () => {
    const nextLiveTv = { ...formLiveTv, enabled: false, showOnHomepage: false, scheduleStatus: 'Ended' as ScheduleStatus };
    void publishSettings(nextLiveTv, 'Live stopped', 'Live TV deactivated.');
  };

  const handleStartLive = () => {
    const nextLiveTv = {
      ...formLiveTv,
      enabled: true,
      showOnHomepage: true,
      mode: formLiveTv.mode === 'Maintenance / Coming Soon' || formLiveTv.mode === 'Offline Replay' ? 'News Pulse Live' : formLiveTv.mode,
      scheduleStatus: 'Live' as ScheduleStatus,
    };
    void publishSettings(nextLiveTv, 'Live published', 'Live TV started.');
  };

  const handleSwitchReplay = () => {
    const nextLiveTv = { ...formLiveTv, enabled: true, showOnHomepage: true, mode: 'Offline Replay', scheduleStatus: 'Live' as ScheduleStatus };
    void publishSettings(nextLiveTv, 'Replay activated', 'Offline replay activated.');
  };

  const handleMaintenance = () => {
    const nextLiveTv = { ...formLiveTv, enabled: true, showOnHomepage: true, mode: 'Maintenance / Coming Soon', scheduleStatus: 'Ended' as ScheduleStatus };
    void publishSettings(nextLiveTv, 'Live stopped', 'Maintenance mode published.');
  };

  const handleReset = () => {
    const liveTv = normalizeForForm(publishedSettings.liveTv);
    setFormLiveTv(liveTv);
    setPreviewLiveTv(liveTv);
    toast.success('Live TV form reset to published settings.');
  };

  return (
    <div className="space-y-6 text-slate-950">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-red-900 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Live TV Control</h1>
            <p className="mt-1 text-sm text-slate-200">Manage, schedule, preview, and publish News Pulse Live TV.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className={`rounded-full border px-3 py-1 ${statusClasses(currentStatus)}`}>{currentStatus}</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white">Safety: SAFE</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white">
              {busy ? 'Working...' : lastUpdated ? `Updated ${formatWhen(lastUpdated)}` : 'Ready'}
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Current Status" value={currentStatus} tone={currentStatus} />
        <StatCard label="Mode" value={formLiveTv.mode} />
        <StatCard label="Provider" value={formLiveTv.provider} />
        <StatCard label="Schedule" value={formLiveTv.scheduleStatus || 'Draft'} tone={currentStatus === 'SCHEDULED' ? 'SCHEDULED' : undefined} />
        <StatCard label="Safety" value="SAFE" tone="SAFE" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Live Status Control</h2>
            <p className="mt-1 text-sm text-slate-600">Fast operations for the active public Live TV state.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleStartLive} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">Start Live</button>
            <button type="button" onClick={handleDeactivate} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">Stop Live / Deactivate</button>
            <button type="button" onClick={handleSwitchReplay} disabled={busy} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-60">Switch to Replay</button>
            <button type="button" onClick={handleMaintenance} disabled={busy} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">Maintenance / Coming Soon</button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Live Stream Input</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Mode
                <select
                  className={fieldClass('mt-2')}
                  value={formLiveTv.mode}
                  onChange={(event) => {
                    updateLiveTv({ mode: event.target.value });
                    addActivity('Mode changed', `Mode set to ${event.target.value}.`);
                  }}
                >
                  {LIVE_TV_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Provider
                <select className={fieldClass('mt-2')} value={formLiveTv.provider} onChange={(event) => updateLiveTv({ provider: event.target.value })}>
                  {LIVE_TV_PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Embed URL
                <input
                  className={fieldClass('mt-2')}
                  value={formLiveTv.embedUrl}
                  onChange={(event) => updateLiveTv({ embedUrl: event.target.value })}
                  onBlur={() => addActivity('URL changed', 'Embed URL updated in the control form.')}
                  placeholder="https://www.youtube.com/embed/..."
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Fallback Video URL
                <input
                  className={fieldClass('mt-2')}
                  value={formLiveTv.fallbackVideoUrl}
                  onChange={(event) => updateLiveTv({ fallbackVideoUrl: event.target.value })}
                  onBlur={() => addActivity('URL changed', 'Fallback video URL updated in the control form.')}
                  placeholder="https://www.youtube.com/embed/..."
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Show Title
                <input className={fieldClass('mt-2')} value={formLiveTv.title} onChange={(event) => updateLiveTv({ title: event.target.value })} placeholder="News Pulse Live TV" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Language
                <select className={fieldClass('mt-2')} value={formLiveTv.language} onChange={(event) => updateLiveTv({ language: event.target.value })}>
                  {LIVE_TV_LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Subtitle
                <input className={fieldClass('mt-2')} value={formLiveTv.subtitle} onChange={(event) => updateLiveTv({ subtitle: event.target.value })} placeholder="Latest live coverage, bulletin replay, and breaking updates" />
              </label>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:col-span-2">
                Homepage Visibility
                <input type="checkbox" checked={Boolean(formLiveTv.showOnHomepage)} onChange={(event) => updateLiveTv({ showOnHomepage: event.target.checked })} className="h-5 w-5 rounded border-slate-300 text-blue-600" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Live Time / Schedule</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Start Time
                <input type="datetime-local" className={fieldClass('mt-2')} value={formLiveTv.startTime || ''} onChange={(event) => updateLiveTv({ startTime: event.target.value })} onBlur={() => addActivity('Time updated', 'Start time updated.')} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                End Time
                <input type="datetime-local" className={fieldClass('mt-2')} value={formLiveTv.endTime || ''} onChange={(event) => updateLiveTv({ endTime: event.target.value })} onBlur={() => addActivity('Time updated', 'End time updated.')} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Next Live Time
                <input type="datetime-local" className={fieldClass('mt-2')} value={formLiveTv.nextLiveTime || ''} onChange={(event) => updateLiveTv({ nextLiveTime: event.target.value })} onBlur={() => addActivity('Time updated', 'Next live time updated.')} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Schedule Status
                <select className={fieldClass('mt-2')} value={formLiveTv.scheduleStatus || 'Draft'} onChange={(event) => updateLiveTv({ scheduleStatus: event.target.value })}>
                  {SCHEDULE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Optional countdown text
                <input className={fieldClass('mt-2')} value={formLiveTv.countdownText || ''} onChange={(event) => updateLiveTv({ countdownText: event.target.value })} onBlur={() => addActivity('Time updated', 'Countdown text updated.')} placeholder="Live starts at 8:00 PM" />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Preview Player</h2>
                <p className="mt-1 text-sm text-slate-600">{titleFor(previewLiveTv)}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${statusClasses(liveStatusFor(previewLiveTv, previewUrl))}`}>{liveStatusFor(previewLiveTv, previewUrl)}</span>
            </div>
            <div className="p-5">
              {loadState === 'error' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-10 text-center text-sm font-semibold text-amber-900">Could not load the current Live TV settings. Use Refresh Preview to try again.</div>
              ) : validPreviewUrl ? (
                <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
                  <iframe key={previewUrl} title={titleFor(previewLiveTv)} src={previewUrl} className="h-full w-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-12 text-center">
                  <div className="text-lg font-semibold text-slate-900">News Pulse Live TV is coming soon.</div>
                  <p className="mt-2 text-sm text-slate-600">The preview appears after a valid saved or draft embed URL is available.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Publish Controls</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <button type="button" onClick={handleSaveDraft} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">Save Draft</button>
              <button type="button" onClick={handlePreview} disabled={busy} className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-white disabled:opacity-60">Preview</button>
              <button type="button" onClick={handlePublishLive} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">Publish LIVE</button>
              <button type="button" onClick={handleDeactivate} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">Deactivate</button>
              <button type="button" onClick={handleReset} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">Reset</button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Quick Links</h2>
            <div className="mt-4 grid gap-3">
              <Link to="/live-tv" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50">Open Public Live TV</Link>
              <Link to="/admin/settings/public-site/live-tv" className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-500">Edit Basic Live TV Settings</Link>
              <button type="button" onClick={() => void refreshSettings()} disabled={busy} className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-white disabled:opacity-60">Refresh Preview</button>
            </div>
          </section>
        </aside>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Current Stream Details</h2>
        <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><dt className="font-semibold text-slate-500">Current title</dt><dd className="mt-1 text-slate-950">{currentTitle}</dd></div>
          <div><dt className="font-semibold text-slate-500">Current mode</dt><dd className="mt-1 text-slate-950">{formLiveTv.mode}</dd></div>
          <div><dt className="font-semibold text-slate-500">Provider</dt><dd className="mt-1 text-slate-950">{formLiveTv.provider}</dd></div>
          <div><dt className="font-semibold text-slate-500">Online / Offline</dt><dd className="mt-1 text-slate-950">{formLiveTv.enabled ? 'Online' : 'Offline'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Homepage visibility</dt><dd className="mt-1 text-slate-950">{formLiveTv.showOnHomepage ? 'Visible' : 'Hidden'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Last updated time</dt><dd className="mt-1 text-slate-950">{lastUpdated ? formatWhen(lastUpdated) : 'Not available'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Updated by</dt><dd className="mt-1 text-slate-950">{updatedBy || 'Not available'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Next live time</dt><dd className="mt-1 text-slate-950">{formatWhen(formLiveTv.nextLiveTime || '')}</dd></div>
          <div className="md:col-span-2"><dt className="font-semibold text-slate-500">Current embed URL</dt><dd className="mt-1 break-all text-slate-950">{formLiveTv.embedUrl || 'No embed URL saved'}</dd></div>
          <div className="md:col-span-2"><dt className="font-semibold text-slate-500">Fallback URL</dt><dd className="mt-1 break-all text-slate-950">{formLiveTv.fallbackVideoUrl || 'No fallback URL saved'}</dd></div>
        </dl>
      </section>

      <ActivityLog entries={activity} />
    </div>
  );
}