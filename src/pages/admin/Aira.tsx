import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { publicSiteSettingsApi } from '@/lib/publicSiteSettingsApi';
import { DEFAULT_PUBLIC_SITE_SETTINGS, type PublicSiteSettings } from '@/types/publicSiteSettings';

const languages = ['Gujarati', 'Hindi', 'English'] as const;
const bulletinTypes = ['Early Morning', 'Morning', 'Noon', 'Afternoon', 'Evening', 'Prime Time', 'Night', 'Breaking'] as const;
const durations = [3, 5, 10, 15, 25, 30] as const;
const publicLabels = ['AIRA BULLETIN', 'AIRA BULLETIN • ON AIR', 'SCHEDULED', 'REPLAY', 'BREAKING BULLETIN'] as const;
const dressStyles = ['Navy Blazer', 'Saree', 'Formal', 'Prime Time', 'Breaking'] as const;
const tones = ['Calm', 'Serious', 'Prime Time', 'Breaking'] as const;
const studioTemplates = ['International', 'National', 'Gujarat', 'Business', 'Breaking'] as const;
const voiceSpeeds = ['Slow', 'Normal', 'Newsreader'] as const;
const visualTypes = ['anchor_only', 'image', 'video', 'map', 'headline_card', 'timeline', 'breaking_banner', 'sponsor_card'] as const;
const statuses = ['Draft', 'Ready for Review', 'Approved', 'Scheduled', 'Published', 'Completed', 'Archived', 'Rejected'] as const;

const STORAGE_KEY = 'newspulse:aira:manual-bulletins:v2';
const AIRA_BULLETINS_API_URL = String(import.meta.env.VITE_AIRA_BULLETINS_API_URL || '').trim();
const browserVoiceMessage = 'Browser voice preview is available for local testing. Server TTS can be connected later.';
const uploadMessage = 'Paste a YouTube or MP4 URL for the bulletin video. MP4 upload can be connected later if needed.';
const liveTvScheduleMessage = 'Schedule this approved bulletin for News Pulse Live TV or save it for replay/program queue.';

type Language = (typeof languages)[number];
type BulletinType = (typeof bulletinTypes)[number];
type Duration = (typeof durations)[number];
type PublicLabel = (typeof publicLabels)[number];
type DressStyle = (typeof dressStyles)[number];
type Tone = (typeof tones)[number];
type StudioTemplate = (typeof studioTemplates)[number];
type VoiceSpeed = (typeof voiceSpeeds)[number];
type VisualType = (typeof visualTypes)[number];
type BulletinStatus = (typeof statuses)[number];

type VisualBlock = {
  id: string;
  startTime: string;
  endTime: string;
  visualType: VisualType;
  title: string;
  description: string;
  sourceCredit: string;
  mediaUrl: string;
};

type AiraBulletin = {
  id: string;
  bulletinTitle: string;
  language: Language;
  bulletinType: BulletinType;
  duration: Duration;
  scheduleDate: string;
  scheduleTime: string;
  endTime: string;
  publicLabel: PublicLabel;
  anchorName: string;
  anchorFace: string;
  dressStyle: DressStyle;
  voiceStyle: string;
  tone: Tone;
  studioTemplate: StudioTemplate;
  script: string;
  voiceSpeed: VoiceSpeed;
  youtubeUrl: string;
  mp4Url: string;
  visualTimeline: VisualBlock[];
  repeat: 'none';
  status: BulletinStatus;
  createdAt: string;
  updatedAt: string;
};

type LiveTvDraft = PublicSiteSettings['liveTv'] & Record<string, any>;

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createVisualBlock(): VisualBlock {
  return {
    id: createId('visual'),
    startTime: '00:00',
    endTime: '00:30',
    visualType: 'anchor_only',
    title: '',
    description: '',
    sourceCredit: '',
    mediaUrl: '',
  };
}

function createEmptyBulletin(): AiraBulletin {
  const now = new Date().toISOString();
  return {
    id: createId('aira'),
    bulletinTitle: '',
    language: 'Gujarati',
    bulletinType: 'Prime Time',
    duration: 5,
    scheduleDate: '',
    scheduleTime: '',
    endTime: '',
    publicLabel: 'AIRA BULLETIN',
    anchorName: 'AIRA',
    anchorFace: 'Default AIRA',
    dressStyle: 'Navy Blazer',
    voiceStyle: 'Professional Female Newsreader',
    tone: 'Calm',
    studioTemplate: 'Gujarat',
    script: '',
    voiceSpeed: 'Normal',
    youtubeUrl: '',
    mp4Url: '',
    visualTimeline: [createVisualBlock()],
    repeat: 'none',
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
  };
}

function fieldClass(extra = ''): string {
  return `w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 ${extra}`;
}

function buttonClass(tone: 'primary' | 'secondary' | 'danger' | 'dark' = 'secondary'): string {
  if (tone === 'primary') return 'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60';
  if (tone === 'danger') return 'rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60';
  if (tone === 'dark') return 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60';
  return 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60';
}

function noticeClass(tone: 'amber' | 'blue' = 'amber'): string {
  return tone === 'blue'
    ? 'rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900'
    : 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900';
}

function parseBulletins(input: unknown): AiraBulletin[] {
  const items = Array.isArray(input) ? input : [];
  return items.map((item) => ({ ...createEmptyBulletin(), ...(item && typeof item === 'object' ? item : {}) } as AiraBulletin));
}

function readLocalBulletins(): AiraBulletin[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseBulletins(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function writeLocalBulletins(items: AiraBulletin[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function loadBulletins(): Promise<{ items: AiraBulletin[]; source: 'api' | 'local' }> {
  if (AIRA_BULLETINS_API_URL) {
    try {
      const response = await fetch(AIRA_BULLETINS_API_URL, { credentials: 'include' });
      if (response.ok) {
        const json = await response.json().catch(() => []);
        return { items: parseBulletins(Array.isArray(json) ? json : json?.items), source: 'api' };
      }
    } catch {
      // Fall through to local storage while the backend API is not ready.
    }
  }
  return { items: readLocalBulletins(), source: 'local' };
}

async function persistBulletins(items: AiraBulletin[]): Promise<'api' | 'local'> {
  if (AIRA_BULLETINS_API_URL) {
    try {
      const response = await fetch(AIRA_BULLETINS_API_URL, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      });
      if (response.ok) return 'api';
    } catch {
      // Fall through to local storage while the backend API is not ready.
    }
  }
  writeLocalBulletins(items);
  return 'local';
}

function getWordCount(script: string): number {
  const words = script.trim().match(/[\p{L}\p{N}'’-]+/gu);
  return words ? words.length : 0;
}

function getReadingMinutes(wordCount: number, speed: VoiceSpeed): number {
  const wordsPerMinute = speed === 'Slow' ? 130 : speed === 'Newsreader' ? 175 : 155;
  return wordCount ? Math.max(1, Math.ceil(wordCount / wordsPerMinute)) : 0;
}

function speechLang(language: Language): string {
  if (language === 'Gujarati') return 'gu-IN';
  if (language === 'Hindi') return 'hi-IN';
  return 'en-US';
}

function speechRate(speed: VoiceSpeed): number {
  if (speed === 'Slow') return 0.85;
  if (speed === 'Newsreader') return 1.08;
  return 1;
}

function isPreviewableVideoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isMp4Url(value: string): boolean {
  return /\.mp4(\?|#|$)/i.test(value.trim());
}

function isYouTubeUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.includes('youtube.com') || host.includes('youtu.be');
  } catch {
    return false;
  }
}

function toDateTimeValue(date: string, time: string): string {
  if (!date && !time) return '';
  if (date && time) return `${date}T${time}`;
  return date || time;
}

function videoUrlFor(bulletin: AiraBulletin): string {
  return bulletin.mp4Url.trim() || bulletin.youtubeUrl.trim();
}

function canUseLiveTvActions(bulletin: AiraBulletin): boolean {
  return bulletin.status === 'Approved' && Boolean(videoUrlFor(bulletin));
}

function liveTvDisabledReason(bulletin: AiraBulletin): string {
  if (bulletin.status !== 'Approved') return 'Only Approved bulletins can be published to Live TV.';
  if (!videoUrlFor(bulletin)) return 'Add YouTube URL or MP4 URL before publishing to Live TV.';
  return '';
}

function buildLiveTvFromAiraBulletin(currentLiveTv: LiveTvDraft, bulletin: AiraBulletin, publicLabel: PublicLabel): LiveTvDraft {
  const videoUrl = videoUrlFor(bulletin);
  const scheduled = publicLabel === 'SCHEDULED';
  return {
    ...currentLiveTv,
    enabled: true,
    showOnHomepage: true,
    sourceType: 'AIRA_BULLETIN',
    mode: 'AIRA Bulletin',
    provider: isYouTubeUrl(videoUrl) ? 'YouTube' : 'Custom Embed',
    embedUrl: videoUrl,
    fallbackVideoUrl: videoUrl,
    title: bulletin.bulletinTitle || 'AIRA Bulletin',
    subtitle: publicLabel,
    language: bulletin.language,
    startTime: toDateTimeValue(bulletin.scheduleDate, bulletin.scheduleTime),
    endTime: bulletin.endTime,
    nextLiveTime: toDateTimeValue(bulletin.scheduleDate, bulletin.scheduleTime),
    scheduleStatus: scheduled ? 'Scheduled' : 'Live',
    airaBulletinId: bulletin.id,
    airaPublicLabel: publicLabel,
    airaSourceType: 'AIRA_BULLETIN',
    airaBulletinSnapshot: bulletin,
  };
}

function formatSchedule(bulletin: AiraBulletin): string {
  if (!bulletin.scheduleDate && !bulletin.scheduleTime) return 'Not set';
  return [bulletin.scheduleDate, bulletin.scheduleTime].filter(Boolean).join(' ');
}

function sortBulletins(items: AiraBulletin[]): AiraBulletin[] {
  return [...items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

const AiraPage: React.FC = () => {
  const [active, setActive] = useState<AiraBulletin>(() => createEmptyBulletin());
  const [bulletins, setBulletins] = useState<AiraBulletin[]>([]);
  const [storageSource, setStorageSource] = useState<'api' | 'local'>('local');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const wordCount = useMemo(() => getWordCount(active.script), [active.script]);
  const readingMinutes = useMemo(() => getReadingMinutes(wordCount, active.voiceSpeed), [active.voiceSpeed, wordCount]);
  const currentVideoUrl = videoUrlFor(active);
  const canPreviewVideo = isPreviewableVideoUrl(currentVideoUrl);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadBulletins()
      .then((result) => {
        if (!alive) return;
        const items = sortBulletins(result.items);
        setBulletins(items);
        setStorageSource(result.source);
        if (items[0]) setActive(items[0]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const updateActive = <K extends keyof AiraBulletin>(key: K, value: AiraBulletin[K]) => {
    setActive((current) => ({ ...current, [key]: value }));
  };

  const updateVisualBlock = <K extends keyof VisualBlock>(id: string, key: K, value: VisualBlock[K]) => {
    setActive((current) => ({
      ...current,
      visualTimeline: current.visualTimeline.map((block) => (block.id === id ? { ...block, [key]: value } : block)),
    }));
  };

  const saveBulletin = async (patch: Partial<AiraBulletin> = {}, message = 'AIRA bulletin draft saved.') => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const next: AiraBulletin = {
        ...active,
        ...patch,
        updatedAt: now,
        createdAt: active.createdAt || now,
        visualTimeline: active.visualTimeline.length ? active.visualTimeline : [createVisualBlock()],
      };
      const exists = bulletins.some((item) => item.id === next.id);
      const nextItems = sortBulletins(exists ? bulletins.map((item) => (item.id === next.id ? next : item)) : [next, ...bulletins]);
      const source = await persistBulletins(nextItems);
      setActive(next);
      setBulletins(nextItems);
      setStorageSource(source);
      toast.success(source === 'api' ? message : `${message} Local test mode saved.`);
      return next;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save AIRA bulletin.');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const setStatus = (status: BulletinStatus) => {
    void saveBulletin({ status }, `AIRA bulletin marked ${status}.`);
  };

  const handlePreviewVoice = () => {
    if (!active.script.trim()) {
      toast.error('Add a script before previewing voice.');
      return;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Browser voice preview is not supported here.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(active.script);
    utterance.lang = speechLang(active.language);
    utterance.rate = speechRate(active.voiceSpeed);
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleStopVoice = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const handleClearScript = () => {
    updateActive('script', '');
    toast.success('Script cleared.');
  };

  const handleNewBulletin = () => {
    handleStopVoice();
    setActive(createEmptyBulletin());
    setPreviewMode(false);
  };

  const handleArchiveFromLibrary = async (bulletin: AiraBulletin) => {
    const next = { ...bulletin, status: 'Archived' as BulletinStatus, updatedAt: new Date().toISOString() };
    const nextItems = sortBulletins(bulletins.map((item) => (item.id === bulletin.id ? next : item)));
    const source = await persistBulletins(nextItems);
    setBulletins(nextItems);
    setStorageSource(source);
    if (active.id === bulletin.id) setActive(next);
    toast.success('AIRA bulletin archived.');
  };

  const handleApproveFromLibrary = async (bulletin: AiraBulletin) => {
    const next = { ...bulletin, status: 'Approved' as BulletinStatus, updatedAt: new Date().toISOString() };
    const nextItems = sortBulletins(bulletins.map((item) => (item.id === bulletin.id ? next : item)));
    const source = await persistBulletins(nextItems);
    setBulletins(nextItems);
    setStorageSource(source);
    if (active.id === bulletin.id) setActive(next);
    toast.success('AIRA bulletin approved.');
  };

  const saveLiveTvBulletinState = async (bulletin: AiraBulletin, publicLabel: PublicLabel, status: BulletinStatus = bulletin.status): Promise<AiraBulletin> => {
    const next = { ...bulletin, publicLabel, status, updatedAt: new Date().toISOString() };
    const nextItems = sortBulletins(bulletins.map((item) => (item.id === bulletin.id ? next : item)));
    const source = await persistBulletins(nextItems);
    setBulletins(nextItems);
    setStorageSource(source);
    if (active.id === bulletin.id) setActive(next);
    return next;
  };

  const handlePublishToLiveTvNow = async (bulletin: AiraBulletin) => {
    const reason = liveTvDisabledReason(bulletin);
    if (reason) {
      toast.error(reason);
      return;
    }
    try {
      const nextBulletin = await saveLiveTvBulletinState(bulletin, 'AIRA BULLETIN • ON AIR', 'Published');
      const bundle = await publicSiteSettingsApi.getAdminPublicSiteSettingsBundle();
      const draft = bundle.draft || bundle.published || DEFAULT_PUBLIC_SITE_SETTINGS;
      const liveTv = buildLiveTvFromAiraBulletin((draft.liveTv || {}) as LiveTvDraft, nextBulletin, 'AIRA BULLETIN • ON AIR');
      const nextSettings = { ...draft, liveTv } as PublicSiteSettings;
      await publicSiteSettingsApi.putAdminPublicSiteSettingsDraft(nextSettings, { action: 'aira:publish-live-tv:draft' });
      await publicSiteSettingsApi.publishAdminPublicSiteSettings(nextSettings, { action: 'aira:publish-live-tv' });
      toast.success('AIRA bulletin published to Live TV.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to publish AIRA bulletin to Live TV.');
    }
  };

  const handleScheduleOnLiveTv = async (bulletin: AiraBulletin) => {
    const reason = liveTvDisabledReason(bulletin);
    if (reason) {
      toast.error(reason);
      return;
    }
    try {
      const nextBulletin = await saveLiveTvBulletinState(bulletin, 'SCHEDULED', 'Scheduled');
      const bundle = await publicSiteSettingsApi.getAdminPublicSiteSettingsBundle();
      const draft = bundle.draft || bundle.published || DEFAULT_PUBLIC_SITE_SETTINGS;
      const liveTv = buildLiveTvFromAiraBulletin((draft.liveTv || {}) as LiveTvDraft, nextBulletin, 'SCHEDULED');
      await publicSiteSettingsApi.putAdminPublicSiteSettingsDraft({ ...draft, liveTv } as PublicSiteSettings, { action: 'aira:schedule-live-tv' });
      toast.success('AIRA bulletin scheduled in Live TV draft.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to schedule AIRA bulletin on Live TV.');
    }
  };

  const handleRemoveFromLiveTvSchedule = async (bulletin: AiraBulletin) => {
    try {
      const nextBulletin = await saveLiveTvBulletinState(bulletin, 'REPLAY', 'Completed');
      const bundle = await publicSiteSettingsApi.getAdminPublicSiteSettingsBundle();
      const draft = bundle.draft || bundle.published || DEFAULT_PUBLIC_SITE_SETTINGS;
      const currentLiveTv = { ...((draft.liveTv || {}) as LiveTvDraft) };
      if (currentLiveTv.airaBulletinId === bulletin.id) {
        currentLiveTv.airaBulletinId = '';
        currentLiveTv.airaPublicLabel = 'REPLAY';
        currentLiveTv.airaBulletinSnapshot = nextBulletin;
        currentLiveTv.sourceType = '';
        currentLiveTv.scheduleStatus = 'Draft';
        await publicSiteSettingsApi.putAdminPublicSiteSettingsDraft({ ...draft, liveTv: currentLiveTv } as PublicSiteSettings, { action: 'aira:remove-live-tv-schedule' });
      }
      toast.success('AIRA bulletin removed from Live TV schedule draft.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove AIRA bulletin from Live TV schedule.');
    }
  };

  const handleViewLiveTvStatus = async (bulletin: AiraBulletin) => {
    try {
      const bundle = await publicSiteSettingsApi.getAdminPublicSiteSettingsBundle();
      const liveTv = ((bundle.draft || bundle.published || DEFAULT_PUBLIC_SITE_SETTINGS).liveTv || {}) as LiveTvDraft;
      if (liveTv.airaBulletinId === bulletin.id) {
        toast.success(`Live TV status: ${liveTv.airaPublicLabel || liveTv.scheduleStatus || 'Selected'}.`);
      } else {
        toast.success('This AIRA bulletin is not currently selected in Live TV.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to read Live TV status.');
    }
  };

  return (
    <div className="space-y-6 text-slate-950">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-red-900 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">AIRA Bulletin Studio</h1>
            <p className="mt-1 text-sm text-slate-200">Create, preview, approve, and schedule AI anchor bulletins for News Pulse.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white">AIRA Studio Ready</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white">{storageSource === 'api' ? 'API Mode' : 'Local Test Mode'}</span>
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Create Bulletin</h2>
                <p className="mt-1 text-sm text-slate-600">Create AIRA bulletins with script, anchor settings, video URL, schedule, approval, and Live TV publishing.</p>
              </div>
              <button type="button" onClick={handleNewBulletin} className={buttonClass('secondary')}>New Bulletin</button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Bulletin Title
                <input className={fieldClass('mt-2')} value={active.bulletinTitle} onChange={(event) => updateActive('bulletinTitle', event.target.value)} placeholder="Prime Time AIRA Bulletin" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Language
                <select className={fieldClass('mt-2')} value={active.language} onChange={(event) => updateActive('language', event.target.value as Language)}>
                  {languages.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Bulletin Type
                <select className={fieldClass('mt-2')} value={active.bulletinType} onChange={(event) => updateActive('bulletinType', event.target.value as BulletinType)}>
                  {bulletinTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Duration
                <select className={fieldClass('mt-2')} value={active.duration} onChange={(event) => updateActive('duration', Number(event.target.value) as Duration)}>
                  {durations.map((item) => <option key={item} value={item}>{item} minutes</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Public Label
                <select className={fieldClass('mt-2')} value={active.publicLabel} onChange={(event) => updateActive('publicLabel', event.target.value as PublicLabel)}>
                  {publicLabels.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Schedule Date
                <input type="date" className={fieldClass('mt-2')} value={active.scheduleDate} onChange={(event) => updateActive('scheduleDate', event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Schedule Time
                <input type="time" className={fieldClass('mt-2')} value={active.scheduleTime} onChange={(event) => updateActive('scheduleTime', event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                End Time optional
                <input type="time" className={fieldClass('mt-2')} value={active.endTime} onChange={(event) => updateActive('endTime', event.target.value)} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Anchor Settings</h2>
            <div className={noticeClass('blue') + ' mt-3'}>Choose the AIRA presentation style for this bulletin. AI voice/video generation can be connected later; manual video publishing is available now.</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Anchor Name
                <input className={fieldClass('mt-2')} value={active.anchorName} onChange={(event) => updateActive('anchorName', event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Anchor Face
                <input className={fieldClass('mt-2')} value={active.anchorFace} onChange={(event) => updateActive('anchorFace', event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Dress Style
                <select className={fieldClass('mt-2')} value={active.dressStyle} onChange={(event) => updateActive('dressStyle', event.target.value as DressStyle)}>
                  {dressStyles.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Tone
                <select className={fieldClass('mt-2')} value={active.tone} onChange={(event) => updateActive('tone', event.target.value as Tone)}>
                  {tones.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Voice Style
                <input className={fieldClass('mt-2 bg-slate-50')} value={active.voiceStyle} readOnly />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Studio Template
                <select className={fieldClass('mt-2')} value={active.studioTemplate} onChange={(event) => updateActive('studioTemplate', event.target.value as StudioTemplate)}>
                  {studioTemplates.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Script Editor</h2>
                <p className="mt-1 text-sm text-slate-600">{wordCount} words · approximately {readingMinutes || 0} minute{readingMinutes === 1 ? '' : 's'} at {active.voiceSpeed.toLowerCase()} speed.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void saveBulletin()} disabled={saving} className={buttonClass('primary')}>Save Draft</button>
                <button type="button" onClick={handleClearScript} className={buttonClass('secondary')}>Clear Script</button>
              </div>
            </div>
            <textarea className={fieldClass('mt-4 min-h-[320px] resize-y leading-6')} value={active.script} onChange={(event) => updateActive('script', event.target.value)} placeholder="Write the anchor script for AIRA..." />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Visual Timeline</h2>
                <p className="mt-1 text-sm text-slate-600">Plan visuals for each part of the bulletin, including anchor-only, image, video, map, headline card, timeline, breaking banner, or sponsor card.</p>
              </div>
              <button type="button" onClick={() => updateActive('visualTimeline', [...active.visualTimeline, createVisualBlock()])} className={buttonClass('secondary')}>Add Block</button>
            </div>
            <div className="mt-4 space-y-4">
              {active.visualTimeline.map((block, index) => (
                <div key={block.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-slate-900">Block {index + 1}</h3>
                    <button type="button" onClick={() => updateActive('visualTimeline', active.visualTimeline.filter((item) => item.id !== block.id))} disabled={active.visualTimeline.length === 1} className="text-sm font-semibold text-rose-700 disabled:text-slate-400">Remove</button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">Start Time<input className={fieldClass('mt-2')} value={block.startTime} onChange={(event) => updateVisualBlock(block.id, 'startTime', event.target.value)} placeholder="00:00" /></label>
                    <label className="block text-sm font-semibold text-slate-700">End Time<input className={fieldClass('mt-2')} value={block.endTime} onChange={(event) => updateVisualBlock(block.id, 'endTime', event.target.value)} placeholder="00:30" /></label>
                    <label className="block text-sm font-semibold text-slate-700">Visual Type<select className={fieldClass('mt-2')} value={block.visualType} onChange={(event) => updateVisualBlock(block.id, 'visualType', event.target.value as VisualType)}>{visualTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label className="block text-sm font-semibold text-slate-700">Title<input className={fieldClass('mt-2')} value={block.title} onChange={(event) => updateVisualBlock(block.id, 'title', event.target.value)} /></label>
                    <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Description<textarea className={fieldClass('mt-2 min-h-[80px]')} value={block.description} onChange={(event) => updateVisualBlock(block.id, 'description', event.target.value)} /></label>
                    <label className="block text-sm font-semibold text-slate-700">Source Credit<input className={fieldClass('mt-2')} value={block.sourceCredit} onChange={(event) => updateVisualBlock(block.id, 'sourceCredit', event.target.value)} /></label>
                    <label className="block text-sm font-semibold text-slate-700">Media URL<input className={fieldClass('mt-2')} value={block.mediaUrl} onChange={(event) => updateVisualBlock(block.id, 'mediaUrl', event.target.value)} /></label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Browser Voice Preview</h2>
            <div className={noticeClass() + ' mt-3'}>{browserVoiceMessage}</div>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Voice speed control
                <select className={fieldClass('mt-2')} value={active.voiceSpeed} onChange={(event) => updateActive('voiceSpeed', event.target.value as VoiceSpeed)}>
                  {voiceSpeeds.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={handlePreviewVoice} className={buttonClass('primary')}>Preview Voice</button>
                <button type="button" onClick={handleStopVoice} className={buttonClass('secondary')}>Stop Voice</button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Video Upload / Video URL</h2>
            <div className={noticeClass() + ' mt-3'}>{uploadMessage}</div>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Paste YouTube URL<input className={fieldClass('mt-2')} value={active.youtubeUrl} onChange={(event) => updateActive('youtubeUrl', event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>
              <label className="block text-sm font-semibold text-slate-700">Paste MP4 URL<input className={fieldClass('mt-2')} value={active.mp4Url} onChange={(event) => updateActive('mp4Url', event.target.value)} placeholder="https://cdn.example.com/aira-bulletin.mp4" /></label>
              <button type="button" disabled className={buttonClass('secondary') + ' w-full'}>MP4 upload can be connected later</button>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                {canPreviewVideo ? (
                  isMp4Url(currentVideoUrl) ? (
                    <video controls src={currentVideoUrl} className="aspect-video w-full bg-slate-950" />
                  ) : (
                    <iframe title="AIRA bulletin video preview" src={currentVideoUrl} className="aspect-video w-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                  )
                ) : (
                  <div className="flex aspect-video items-center justify-center px-6 text-center text-sm font-semibold text-slate-300">Video Preview</div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Schedule</h2>
            <div className={noticeClass('blue') + ' mt-3'}>{liveTvScheduleMessage}</div>
            <div className="mt-4 grid gap-4">
              <label className="block text-sm font-semibold text-slate-700">Schedule Date<input type="date" className={fieldClass('mt-2')} value={active.scheduleDate} onChange={(event) => updateActive('scheduleDate', event.target.value)} /></label>
              <label className="block text-sm font-semibold text-slate-700">Schedule Time<input type="time" className={fieldClass('mt-2')} value={active.scheduleTime} onChange={(event) => updateActive('scheduleTime', event.target.value)} /></label>
              <label className="block text-sm font-semibold text-slate-700">End Time<input type="time" className={fieldClass('mt-2')} value={active.endTime} onChange={(event) => updateActive('endTime', event.target.value)} /></label>
              <label className="block text-sm font-semibold text-slate-700">Repeat<input className={fieldClass('mt-2 bg-slate-50')} value="none" readOnly /></label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Approval</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => void saveBulletin({ status: 'Draft' }, 'AIRA bulletin draft saved.')} disabled={saving} className={buttonClass('secondary')}>Save Draft</button>
              <button type="button" onClick={() => setStatus('Ready for Review')} disabled={saving} className={buttonClass('dark')}>Mark Ready for Review</button>
              <button type="button" onClick={() => setStatus('Approved')} disabled={saving} className={buttonClass('primary')}>Approve</button>
              <button type="button" onClick={() => setStatus('Rejected')} disabled={saving} className={buttonClass('danger')}>Reject</button>
              <button type="button" onClick={() => setStatus('Archived')} disabled={saving} className={buttonClass('secondary')}>Archive</button>
              <button type="button" onClick={() => setPreviewMode((value) => !value)} className={buttonClass('secondary')}>{previewMode ? 'Hide Preview' : 'Preview'}</button>
              <button type="button" onClick={() => void handlePublishToLiveTvNow(active)} disabled={saving || !canUseLiveTvActions(active)} title={liveTvDisabledReason(active)} className={buttonClass('primary')}>Publish to Live TV</button>
              <button type="button" onClick={() => void handleScheduleOnLiveTv(active)} disabled={saving || !canUseLiveTvActions(active)} title={liveTvDisabledReason(active)} className={buttonClass('dark')}>Schedule on Live TV</button>
            </div>
            {!canUseLiveTvActions(active) ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Approve this bulletin and add a video URL before publishing to Live TV.</div> : null}
          </section>
        </aside>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Preview</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{active.publicLabel}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{active.status}</span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-slate-950">{active.bulletinTitle || 'Untitled AIRA Bulletin'}</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <div><span className="font-semibold">Language:</span> {active.language}</div>
              <div><span className="font-semibold">Type:</span> {active.bulletinType}</div>
              <div><span className="font-semibold">Duration:</span> {active.duration} minutes</div>
              <div><span className="font-semibold">Schedule:</span> {formatSchedule(active)}</div>
              <div><span className="font-semibold">Anchor:</span> {active.anchorName} / {active.anchorFace}</div>
              <div><span className="font-semibold">Style:</span> {active.dressStyle}, {active.tone}, {active.studioTemplate}</div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
              {active.script ? active.script.slice(0, 900) : 'Script preview appears here.'}{active.script.length > 900 ? '...' : ''}
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-700">Visual timeline: {active.visualTimeline.length} block{active.visualTimeline.length === 1 ? '' : 's'}</div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            {canPreviewVideo ? (
              isMp4Url(currentVideoUrl) ? <video controls src={currentVideoUrl} className="aspect-video w-full bg-slate-950" /> : <iframe title="AIRA preview card video" src={currentVideoUrl} className="aspect-video w-full border-0" allowFullScreen />
            ) : (
              <div className="flex aspect-video items-center justify-center px-6 text-center text-sm font-semibold text-slate-300">No video URL saved</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Bulletin Library</h2>
            <p className="mt-1 text-sm text-slate-600">Saved bulletins use the configured API when available, otherwise local test mode for this workspace.</p>
          </div>
          <button type="button" onClick={() => void saveBulletin()} disabled={saving} className={buttonClass('primary')}>Save Current Bulletin</button>
        </div>
        {loading ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">Loading saved bulletins...</div>
        ) : bulletins.length ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1.2fr_0.7fr_0.7fr_0.6fr_0.7fr_0.8fr_0.7fr_1.8fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 xl:grid">
              <div>Title</div><div>Language</div><div>Type</div><div>Duration</div><div>Status</div><div>Schedule Time</div><div>Video</div><div>Actions</div>
            </div>
            <div className="divide-y divide-slate-200">
              {bulletins.map((item) => (
                <div key={item.id} className={`grid gap-3 px-4 py-4 text-sm xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.6fr_0.7fr_0.8fr_0.7fr_1.8fr] ${item.id === active.id ? 'bg-red-50' : 'bg-white'}`}>
                  <div><div className="font-semibold text-slate-950">{item.bulletinTitle || 'Untitled bulletin'}</div><div className="mt-1 text-xs text-slate-500 xl:hidden">{item.language} · {item.bulletinType} · {item.duration} minutes</div></div>
                  <div className="text-slate-700">{item.language}</div>
                  <div className="text-slate-700">{item.bulletinType}</div>
                  <div className="text-slate-700">{item.duration} min</div>
                  <div className="font-semibold text-slate-700">{item.status}</div>
                  <div className="text-slate-700">{formatSchedule(item)}</div>
                  <div className="text-slate-700">{videoUrlFor(item) ? 'Yes' : 'No'}</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setActive(item); setPreviewMode(true); }} className="text-sm font-semibold text-blue-700">View</button>
                    <button type="button" onClick={() => { setActive(item); setPreviewMode(false); }} className="text-sm font-semibold text-slate-800">Edit</button>
                    <button type="button" onClick={() => { setActive(item); setPreviewMode(true); }} className="text-sm font-semibold text-slate-800">Preview</button>
                    <button type="button" onClick={() => void handleApproveFromLibrary(item)} className="text-sm font-semibold text-emerald-700">Approve</button>
                    <button type="button" onClick={() => void handleArchiveFromLibrary(item)} className="text-sm font-semibold text-rose-700">Archive</button>
                    <button type="button" onClick={() => void handlePublishToLiveTvNow(item)} disabled={!canUseLiveTvActions(item)} title={liveTvDisabledReason(item)} className="text-sm font-semibold text-red-700 disabled:text-slate-400">Publish to Live TV Now</button>
                    <button type="button" onClick={() => void handleScheduleOnLiveTv(item)} disabled={!canUseLiveTvActions(item)} title={liveTvDisabledReason(item)} className="text-sm font-semibold text-amber-700 disabled:text-slate-400">Schedule on Live TV</button>
                    <button type="button" onClick={() => void handleRemoveFromLiveTvSchedule(item)} className="text-sm font-semibold text-slate-700">Remove from Live TV schedule</button>
                    <button type="button" onClick={() => void handleViewLiveTvStatus(item)} className="text-sm font-semibold text-blue-700">View Live TV Status</button>
                    {item.status === 'Approved' && !videoUrlFor(item) ? <span className="basis-full text-xs font-semibold text-amber-700">Add YouTube URL or MP4 URL before publishing to Live TV.</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">No AIRA bulletins saved yet.</div>
        )}
      </section>
    </div>
  );
};

export default AiraPage;