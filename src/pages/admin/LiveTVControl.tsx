import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { uploadCoverImage, uploadVideoFile } from '@/lib/api/media';
import { publicSiteSettingsApi } from '@/lib/publicSiteSettingsApi';
import {
  DEFAULT_PUBLIC_SITE_SETTINGS,
  LIVE_TV_LANGUAGES,
  LIVE_TV_MODES,
  LIVE_TV_PROVIDERS,
  getYouTubeEmbedUrl,
  normalizeLiveTvSettingsValue,
  type PublicSiteSettings,
} from '@/types/publicSiteSettings';

type LiveTvDraft = PublicSiteSettings['liveTv'] & Record<string, any>;
type LoadState = 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';
type LiveStatus = 'LIVE' | 'AIRA BULLETIN • ON AIR' | 'BREAKING BULLETIN' | 'SPONSORED PROGRAM' | 'REPLAY' | 'OFFLINE' | 'SCHEDULED' | 'COMING SOON';
type ScheduleStatus = 'Draft' | 'Scheduled' | 'Live' | 'Ended';
type ActivityAction = 'Draft saved' | 'Live published' | 'Live stopped' | 'Replay activated' | 'URL changed' | 'Mode changed' | 'Time updated';
type LiveTvSourceType = 'YOUTUBE_LIVE' | 'CUSTOM_EMBED' | 'AIRA_BULLETIN' | 'OFFLINE_REPLAY' | 'SCHEDULED_PROGRAM' | 'BREAKING_BULLETIN' | 'SPONSORED_PROGRAM' | 'MAINTENANCE';
type QueueSourceType = 'youtube_live' | 'custom_embed' | 'aira_bulletin' | 'offline_replay' | 'scheduled_program' | 'breaking_bulletin' | 'sponsored_program' | 'maintenance';
type QueueLabel = 'LIVE' | 'AIRA BULLETIN • ON AIR' | 'SCHEDULED' | 'REPLAY' | 'BREAKING BULLETIN' | 'SPONSORED PROGRAM' | 'COMING SOON';
type QueueStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'disabled';
type QueuePriority = 'normal' | 'high' | 'breaking';
type QueueRepeat = 'none' | 'daily' | 'weekly';

type ScheduleEntry = {
  id: string;
  programTitle: string;
  sourceType: QueueSourceType;
  label: QueueLabel;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  selectedAiraBulletinId: string;
  videoUrl: string;
  embedUrl: string;
  status: QueueStatus;
  priority: QueuePriority;
  repeat: QueueRepeat;
  sponsorName: string;
  sponsorLabel: string;
  updatedAt: string;
};

type AiraBulletin = {
  id: string;
  bulletinTitle: string;
  language: 'Gujarati' | 'Hindi' | 'English';
  bulletinType: string;
  duration: number;
  scheduleDate: string;
  scheduleTime: string;
  endTime: string;
  publicLabel: string;
  youtubeUrl: string;
  mp4Url: string;
  status: string;
  updatedAt: string;
};

const SCHEDULE_STATUSES: ScheduleStatus[] = ['Draft', 'Scheduled', 'Live', 'Ended'];
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.newspulse.co.in';
const publicLiveTvUrl = `${PUBLIC_SITE_URL.replace(/\/$/, '')}/live-tv`;
const AIRA_STORAGE_KEY = 'newspulse:aira:manual-bulletins:v2';
const PROGRAM_QUEUE_STORAGE_KEY = 'newspulse:live-tv:program-queue:v1';
const DEFAULT_OFFLINE_MESSAGE = 'News Pulse Live TV will return shortly.';
const OFFLINE_POSTER_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const OFFLINE_VIDEO_ACCEPT = '.mp4,.webm,video/mp4,video/webm';
const MAX_OFFLINE_POSTER_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_OFFLINE_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const LIVE_TV_SOURCE_TYPES: Array<{ value: LiveTvSourceType; label: string }> = [
  { value: 'YOUTUBE_LIVE', label: 'YouTube Live' },
  { value: 'CUSTOM_EMBED', label: 'Custom Embed' },
  { value: 'AIRA_BULLETIN', label: 'AIRA Bulletin' },
  { value: 'OFFLINE_REPLAY', label: 'Offline Replay' },
  { value: 'SCHEDULED_PROGRAM', label: 'Scheduled Program' },
  { value: 'BREAKING_BULLETIN', label: 'Breaking Bulletin' },
  { value: 'SPONSORED_PROGRAM', label: 'Sponsored Program placeholder only' },
  { value: 'MAINTENANCE', label: 'Maintenance / Coming Soon' },
];
const QUEUE_SOURCE_TYPES: Array<{ value: QueueSourceType; label: string }> = [
  { value: 'youtube_live', label: 'YouTube live' },
  { value: 'custom_embed', label: 'Custom embed' },
  { value: 'aira_bulletin', label: 'AIRA bulletin' },
  { value: 'offline_replay', label: 'Offline replay' },
  { value: 'scheduled_program', label: 'Scheduled program' },
  { value: 'breaking_bulletin', label: 'Breaking bulletin' },
  { value: 'sponsored_program', label: 'Sponsored program' },
  { value: 'maintenance', label: 'Maintenance' },
];
const QUEUE_LABELS: QueueLabel[] = ['LIVE', 'AIRA BULLETIN • ON AIR', 'SCHEDULED', 'REPLAY', 'BREAKING BULLETIN', 'SPONSORED PROGRAM', 'COMING SOON'];
const QUEUE_STATUSES: QueueStatus[] = ['draft', 'scheduled', 'active', 'completed', 'disabled'];
const QUEUE_PRIORITIES: QueuePriority[] = ['normal', 'high', 'breaking'];
const QUEUE_REPEATS: QueueRepeat[] = ['none', 'daily', 'weekly'];
const QUEUE_DURATIONS = [3, 5, 10, 15, 25, 30];
const DEFAULT_AIRA_SLOTS: Array<{ time: string; title: string; durationMinutes: number; priority?: QueuePriority }> = [
  { time: '08:00', title: 'Early Morning News', durationMinutes: 10 },
  { time: '10:00', title: 'Morning Bulletin', durationMinutes: 10 },
  { time: '12:00', title: 'Noon Update', durationMinutes: 5 },
  { time: '14:00', title: 'Afternoon Update', durationMinutes: 5 },
  { time: '16:00', title: 'Evening Prep Bulletin', durationMinutes: 5 },
  { time: '18:00', title: 'Evening Bulletin', durationMinutes: 10 },
  { time: '19:00', title: 'Top Stories Update', durationMinutes: 5 },
  { time: '20:00', title: 'Prime Time Recap', durationMinutes: 15 },
  { time: '22:00', title: 'Night News Recap', durationMinutes: 10 },
  { time: '22:30', title: 'Final Night Bulletin', durationMinutes: 5 },
  { time: '', title: 'Breaking Alert Anytime', durationMinutes: 3, priority: 'breaking' },
];

const emptyLiveTv: LiveTvDraft = {
  ...DEFAULT_PUBLIC_SITE_SETTINGS.liveTv,
  offlinePosterImage: '',
  offlineLoopVideo: '',
  offlineMessage: DEFAULT_OFFLINE_MESSAGE,
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
    offlinePosterImage: typeof raw.offlinePosterImage === 'string' ? raw.offlinePosterImage : '',
    offlineLoopVideo: typeof raw.offlineLoopVideo === 'string' ? raw.offlineLoopVideo : '',
    offlineMessage: typeof raw.offlineMessage === 'string' && raw.offlineMessage.trim() ? raw.offlineMessage : DEFAULT_OFFLINE_MESSAGE,
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
    offlinePosterImage: value.offlinePosterImage || '',
    offlineLoopVideo: value.offlineLoopVideo || '',
    offlineMessage: value.offlineMessage || DEFAULT_OFFLINE_MESSAGE,
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

function isOfflinePlaybackMode(settings: LiveTvDraft): boolean {
  return !settings.enabled || settings.sourceType === 'MAINTENANCE' || settings.sourceType === 'OFFLINE_REPLAY' || settings.mode === 'Maintenance / Coming Soon' || settings.mode === 'Offline Replay';
}

function offlineLoopVideoFor(settings: LiveTvDraft): string {
  return String(settings.offlineLoopVideo || '').trim();
}

function offlinePosterImageFor(settings: LiveTvDraft): string {
  return String(settings.offlinePosterImage || '').trim();
}

function offlineMessageFor(settings: LiveTvDraft): string {
  return String(settings.offlineMessage || '').trim() || DEFAULT_OFFLINE_MESSAGE;
}

function videoUrlForAira(bulletin: AiraBulletin): string {
  return String(bulletin.mp4Url || '').trim() || String(bulletin.youtubeUrl || '').trim();
}

function isPlayableVideoUrl(value: string): boolean {
  return /\.(mp4|webm)(\?|#|$)/i.test(value.trim());
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

function previewUrlFromVideoUrl(value: string): string {
  if (isYouTubeUrl(value)) return getYouTubeEmbedUrl(value) || value;
  return value;
}

function toDateTimeValue(date: string, time: string): string {
  if (!date && !time) return '';
  if (date && time) return `${date}T${time}`;
  return date || time;
}

function dateValue(value: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function isWithinLiveWindow(settings: LiveTvDraft): boolean {
  const now = Date.now();
  const start = dateValue(settings.startTime || settings.nextLiveTime || '');
  const end = dateValue(settings.endTime || '');
  if (start && now < start) return false;
  if (end && now > end) return false;
  return Boolean(start || end);
}

function isPastLiveWindow(settings: LiveTvDraft): boolean {
  const end = dateValue(settings.endTime || '');
  return Boolean(end && Date.now() > end);
}

function readAiraBulletins(): AiraBulletin[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AIRA_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function labelForQueueSource(sourceType: QueueSourceType): QueueLabel {
  if (sourceType === 'youtube_live' || sourceType === 'custom_embed') return 'LIVE';
  if (sourceType === 'aira_bulletin') return 'AIRA BULLETIN • ON AIR';
  if (sourceType === 'offline_replay') return 'REPLAY';
  if (sourceType === 'breaking_bulletin') return 'BREAKING BULLETIN';
  if (sourceType === 'sponsored_program') return 'SPONSORED PROGRAM';
  if (sourceType === 'maintenance') return 'COMING SOON';
  return 'SCHEDULED';
}

function createScheduleEntry(patch: Partial<ScheduleEntry> = {}): ScheduleEntry {
  const now = new Date().toISOString();
  const sourceType = patch.sourceType || 'aira_bulletin';
  return {
    id: createId('live-queue'),
    programTitle: '',
    sourceType,
    label: patch.label || labelForQueueSource(sourceType),
    date: '',
    startTime: '',
    endTime: '',
    durationMinutes: 10,
    selectedAiraBulletinId: '',
    videoUrl: '',
    embedUrl: '',
    status: 'draft',
    priority: sourceType === 'breaking_bulletin' ? 'breaking' : 'normal',
    repeat: 'none',
    sponsorName: '',
    sponsorLabel: '',
    updatedAt: now,
    ...patch,
  };
}

function normalizeScheduleEntry(input: unknown): ScheduleEntry {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const sourceType = QUEUE_SOURCE_TYPES.some((item) => item.value === value.sourceType) ? value.sourceType as QueueSourceType : 'aira_bulletin';
  const status = QUEUE_STATUSES.includes(value.status as QueueStatus) ? value.status as QueueStatus : 'draft';
  const priority = QUEUE_PRIORITIES.includes(value.priority as QueuePriority) ? value.priority as QueuePriority : 'normal';
  const repeat = QUEUE_REPEATS.includes(value.repeat as QueueRepeat) ? value.repeat as QueueRepeat : 'none';
  return createScheduleEntry({
    id: typeof value.id === 'string' ? value.id : createId('live-queue'),
    programTitle: typeof value.programTitle === 'string' ? value.programTitle : '',
    sourceType,
    label: QUEUE_LABELS.includes(value.label as QueueLabel) ? value.label as QueueLabel : labelForQueueSource(sourceType),
    date: typeof value.date === 'string' ? value.date : '',
    startTime: typeof value.startTime === 'string' ? value.startTime : '',
    endTime: typeof value.endTime === 'string' ? value.endTime : '',
    durationMinutes: Number(value.durationMinutes) || 10,
    selectedAiraBulletinId: typeof value.selectedAiraBulletinId === 'string' ? value.selectedAiraBulletinId : '',
    videoUrl: typeof value.videoUrl === 'string' ? value.videoUrl : '',
    embedUrl: typeof value.embedUrl === 'string' ? value.embedUrl : '',
    status,
    priority,
    repeat,
    sponsorName: typeof value.sponsorName === 'string' ? value.sponsorName : '',
    sponsorLabel: typeof value.sponsorLabel === 'string' ? value.sponsorLabel : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  });
}

function readProgramQueue(): ScheduleEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRAM_QUEUE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeScheduleEntry) : [];
  } catch {
    return [];
  }
}

function writeProgramQueue(entries: ScheduleEntry[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROGRAM_QUEUE_STORAGE_KEY, JSON.stringify(entries));
}

function sortProgramQueue(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
}

function minutesFromTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function endMinutesFor(entry: ScheduleEntry): number | null {
  const explicitEnd = minutesFromTime(entry.endTime);
  if (explicitEnd !== null) return explicitEnd;
  const start = minutesFromTime(entry.startTime);
  return start === null ? null : start + entry.durationMinutes;
}

function hasScheduleConflict(entry: ScheduleEntry, queue: ScheduleEntry[]): boolean {
  if (!entry.date || !entry.startTime || entry.status === 'disabled') return false;
  const start = minutesFromTime(entry.startTime);
  const end = endMinutesFor(entry);
  if (start === null || end === null) return false;
  return queue.some((item) => {
    if (item.id === entry.id || item.date !== entry.date || item.status === 'disabled') return false;
    const itemStart = minutesFromTime(item.startTime);
    const itemEnd = endMinutesFor(item);
    if (itemStart === null || itemEnd === null) return false;
    return start < itemEnd && end > itemStart;
  });
}

function approvedAiraForQueue(bulletins: AiraBulletin[]): AiraBulletin[] {
  return bulletins.filter((item) => item.status === 'Approved' && Boolean(videoUrlForAira(item)) && (item as any).archived !== true);
}

function sourceTypeToLiveTvSourceType(sourceType: QueueSourceType): LiveTvSourceType {
  if (sourceType === 'youtube_live') return 'YOUTUBE_LIVE';
  if (sourceType === 'custom_embed') return 'CUSTOM_EMBED';
  if (sourceType === 'aira_bulletin') return 'AIRA_BULLETIN';
  if (sourceType === 'offline_replay') return 'OFFLINE_REPLAY';
  if (sourceType === 'scheduled_program') return 'SCHEDULED_PROGRAM';
  if (sourceType === 'breaking_bulletin') return 'BREAKING_BULLETIN';
  if (sourceType === 'sponsored_program') return 'SPONSORED_PROGRAM';
  return 'MAINTENANCE';
}

function modeForQueueSource(sourceType: QueueSourceType): LiveTvDraft['mode'] {
  if (sourceType === 'aira_bulletin') return 'AIRA Bulletin';
  if (sourceType === 'offline_replay') return 'Offline Replay';
  if (sourceType === 'scheduled_program' || sourceType === 'sponsored_program') return 'Scheduled Show';
  if (sourceType === 'breaking_bulletin') return 'Breaking Mode';
  if (sourceType === 'maintenance') return 'Maintenance / Coming Soon';
  return 'News Pulse Live';
}

function buildLiveTvFromQueueEntry(currentLiveTv: LiveTvDraft, entry: ScheduleEntry, approvedBulletins: AiraBulletin[]): LiveTvDraft {
  const selectedAira = approvedBulletins.find((item) => item.id === entry.selectedAiraBulletinId);
  if (entry.sourceType === 'aira_bulletin' && selectedAira) {
    return {
      ...buildLiveTvFromAiraBulletin(currentLiveTv, selectedAira, entry.label === 'REPLAY' ? 'REPLAY' : entry.label === 'SCHEDULED' ? 'SCHEDULED' : 'AIRA BULLETIN • ON AIR'),
      title: entry.programTitle || selectedAira.bulletinTitle || 'AIRA Bulletin',
      subtitle: entry.label,
      startTime: toDateTimeValue(entry.date, entry.startTime),
      endTime: toDateTimeValue(entry.date, entry.endTime),
      nextLiveTime: toDateTimeValue(entry.date, entry.startTime),
      scheduleStatus: entry.status === 'scheduled' || entry.label === 'SCHEDULED' ? 'Scheduled' : entry.status === 'completed' ? 'Ended' : 'Live',
      queueEntryId: entry.id,
      queuePriority: entry.priority,
    };
  }

  const rawVideoUrl = entry.embedUrl.trim() || entry.videoUrl.trim();
  const previewUrl = previewUrlFromVideoUrl(rawVideoUrl);
  const title = entry.programTitle || entry.sponsorLabel || entry.sponsorName || QUEUE_SOURCE_TYPES.find((item) => item.value === entry.sourceType)?.label || 'Live TV Program';
  return {
    ...currentLiveTv,
    enabled: entry.status !== 'disabled',
    showOnHomepage: entry.status !== 'disabled',
    sourceType: sourceTypeToLiveTvSourceType(entry.sourceType),
    mode: modeForQueueSource(entry.sourceType),
    provider: isYouTubeUrl(rawVideoUrl) ? 'YouTube' : 'Custom Embed',
    embedUrl: entry.sourceType === 'maintenance' ? '' : previewUrl,
    fallbackVideoUrl: entry.sourceType === 'offline_replay' ? previewUrl : currentLiveTv.fallbackVideoUrl,
    title,
    subtitle: entry.label,
    startTime: toDateTimeValue(entry.date, entry.startTime),
    endTime: toDateTimeValue(entry.date, entry.endTime),
    nextLiveTime: toDateTimeValue(entry.date, entry.startTime),
    scheduleStatus: entry.status === 'scheduled' || entry.label === 'SCHEDULED' ? 'Scheduled' : entry.status === 'completed' ? 'Ended' : 'Live',
    queueEntryId: entry.id,
    queuePriority: entry.priority,
    sponsorName: entry.sponsorName,
    sponsorLabel: entry.sponsorLabel,
  };
}

function isPreviewableUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAcceptedOfflinePosterFile(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function isAcceptedOfflineVideoFile(file: File): boolean {
  return ['video/mp4', 'video/webm'].includes(file.type) || /\.(mp4|webm)$/i.test(file.name);
}

function liveStatusFor(settings: LiveTvDraft, previewUrl: string): LiveStatus {
  if (!settings.enabled) return 'OFFLINE';
  if (settings.sourceType === 'MAINTENANCE' || settings.mode === 'Maintenance / Coming Soon') return 'COMING SOON';
  if (settings.sourceType === 'BREAKING_BULLETIN' || settings.mode === 'Breaking Mode') return 'BREAKING BULLETIN';
  if (settings.sourceType === 'SPONSORED_PROGRAM') return 'SPONSORED PROGRAM';
  if (settings.sourceType === 'AIRA_BULLETIN' || settings.mode === 'AIRA Bulletin') {
    if (settings.airaPublicLabel === 'BREAKING BULLETIN') return 'BREAKING BULLETIN';
    if (isPastLiveWindow(settings) || settings.airaPublicLabel === 'REPLAY') return 'REPLAY';
    if ((settings.airaPublicLabel === 'SCHEDULED' || settings.scheduleStatus === 'Scheduled') && isWithinLiveWindow(settings) && previewUrl) return 'AIRA BULLETIN • ON AIR';
    if (settings.airaPublicLabel === 'SCHEDULED' || settings.scheduleStatus === 'Scheduled') return 'SCHEDULED';
    if (previewUrl) return 'AIRA BULLETIN • ON AIR';
    return 'OFFLINE';
  }
  if ((settings.sourceType === 'YOUTUBE_LIVE' || settings.sourceType === 'CUSTOM_EMBED') && previewUrl) return 'LIVE';
  if (settings.scheduleStatus === 'Scheduled' || settings.mode === 'Scheduled Show') return 'SCHEDULED';
  if (settings.mode === 'Offline Replay') return 'REPLAY';
  if (previewUrl) return 'LIVE';
  return 'OFFLINE';
}

function statusClasses(status: LiveStatus): string {
  if (status === 'LIVE' || status === 'AIRA BULLETIN • ON AIR') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'BREAKING BULLETIN') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'SPONSORED PROGRAM') return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800';
  if (status === 'REPLAY') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'SCHEDULED') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'COMING SOON') return 'border-violet-200 bg-violet-50 text-violet-800';
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

function modeLabelFor(mode: string): string {
  return mode;
}

function sourceTypeFor(settings: LiveTvDraft): LiveTvSourceType {
  if (settings.sourceType && LIVE_TV_SOURCE_TYPES.some((item) => item.value === settings.sourceType)) return settings.sourceType;
  if (settings.mode === 'AIRA Bulletin') return 'AIRA_BULLETIN';
  if (settings.mode === 'Offline Replay') return 'OFFLINE_REPLAY';
  if (settings.mode === 'Scheduled Show') return 'SCHEDULED_PROGRAM';
  if (settings.mode === 'Breaking Mode') return 'BREAKING_BULLETIN';
  if (settings.mode === 'Maintenance / Coming Soon') return 'MAINTENANCE';
  return settings.provider === 'Custom Embed' ? 'CUSTOM_EMBED' : 'YOUTUBE_LIVE';
}

function sourceLabelFor(settings: LiveTvDraft): string {
  const sourceType = sourceTypeFor(settings);
  return LIVE_TV_SOURCE_TYPES.find((item) => item.value === sourceType)?.label.replace(' placeholder only', '') || 'YouTube Live';
}

function currentLabelFor(settings: LiveTvDraft, status: LiveStatus): string {
  if (settings.sourceType === 'SPONSORED_PROGRAM') return 'SPONSORED PROGRAM';
  if (status === 'COMING SOON') return 'COMING SOON';
  return status;
}

function currentSourceSummary(settings: LiveTvDraft, previewUrl: string) {
  const status = liveStatusFor(settings, previewUrl);
  return {
    sourceType: sourceLabelFor(settings),
    title: titleFor(settings),
    label: currentLabelFor(settings, status),
    status,
    url: previewUrl,
    startTime: settings.startTime || '',
    endTime: settings.endTime || '',
    updatedAt: settings.updatedAt || '',
  };
}

function buildLiveTvFromAiraBulletin(currentLiveTv: LiveTvDraft, bulletin: AiraBulletin, publicLabel: 'AIRA BULLETIN • ON AIR' | 'SCHEDULED' | 'REPLAY'): LiveTvDraft {
  const videoUrl = videoUrlForAira(bulletin);
  const previewUrl = previewUrlFromVideoUrl(videoUrl);
  return {
    ...currentLiveTv,
    enabled: true,
    showOnHomepage: true,
    sourceType: 'AIRA_BULLETIN',
    mode: publicLabel === 'REPLAY' ? 'Offline Replay' : 'AIRA Bulletin',
    provider: isYouTubeUrl(videoUrl) ? 'YouTube' : 'Custom Embed',
    embedUrl: previewUrl,
    fallbackVideoUrl: previewUrl,
    title: bulletin.bulletinTitle || 'AIRA Bulletin',
    subtitle: publicLabel,
    language: bulletin.language,
    startTime: toDateTimeValue(bulletin.scheduleDate, bulletin.scheduleTime),
    endTime: bulletin.endTime,
    nextLiveTime: toDateTimeValue(bulletin.scheduleDate, bulletin.scheduleTime),
    scheduleStatus: publicLabel === 'SCHEDULED' ? 'Scheduled' : 'Live',
    airaBulletinId: bulletin.id,
    airaPublicLabel: publicLabel,
    airaSourceType: 'AIRA_BULLETIN',
    airaBulletinSnapshot: bulletin,
  };
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
  const [airaBulletins, setAiraBulletins] = useState<AiraBulletin[]>([]);
  const [programQueue, setProgramQueue] = useState<ScheduleEntry[]>([]);
  const [queueDraft, setQueueDraft] = useState<ScheduleEntry>(() => createScheduleEntry());
  const [editingQueueId, setEditingQueueId] = useState<string>('');
  const [offlinePosterUploading, setOfflinePosterUploading] = useState(false);
  const [offlineVideoUploading, setOfflineVideoUploading] = useState(false);
  const [offlineUploadError, setOfflineUploadError] = useState<string>('');

  const previewUrl = useMemo(() => previewUrlFor(previewLiveTv), [previewLiveTv]);
  const validPreviewUrl = isPreviewableUrl(previewUrl);
  const previewIsVideo = isPlayableVideoUrl(previewUrl);
  const previewOfflineMode = isOfflinePlaybackMode(previewLiveTv);
  const previewOfflineLoopVideoValue = previewOfflineMode ? offlineLoopVideoFor(previewLiveTv) : '';
  const previewOfflinePosterImageValue = previewOfflineMode ? offlinePosterImageFor(previewLiveTv) : '';
  const previewOfflineLoopVideo = isPreviewableUrl(previewOfflineLoopVideoValue) ? previewOfflineLoopVideoValue : '';
  const previewOfflinePosterImage = isPreviewableUrl(previewOfflinePosterImageValue) ? previewOfflinePosterImageValue : '';
  const currentStatus = liveStatusFor(formLiveTv, previewUrlFor(formLiveTv));
  const currentTitle = titleFor(formLiveTv);
  const currentSource = currentSourceSummary(formLiveTv, previewUrlFor(formLiveTv));
  const selectedSourceType = sourceTypeFor(formLiveTv);
  const approvedAiraBulletins = useMemo(() => airaBulletins.filter((item) => item.status === 'Approved'), [airaBulletins]);
  const queueReadyAiraBulletins = useMemo(() => approvedAiraForQueue(airaBulletins), [airaBulletins]);
  const queueConflict = hasScheduleConflict(queueDraft, programQueue);
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

  useEffect(() => {
    const loadAira = () => setAiraBulletins(readAiraBulletins());
    loadAira();
    window.addEventListener('storage', loadAira);
    return () => window.removeEventListener('storage', loadAira);
  }, []);

  useEffect(() => {
    setProgramQueue(sortProgramQueue(readProgramQueue()));
  }, []);

  const updateLiveTv = useCallback((patch: Partial<LiveTvDraft>) => {
    setFormLiveTv((current) => ({ ...current, ...patch }));
  }, []);

  const handleOfflinePosterUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_OFFLINE_POSTER_UPLOAD_BYTES) {
      toast.error('Offline poster image must be 5MB or smaller.');
      return;
    }
    if (!isAcceptedOfflinePosterFile(file)) {
      toast.error('Offline poster must be a JPG, PNG, or WebP image.');
      return;
    }
    setOfflinePosterUploading(true);
    setOfflineUploadError('');
    try {
      const result = await uploadCoverImage(file);
      updateLiveTv({ offlinePosterImage: result.url });
      addActivity('URL changed', 'Offline poster image uploaded.');
      toast.success('Offline poster image uploaded.');
    } catch (error: any) {
      const message = String(error?.message || 'Offline poster upload failed.');
      setOfflineUploadError(message);
      toast.error(message);
    } finally {
      setOfflinePosterUploading(false);
    }
  }, [addActivity, updateLiveTv]);

  const handleOfflineVideoUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_OFFLINE_VIDEO_UPLOAD_BYTES) {
      toast.error('Offline loop video must be 100MB or smaller.');
      return;
    }
    if (!isAcceptedOfflineVideoFile(file)) {
      toast.error('Offline loop video must be an MP4 or WebM file.');
      return;
    }
    setOfflineVideoUploading(true);
    setOfflineUploadError('');
    try {
      const result = await uploadVideoFile(file);
      updateLiveTv({ offlineLoopVideo: result.url });
      addActivity('URL changed', 'Offline loop video uploaded.');
      toast.success('Offline loop video uploaded.');
    } catch (error: any) {
      const message = String(error?.message || 'Offline loop video upload failed.');
      setOfflineUploadError(message);
      toast.error(message);
    } finally {
      setOfflineVideoUploading(false);
    }
  }, [addActivity, updateLiveTv]);

  const applySourceType = useCallback((sourceType: LiveTvSourceType) => {
    const patch: Partial<LiveTvDraft> = { sourceType };
    if (sourceType === 'YOUTUBE_LIVE') Object.assign(patch, { mode: 'News Pulse Live', provider: 'YouTube' });
    if (sourceType === 'CUSTOM_EMBED') Object.assign(patch, { mode: 'News Pulse Live', provider: 'Custom Embed' });
    if (sourceType === 'AIRA_BULLETIN') Object.assign(patch, { mode: 'AIRA Bulletin' });
    if (sourceType === 'OFFLINE_REPLAY') Object.assign(patch, { mode: 'Offline Replay' });
    if (sourceType === 'SCHEDULED_PROGRAM') Object.assign(patch, { mode: 'Scheduled Show', scheduleStatus: 'Scheduled' });
    if (sourceType === 'BREAKING_BULLETIN') Object.assign(patch, { mode: 'Breaking Mode' });
    if (sourceType === 'SPONSORED_PROGRAM') Object.assign(patch, { mode: 'Scheduled Show', subtitle: 'SPONSORED PROGRAM' });
    if (sourceType === 'MAINTENANCE') Object.assign(patch, { mode: 'Maintenance / Coming Soon', scheduleStatus: 'Ended' });
    updateLiveTv(patch);
    addActivity('Mode changed', `Source type set to ${LIVE_TV_SOURCE_TYPES.find((item) => item.value === sourceType)?.label || sourceType}.`);
  }, [addActivity, updateLiveTv]);

  const updateQueueDraft = <K extends keyof ScheduleEntry>(key: K, value: ScheduleEntry[K]) => {
    setQueueDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'sourceType') {
        const nextSource = value as QueueSourceType;
        next.label = labelForQueueSource(nextSource);
        next.priority = nextSource === 'breaking_bulletin' ? 'breaking' : next.priority === 'breaking' ? 'high' : next.priority;
      }
      return next;
    });
  };

  const persistProgramQueue = (entries: ScheduleEntry[]) => {
    const sorted = sortProgramQueue(entries);
    setProgramQueue(sorted);
    writeProgramQueue(sorted);
  };

  const resetQueueDraft = () => {
    setQueueDraft(createScheduleEntry());
    setEditingQueueId('');
  };

  const saveQueueEntry = () => {
    if (hasScheduleConflict(queueDraft, programQueue)) {
      const ok = window.confirm('This time overlaps another scheduled Live TV program. Save anyway?');
      if (!ok) return;
    }
    const next = { ...queueDraft, updatedAt: new Date().toISOString() };
    const exists = programQueue.some((item) => item.id === next.id);
    persistProgramQueue(exists ? programQueue.map((item) => (item.id === next.id ? next : item)) : [...programQueue, next]);
    setQueueDraft(createScheduleEntry({ date: next.date }));
    setEditingQueueId('');
    toast.success('Live TV schedule entry saved.');
  };

  const editQueueEntry = (entry: ScheduleEntry) => {
    setQueueDraft(entry);
    setEditingQueueId(entry.id);
  };

  const disableQueueEntry = (entry: ScheduleEntry) => {
    persistProgramQueue(programQueue.map((item) => (item.id === entry.id ? { ...item, status: 'disabled', updatedAt: new Date().toISOString() } : item)));
    toast.success('Schedule entry disabled.');
  };

  const deleteQueueEntry = (entry: ScheduleEntry) => {
    const ok = window.confirm('Delete this program from the Live TV schedule?');
    if (!ok) return;
    persistProgramQueue(programQueue.filter((item) => item.id !== entry.id));
    if (editingQueueId === entry.id) resetQueueDraft();
    toast.success('Schedule entry deleted.');
  };

  const moveQueueEntry = (entry: ScheduleEntry, direction: -1 | 1) => {
    const index = programQueue.findIndex((item) => item.id === entry.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= programQueue.length) return;
    const next = [...programQueue];
    [next[index], next[target]] = [next[target], next[index]];
    setProgramQueue(next);
    writeProgramQueue(next);
  };

  const applyPresetSlot = (slot: (typeof DEFAULT_AIRA_SLOTS)[number]) => {
    const today = new Date().toISOString().slice(0, 10);
    setQueueDraft(createScheduleEntry({
      programTitle: slot.title,
      sourceType: slot.priority === 'breaking' ? 'breaking_bulletin' : 'aira_bulletin',
      label: slot.priority === 'breaking' ? 'BREAKING BULLETIN' : 'SCHEDULED',
      date: today,
      startTime: slot.time,
      durationMinutes: slot.durationMinutes,
      priority: slot.priority || 'normal',
      status: 'scheduled',
    }));
    setEditingQueueId('');
  };

  const activateQueueEntry = (entry: ScheduleEntry, detail = 'Live TV schedule entry activated.') => {
    const nextLiveTv = buildLiveTvFromQueueEntry(formLiveTv, entry, queueReadyAiraBulletins);
    persistProgramQueue(programQueue.map((item) => ({
      ...item,
      status: item.id === entry.id ? 'active' : item.status === 'active' ? 'completed' : item.status,
      updatedAt: item.id === entry.id ? new Date().toISOString() : item.updatedAt,
    })));
    void publishSettings(nextLiveTv, entry.sourceType === 'offline_replay' ? 'Replay activated' : 'Live published', detail);
  };

  const previewQueueEntry = (entry: ScheduleEntry) => {
    const nextLiveTv = buildLiveTvFromQueueEntry(formLiveTv, entry, queueReadyAiraBulletins);
    const url = previewUrlFor(nextLiveTv);
    if (entry.sourceType !== 'maintenance' && !url) {
      toast.error('Video preview unavailable. Check video URL.');
      return;
    }
    setPreviewLiveTv(nextLiveTv);
    toast.success('Schedule entry preview loaded.');
  };

  const setQueueEntryReplay = (entry: ScheduleEntry) => {
    activateQueueEntry({ ...entry, sourceType: 'offline_replay', label: 'REPLAY', status: 'active' }, 'Schedule entry set as replay.');
  };

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
    const nextLiveTv = { ...formLiveTv, enabled: true, showOnHomepage: true, sourceType: 'MAINTENANCE', mode: 'Maintenance / Coming Soon', scheduleStatus: 'Ended' as ScheduleStatus };
    void publishSettings(nextLiveTv, 'Live stopped', 'Maintenance mode published.');
  };

  const handleManualLiveOverride = (sourceType: 'YOUTUBE_LIVE' | 'CUSTOM_EMBED') => {
    const nextLiveTv = {
      ...formLiveTv,
      enabled: true,
      showOnHomepage: true,
      sourceType,
      mode: 'News Pulse Live',
      provider: sourceType === 'YOUTUBE_LIVE' ? 'YouTube' : 'Custom Embed',
      subtitle: 'LIVE',
      scheduleStatus: 'Live' as ScheduleStatus,
    };
    void publishSettings(nextLiveTv, 'Live published', sourceType === 'YOUTUBE_LIVE' ? 'YouTube live override started.' : 'Custom embed override started.');
  };

  const handlePlayApprovedAiraOverride = () => {
    const selected = queueReadyAiraBulletins.find((item) => item.id === queueDraft.selectedAiraBulletinId) || queueReadyAiraBulletins[0];
    if (!selected) {
      toast.error('No approved AIRA bulletin with video is available.');
      return;
    }
    handlePublishAiraNow(selected);
  };

  const handleBreakingOverride = () => {
    const entry = createScheduleEntry({
      programTitle: queueDraft.programTitle || 'Breaking Bulletin',
      sourceType: 'breaking_bulletin',
      label: 'BREAKING BULLETIN',
      date: queueDraft.date || new Date().toISOString().slice(0, 10),
      startTime: queueDraft.startTime,
      endTime: queueDraft.endTime,
      durationMinutes: queueDraft.durationMinutes || 3,
      selectedAiraBulletinId: queueDraft.selectedAiraBulletinId,
      videoUrl: queueDraft.videoUrl,
      embedUrl: queueDraft.embedUrl,
      status: 'active',
      priority: 'breaking',
    });
    activateQueueEntry(entry, 'Breaking bulletin override activated.');
  };

  const handleResumeSchedule = () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const activeEntry = programQueue.find((entry) => {
      if (entry.date !== today || entry.status === 'disabled' || entry.status === 'completed') return false;
      const start = minutesFromTime(entry.startTime);
      const end = endMinutesFor(entry);
      if (start === null || end === null) return false;
      return currentMinutes >= start && currentMinutes <= end;
    });
    if (!activeEntry) {
      toast.error('No scheduled Live TV program is active for the current time.');
      return;
    }
    activateQueueEntry(activeEntry, 'Live TV schedule resumed.');
  };

  const handleSelectAiraBulletin = (bulletin: AiraBulletin, publicLabel: 'AIRA BULLETIN • ON AIR' | 'SCHEDULED' | 'REPLAY' = 'AIRA BULLETIN • ON AIR') => {
    const videoUrl = videoUrlForAira(bulletin);
    if (!videoUrl) {
      toast.error('Video preview unavailable. Check video URL.');
      return;
    }
    const nextLiveTv = buildLiveTvFromAiraBulletin(formLiveTv, bulletin, publicLabel);
    setFormLiveTv(nextLiveTv);
    setPreviewLiveTv(nextLiveTv);
    addActivity('Mode changed', `AIRA bulletin selected: ${bulletin.bulletinTitle || 'Untitled bulletin'}.`);
  };

  const handlePreviewAiraBulletin = (bulletin: AiraBulletin) => {
    const videoUrl = videoUrlForAira(bulletin);
    if (!isPreviewableUrl(videoUrl)) {
      toast.error('Video preview unavailable. Check video URL.');
      return;
    }
    setPreviewLiveTv(buildLiveTvFromAiraBulletin(formLiveTv, bulletin, bulletin.publicLabel === 'SCHEDULED' ? 'SCHEDULED' : 'AIRA BULLETIN • ON AIR'));
    toast.success('AIRA bulletin preview loaded.');
  };

  const handlePublishAiraNow = (bulletin: AiraBulletin) => {
    const videoUrl = videoUrlForAira(bulletin);
    if (!videoUrl) {
      toast.error('Video preview unavailable. Check video URL.');
      return;
    }
    const nextLiveTv = buildLiveTvFromAiraBulletin(formLiveTv, bulletin, 'AIRA BULLETIN • ON AIR');
    void publishSettings(nextLiveTv, 'Live published', 'AIRA bulletin published to Live TV.');
  };

  const handleScheduleAira = (bulletin: AiraBulletin) => {
    const videoUrl = videoUrlForAira(bulletin);
    if (!videoUrl) {
      toast.error('Video preview unavailable. Check video URL.');
      return;
    }
    const nextLiveTv = buildLiveTvFromAiraBulletin(formLiveTv, bulletin, 'SCHEDULED');
    void saveDraft(nextLiveTv, 'Draft saved', 'AIRA bulletin scheduled in Live TV draft.');
  };

  const handleSetAiraReplay = (bulletin: AiraBulletin) => {
    const videoUrl = videoUrlForAira(bulletin);
    if (!videoUrl) {
      toast.error('Video preview unavailable. Check video URL.');
      return;
    }
    const nextLiveTv = buildLiveTvFromAiraBulletin(formLiveTv, bulletin, 'REPLAY');
    void publishSettings(nextLiveTv, 'Replay activated', 'AIRA bulletin set as replay.');
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Current Public Live TV Source</h2>
          <a href={publicLiveTvUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50">Open Public Live TV</a>
        </div>
        <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div><dt className="font-semibold text-slate-500">sourceType</dt><dd className="mt-1 text-slate-950">{currentSource.sourceType}</dd></div>
          <div><dt className="font-semibold text-slate-500">currentProgramTitle</dt><dd className="mt-1 text-slate-950">{currentSource.title}</dd></div>
          <div><dt className="font-semibold text-slate-500">label</dt><dd className="mt-1 text-slate-950">{currentSource.label}</dd></div>
          <div><dt className="font-semibold text-slate-500">status</dt><dd className="mt-1 text-slate-950">{currentSource.status}</dd></div>
          <div className="md:col-span-2"><dt className="font-semibold text-slate-500">video URL</dt><dd className="mt-1 break-all text-slate-950">{currentSource.url || 'No URL selected'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Start Time</dt><dd className="mt-1 text-slate-950">{formatWhen(currentSource.startTime)}</dd></div>
          <div><dt className="font-semibold text-slate-500">End Time</dt><dd className="mt-1 text-slate-950">{formatWhen(currentSource.endTime)}</dd></div>
          <div><dt className="font-semibold text-slate-500">Updated At</dt><dd className="mt-1 text-slate-950">{formatWhen(currentSource.updatedAt)}</dd></div>
        </dl>
        <p className="mt-4 text-sm text-slate-600">Priority display: Breaking Bulletin, manual live/custom embed, scheduled AIRA bulletin in its time window, offline replay, then maintenance.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Manual Override Controls</h2>
            <p className="mt-1 text-sm text-slate-600">Manual choices publish immediately and take priority over the local schedule queue.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => handleManualLiveOverride('YOUTUBE_LIVE')} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">Start YouTube Live</button>
            <button type="button" onClick={() => handleManualLiveOverride('CUSTOM_EMBED')} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">Start Custom Embed</button>
            <button type="button" onClick={handlePlayApprovedAiraOverride} disabled={busy || !queueReadyAiraBulletins.length} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">Play Approved AIRA Bulletin</button>
            <button type="button" onClick={handleSwitchReplay} disabled={busy} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-60">Set Offline Replay</button>
            <button type="button" onClick={handleBreakingOverride} disabled={busy} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60">Trigger Breaking Bulletin</button>
            <button type="button" onClick={handleDeactivate} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Stop Current Program</button>
            <button type="button" onClick={handleResumeSchedule} disabled={busy || !programQueue.length} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">Resume Schedule</button>
          </div>
        </div>
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
              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Source Type
                <select className={fieldClass('mt-2')} value={selectedSourceType} onChange={(event) => applySourceType(event.target.value as LiveTvSourceType)}>
                  {LIVE_TV_SOURCE_TYPES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                </select>
              </label>

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
                  {LIVE_TV_MODES.map((mode) => <option key={mode} value={mode}>{modeLabelFor(mode)}</option>)}
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Offline Replay Media</h3>
                    <p className="mt-1 text-xs text-slate-600">Used when Live TV is in Offline Replay, Maintenance / Coming Soon, or offline mode.</p>
                  </div>
                  {offlinePosterUploading || offlineVideoUploading ? <span className="text-xs font-semibold text-blue-700">Uploading...</span> : null}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Offline Poster Image URL
                    <input className={fieldClass('mt-2')} value={formLiveTv.offlinePosterImage || ''} onChange={(event) => updateLiveTv({ offlinePosterImage: event.target.value })} placeholder="https://.../offline-poster.webp" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Upload Offline Poster Image
                    <input
                      type="file"
                      accept={OFFLINE_POSTER_ACCEPT}
                      disabled={offlinePosterUploading || busy}
                      className={fieldClass('mt-2 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500')}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] || null;
                        void handleOfflinePosterUpload(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>

                  <div className="md:col-span-2">
                    {formLiveTv.offlinePosterImage ? (
                      <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                        <img src={formLiveTv.offlinePosterImage} alt="Offline poster preview" className="h-full w-full object-cover" />
                      </div>
                    ) : <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500">No offline poster image selected.</div>}
                  </div>

                  <label className="block text-sm font-semibold text-slate-700">
                    Offline Loop Video URL
                    <input className={fieldClass('mt-2')} value={formLiveTv.offlineLoopVideo || ''} onChange={(event) => updateLiveTv({ offlineLoopVideo: event.target.value })} placeholder="https://.../offline-loop.mp4" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Upload Offline Loop Video
                    <input
                      type="file"
                      accept={OFFLINE_VIDEO_ACCEPT}
                      disabled={offlineVideoUploading || busy}
                      className={fieldClass('mt-2 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500')}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] || null;
                        void handleOfflineVideoUpload(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>

                  <div className="md:col-span-2">
                    {formLiveTv.offlineLoopVideo ? (
                      <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                        <video key={formLiveTv.offlineLoopVideo} controls muted loop playsInline src={formLiveTv.offlineLoopVideo} className="h-full w-full bg-slate-950 object-contain" />
                      </div>
                    ) : <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500">No offline loop video selected.</div>}
                  </div>

                  <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                    Offline Message
                    <input className={fieldClass('mt-2')} value={formLiveTv.offlineMessage || DEFAULT_OFFLINE_MESSAGE} onChange={(event) => updateLiveTv({ offlineMessage: event.target.value })} placeholder={DEFAULT_OFFLINE_MESSAGE} />
                  </label>
                </div>

                {offlineUploadError ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{offlineUploadError}</div> : null}
              </div>

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
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Approved AIRA Bulletins</h2>
                <p className="mt-1 text-sm text-slate-600">Select, preview, publish, schedule, or set an approved AIRA bulletin as replay. Sponsored Program is a future placeholder only.</p>
              </div>
              <button type="button" onClick={() => setAiraBulletins(readAiraBulletins())} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Refresh AIRA List</button>
            </div>
            {approvedAiraBulletins.length ? (
              <div className="mt-4 space-y-3">
                {approvedAiraBulletins.map((bulletin) => (
                  <div key={bulletin.id} className={`rounded-2xl border p-4 ${formLiveTv.airaBulletinId === bulletin.id ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="grid gap-3 text-sm lg:grid-cols-[1fr_0.6fr_0.7fr_0.6fr_0.8fr_0.7fr_1.4fr]">
                      <div><div className="font-semibold text-slate-950">{bulletin.bulletinTitle || 'Untitled bulletin'}</div><div className="mt-1 text-xs text-slate-500">{bulletin.publicLabel || 'AIRA BULLETIN'}</div></div>
                      <div>{bulletin.language}</div>
                      <div>{bulletin.bulletinType}</div>
                      <div>{bulletin.duration} min</div>
                      <div>{[bulletin.scheduleDate, bulletin.scheduleTime].filter(Boolean).join(' ') || 'Not set'}</div>
                      <div>{videoUrlForAira(bulletin) ? 'Video: yes' : 'Video: no'}</div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleSelectAiraBulletin(bulletin)} className="text-sm font-semibold text-blue-700">Select</button>
                        <button type="button" onClick={() => handlePreviewAiraBulletin(bulletin)} className="text-sm font-semibold text-slate-800">Preview</button>
                        <button type="button" onClick={() => handlePublishAiraNow(bulletin)} className="text-sm font-semibold text-red-700">Publish Now</button>
                        <button type="button" onClick={() => handleScheduleAira(bulletin)} className="text-sm font-semibold text-amber-700">Schedule</button>
                        <button type="button" onClick={() => handleSetAiraReplay(bulletin)} className="text-sm font-semibold text-emerald-700">Set as Replay</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">No approved AIRA bulletins found. Approve a bulletin in AIRA Studio first.</div>
            )}
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Live TV Schedule / Program Queue</h2>
                <p className="mt-1 text-sm text-slate-600">Local schedule foundation for planning what should play at specific times.</p>
              </div>
              <button type="button" onClick={resetQueueDraft} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">New Program</button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-700">Default AIRA Slots</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEFAULT_AIRA_SLOTS.map((slot) => (
                  <button key={`${slot.time}-${slot.title}`} type="button" onClick={() => applyPresetSlot(slot)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                    {slot.time ? `${slot.time} ` : ''}{slot.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Program Title
                <input className={fieldClass('mt-2')} value={queueDraft.programTitle} onChange={(event) => updateQueueDraft('programTitle', event.target.value)} placeholder="Evening Bulletin" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Source Type
                <select className={fieldClass('mt-2')} value={queueDraft.sourceType} onChange={(event) => updateQueueDraft('sourceType', event.target.value as QueueSourceType)}>
                  {QUEUE_SOURCE_TYPES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Public Label
                <select className={fieldClass('mt-2')} value={queueDraft.label} onChange={(event) => updateQueueDraft('label', event.target.value as QueueLabel)}>
                  {QUEUE_LABELS.map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Date
                <input type="date" className={fieldClass('mt-2')} value={queueDraft.date} onChange={(event) => updateQueueDraft('date', event.target.value)} />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Start Time
                <input type="time" className={fieldClass('mt-2')} value={queueDraft.startTime} onChange={(event) => updateQueueDraft('startTime', event.target.value)} />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                End Time
                <input type="time" className={fieldClass('mt-2')} value={queueDraft.endTime} onChange={(event) => updateQueueDraft('endTime', event.target.value)} />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Duration
                <select className={fieldClass('mt-2')} value={queueDraft.durationMinutes} onChange={(event) => updateQueueDraft('durationMinutes', Number(event.target.value))}>
                  {QUEUE_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Status
                <select className={fieldClass('mt-2')} value={queueDraft.status} onChange={(event) => updateQueueDraft('status', event.target.value as QueueStatus)}>
                  {QUEUE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Priority
                <select className={fieldClass('mt-2')} value={queueDraft.priority} onChange={(event) => updateQueueDraft('priority', event.target.value as QueuePriority)}>
                  {QUEUE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Repeat
                <select className={fieldClass('mt-2')} value={queueDraft.repeat} onChange={(event) => updateQueueDraft('repeat', event.target.value as QueueRepeat)}>
                  {QUEUE_REPEATS.map((repeat) => <option key={repeat} value={repeat}>{repeat}</option>)}
                </select>
              </label>

              {queueDraft.sourceType === 'aira_bulletin' ? (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Approved AIRA Bulletin
                    <select className={fieldClass('mt-2')} value={queueDraft.selectedAiraBulletinId} onChange={(event) => updateQueueDraft('selectedAiraBulletinId', event.target.value)}>
                      <option value="">Select approved bulletin</option>
                      {queueReadyAiraBulletins.map((bulletin) => <option key={bulletin.id} value={bulletin.id}>{bulletin.bulletinTitle || 'Untitled bulletin'} · {bulletin.language} · {bulletin.duration} min</option>)}
                    </select>
                  </label>
                  <div className="mt-3 grid gap-3">
                    {queueReadyAiraBulletins.length ? queueReadyAiraBulletins.map((bulletin) => (
                      <div key={bulletin.id} className={`rounded-xl border px-4 py-3 text-sm ${queueDraft.selectedAiraBulletinId === bulletin.id ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="font-semibold text-slate-950">{bulletin.bulletinTitle || 'Untitled bulletin'}</div>
                            <div className="mt-1 text-xs text-slate-600">{bulletin.language} · {bulletin.bulletinType} · {bulletin.duration} min · Video {videoUrlForAira(bulletin) ? 'available' : 'missing'}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => updateQueueDraft('selectedAiraBulletinId', bulletin.id)} className="text-sm font-semibold text-blue-700">Select</button>
                            <button type="button" onClick={() => handlePreviewAiraBulletin(bulletin)} className="text-sm font-semibold text-slate-800">Preview</button>
                          </div>
                        </div>
                      </div>
                    )) : <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-600">No approved AIRA bulletins with video are ready for the queue.</div>}
                  </div>
                </div>
              ) : null}

              {queueDraft.sourceType === 'sponsored_program' ? (
                <>
                  <label className="block text-sm font-semibold text-slate-700">
                    Sponsor Name
                    <input className={fieldClass('mt-2')} value={queueDraft.sponsorName} onChange={(event) => updateQueueDraft('sponsorName', event.target.value)} placeholder="Sponsor name" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Sponsor Label
                    <input className={fieldClass('mt-2')} value={queueDraft.sponsorLabel} onChange={(event) => updateQueueDraft('sponsorLabel', event.target.value)} placeholder="Presented by..." />
                  </label>
                </>
              ) : null}

              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Video URL
                <input className={fieldClass('mt-2')} value={queueDraft.videoUrl} onChange={(event) => updateQueueDraft('videoUrl', event.target.value)} placeholder="Optional direct video URL" />
              </label>

              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Embed URL
                <input className={fieldClass('mt-2')} value={queueDraft.embedUrl} onChange={(event) => updateQueueDraft('embedUrl', event.target.value)} placeholder="Optional embed URL" />
              </label>
            </div>

            {queueConflict ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">This time overlaps another scheduled Live TV program.</div> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={saveQueueEntry} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">{editingQueueId ? 'Update Program' : 'Add to Queue'}</button>
              <button type="button" onClick={() => previewQueueEntry(queueDraft)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Preview Draft</button>
              <button type="button" onClick={() => activateQueueEntry(queueDraft)} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">Activate Draft Now</button>
              <button type="button" onClick={resetQueueDraft} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Clear</button>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">Program Queue</h3>
                <span className="text-sm font-semibold text-slate-500">{programQueue.length} items</span>
              </div>
              {programQueue.length ? programQueue.map((entry, index) => (
                <div key={entry.id} className={`rounded-2xl border p-4 ${entry.status === 'active' ? 'border-emerald-200 bg-emerald-50' : entry.status === 'disabled' ? 'border-slate-200 bg-slate-100 opacity-75' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="grid gap-3 text-sm xl:grid-cols-[1fr_0.6fr_0.8fr_0.7fr_0.6fr_1.6fr]">
                    <div>
                      <div className="font-semibold text-slate-950">{entry.programTitle || 'Untitled program'}</div>
                      <div className="mt-1 text-xs text-slate-600">{QUEUE_SOURCE_TYPES.find((source) => source.value === entry.sourceType)?.label || entry.sourceType} · {entry.label}</div>
                    </div>
                    <div>{entry.date || 'No date'}</div>
                    <div>{entry.startTime || 'No start'} - {entry.endTime || `${entry.durationMinutes} min`}</div>
                    <div>{entry.status}</div>
                    <div>{entry.priority}</div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => editQueueEntry(entry)} className="text-sm font-semibold text-blue-700">Edit</button>
                      <button type="button" onClick={() => previewQueueEntry(entry)} className="text-sm font-semibold text-slate-800">Preview</button>
                      <button type="button" onClick={() => activateQueueEntry(entry)} className="text-sm font-semibold text-emerald-700">Activate Now</button>
                      <button type="button" onClick={() => disableQueueEntry(entry)} className="text-sm font-semibold text-amber-700">Disable</button>
                      <button type="button" onClick={() => deleteQueueEntry(entry)} className="text-sm font-semibold text-red-700">Delete from Schedule</button>
                      <button type="button" onClick={() => moveQueueEntry(entry, -1)} disabled={index === 0} className="text-sm font-semibold text-slate-700 disabled:opacity-40">Move Up</button>
                      <button type="button" onClick={() => moveQueueEntry(entry, 1)} disabled={index === programQueue.length - 1} className="text-sm font-semibold text-slate-700 disabled:opacity-40">Move Down</button>
                      <button type="button" onClick={() => setQueueEntryReplay(entry)} className="text-sm font-semibold text-purple-700">Set as Replay</button>
                    </div>
                  </div>
                </div>
              )) : <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">No scheduled programs yet. Add a default AIRA slot or create a custom program.</div>}
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
              ) : previewOfflineLoopVideo ? (
                <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
                  <video key={previewOfflineLoopVideo} controls muted loop playsInline autoPlay src={previewOfflineLoopVideo} className="h-full w-full bg-slate-950 object-contain" />
                </div>
              ) : previewOfflinePosterImage ? (
                <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
                  <img src={previewOfflinePosterImage} alt="Offline poster preview" className="h-full w-full object-cover" />
                </div>
              ) : validPreviewUrl ? (
                <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
                  {previewIsVideo ? (
                    <video key={previewUrl} controls src={previewUrl} className="h-full w-full bg-slate-950" />
                  ) : (
                    <iframe key={previewUrl} title={titleFor(previewLiveTv)} src={previewUrl} className="h-full w-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
                  )}
                </div>
              ) : previewLiveTv.sourceType === 'AIRA_BULLETIN' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-12 text-center text-sm font-semibold text-amber-900">Video preview unavailable. Check video URL.</div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-12 text-center">
                  <div className="text-lg font-semibold text-slate-900">{offlineMessageFor(previewLiveTv)}</div>
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
              <a href={publicLiveTvUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50">Open Public Live TV</a>
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