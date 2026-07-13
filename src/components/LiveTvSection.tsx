import React, { useEffect, useMemo, useState } from 'react';
import settingsApi from '@/lib/settingsApi';
import {
  DEFAULT_PUBLIC_SITE_SETTINGS,
  normalizeLiveTvSettingsValue,
  type PublicSiteSettings,
} from '@/types/publicSiteSettings';

type LiveTvSettingsValue = PublicSiteSettings['liveTv'];
type LiveTvDisplaySettings = LiveTvSettingsValue & {
  sourceType?: string;
  offlinePosterImage?: string;
  offlineLoopVideo?: string;
  offlineMessage?: string;
};

const DEFAULT_OFFLINE_MESSAGE = 'News Pulse Live TV will return shortly.';

function firstObject(...values: unknown[]) {
  return values.find((value) => value && typeof value === 'object') as Record<string, unknown> | undefined;
}

function extractLiveTvSettings(input: unknown): LiveTvDisplaySettings {
  const raw = input as any;
  const value = firstObject(
    raw?.settings?.published?.liveTv,
    raw?.settings?.liveTv,
    raw?.published?.liveTv,
    raw?.public?.liveTv,
    raw?.liveTv,
  ) || {};

  return normalizeLiveTvSettingsValue({
    ...DEFAULT_PUBLIC_SITE_SETTINGS.liveTv,
    ...value,
  }) as LiveTvDisplaySettings;
}

function defaultTitleForMode(settings: LiveTvSettingsValue): string {
  if (settings.title.trim()) return settings.title.trim();
  if (settings.mode === 'AIRA Bulletin') return 'AIRA Bulletin';
  if (settings.mode === 'Offline Replay') return 'News Pulse Replay';
  if (settings.mode === 'Maintenance / Coming Soon') return 'News Pulse Live TV';
  return 'News Pulse Live TV';
}

function isOfflineDisplayMode(settings: LiveTvDisplaySettings): boolean {
  return settings.sourceType === 'MAINTENANCE' || settings.sourceType === 'OFFLINE_REPLAY' || settings.mode === 'Maintenance / Coming Soon' || settings.mode === 'Offline Replay';
}

function offlineLoopVideoFor(settings: LiveTvDisplaySettings): string {
  return String(settings.offlineLoopVideo || '').trim();
}

function offlinePosterImageFor(settings: LiveTvDisplaySettings): string {
  return String(settings.offlinePosterImage || '').trim();
}

function offlineMessageFor(settings: LiveTvDisplaySettings): string {
  return String(settings.offlineMessage || '').trim() || DEFAULT_OFFLINE_MESSAGE;
}

function isRenderableMediaPath(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const LiveTvSection: React.FC = () => {
  const [settings, setSettings] = useState<LiveTvDisplaySettings>(DEFAULT_PUBLIC_SITE_SETTINGS.liveTv as LiveTvDisplaySettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    settingsApi.getPublicSettings()
      .then((raw) => {
        if (alive) setSettings(extractLiveTvSettings(raw));
      })
      .catch((error) => {
        console.error('Failed to load Live TV settings:', error);
        if (alive) setSettings(DEFAULT_PUBLIC_SITE_SETTINGS.liveTv);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const playerUrl = useMemo(() => {
    if (settings.mode === 'Maintenance / Coming Soon') return '';
    if (settings.mode === 'Offline Replay' && settings.fallbackVideoUrl) return settings.fallbackVideoUrl;
    return settings.embedUrl;
  }, [settings]);

  const title = defaultTitleForMode(settings);
  const subtitle = settings.subtitle.trim();
  const offlineDisplayMode = isOfflineDisplayMode(settings);
  const offlineLoopVideoValue = offlineDisplayMode ? offlineLoopVideoFor(settings) : '';
  const offlinePosterImageValue = offlineDisplayMode ? offlinePosterImageFor(settings) : '';
  const offlineLoopVideo = isRenderableMediaPath(offlineLoopVideoValue) ? offlineLoopVideoValue : '';
  const offlinePosterImage = isRenderableMediaPath(offlinePosterImageValue) ? offlinePosterImageValue : '';
  const comingSoon = !offlineLoopVideo && !offlinePosterImage && (settings.mode === 'Maintenance / Coming Soon' || !playerUrl);
  const replayMode = settings.mode === 'Offline Replay' && !!settings.fallbackVideoUrl;

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-7 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (!settings.enabled || !settings.showOnHomepage) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-red-900 px-5 py-5 text-white">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-100">
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1">{settings.mode}</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1">{settings.language}</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm text-slate-200">{subtitle}</p> : null}
      </div>

      <div className="p-5">
        {offlineLoopVideo ? (
          <div className="space-y-3">
            <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
              <video
                key={offlineLoopVideo}
                src={offlineLoopVideo}
                className="h-full w-full bg-slate-950 object-contain"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">Offline Loop</span>
            </div>
          </div>
        ) : offlinePosterImage ? (
          <div className="space-y-3">
            <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
              <img src={offlinePosterImage} alt={title} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Offline Poster</span>
            </div>
          </div>
        ) : comingSoon ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
            <div className="text-lg font-semibold text-slate-900">{offlineMessageFor(settings)}</div>
            <p className="mt-2 text-sm text-slate-600">
              {settings.mode === 'Maintenance / Coming Soon'
                ? 'The live section is currently in maintenance mode. Please check back shortly.'
                : 'The live player will appear here after a valid embed URL is added in the Admin Panel.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
              <iframe
                title={title}
                src={playerUrl}
                className="h-full w-full border-0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{settings.provider}</span>
              {replayMode ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">Replay Video</span> : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveTvSection;