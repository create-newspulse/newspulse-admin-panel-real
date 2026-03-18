import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Switch from '@/components/settings/Switch';
import { useNotify } from '@/components/ui/toast-bridge';
import {
  createTickerAd,
  deleteTickerAd,
  listTickerAds,
  type TickerAd,
  type TickerAdChannel,
  type TickerAdDayPart,
  type TickerAdLanguage,
  type TickerAdMutation,
  updateTickerAd,
} from '@/api/tickerAds';
import { AdminApiError } from '@/lib/http/adminFetch';

const CHANNEL_OPTIONS: Array<{ value: TickerAdChannel; label: string }> = [
  { value: 'breaking', label: 'Breaking' },
  { value: 'live', label: 'Live Updates' },
  { value: 'both', label: 'Both' },
];

const LANGUAGE_OPTIONS: Array<{ value: TickerAdLanguage; label: string }> = [
  { value: 'all', label: 'All Languages (EN+HI+GU)' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
];

const DAY_PART_OPTIONS: Array<{ value: TickerAdDayPart; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'noon', label: 'Noon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
];

type FormState = {
  message: string;
  messageEn: string;
  messageHi: string;
  messageGu: string;
  url: string;
  channel: TickerAdChannel;
  language: TickerAdLanguage;
  startAtLocal: string;
  endAtLocal: string;
  dayParts: TickerAdDayPart[];
  priority: string;
  frequency: number;
  active: boolean;
};

type FormErrors = Partial<Record<'message' | 'messageEn' | 'messageHi' | 'messageGu' | 'url' | 'startAtLocal' | 'endAtLocal', string>>;

function normalizeLanguageCode(value: unknown): TickerAdLanguage {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'all' || normalized === 'all languages' || normalized === 'all-languages' || normalized === 'all_languages') return 'all';
  if (normalized === 'hindi' || normalized === 'hi') return 'hi';
  if (normalized === 'gujarati' || normalized === 'gu') return 'gu';
  return 'en';
}

function normalizeDayPartCode(value: unknown): TickerAdDayPart | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'morning') return 'morning';
  if (normalized === 'noon') return 'noon';
  if (normalized === 'evening') return 'evening';
  if (normalized === 'night') return 'night';
  return null;
}

function normalizeDayPartsCodes(value: unknown): TickerAdDayPart[] {
  const rawValues = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[|,]/g) : [];
  const unique = new Set<TickerAdDayPart>();
  for (const raw of rawValues) {
    const normalized = normalizeDayPartCode(raw);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toLocalInputValue(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function createEmptyForm(): FormState {
  const start = new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    message: '',
    messageEn: '',
    messageHi: '',
    messageGu: '',
    url: '',
    channel: 'both',
    language: 'en',
    startAtLocal: toLocalInputValue(start.toISOString()),
    endAtLocal: toLocalInputValue(end.toISOString()),
    dayParts: [],
    priority: '0',
    frequency: 1,
    active: true,
  };
}

function formFromAd(ad: TickerAd): FormState {
  return {
    message: ad.message,
    messageEn: ad.messages?.en || (ad.language === 'en' ? ad.message : ''),
    messageHi: ad.messages?.hi || (ad.language === 'hi' ? ad.message : ''),
    messageGu: ad.messages?.gu || (ad.language === 'gu' ? ad.message : ''),
    url: ad.url || '',
    channel: ad.channel,
    language: normalizeLanguageCode(ad.language),
    startAtLocal: toLocalInputValue(ad.startAt),
    endAtLocal: toLocalInputValue(ad.endAt),
    dayParts: normalizeDayPartsCodes(ad.dayParts),
    priority: String(ad.priority),
    frequency: ad.frequency,
    active: ad.active,
  };
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateForm(form: FormState): { errors: FormErrors; payload: TickerAdMutation | null } {
  const errors: FormErrors = {};
  const language = normalizeLanguageCode(form.language);
  const message = form.message.trim();
  const messageEn = form.messageEn.trim();
  const messageHi = form.messageHi.trim();
  const messageGu = form.messageGu.trim();
  const url = form.url.trim();
  const startAt = fromLocalInputValue(form.startAtLocal);
  const endAt = fromLocalInputValue(form.endAtLocal);

  if (language === 'all') {
    if (!messageEn) errors.messageEn = 'English message is required.';
    if (!messageHi) errors.messageHi = 'Hindi message is required.';
    if (!messageGu) errors.messageGu = 'Gujarati message is required.';
  } else {
    if (!message) {
      errors.message = 'Message is required.';
    }
  }
  if (url && !isValidUrl(url)) {
    errors.url = 'Enter a valid URL, including http:// or https://.';
  }
  if (!startAt) {
    errors.startAtLocal = 'Start date and time are required.';
  }
  if (!endAt) {
    errors.endAtLocal = 'End date and time are required.';
  }
  if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    errors.endAtLocal = 'End must be later than start.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors, payload: null };
  }

  const priorityNumber = Number(form.priority);
  const dayParts = normalizeDayPartsCodes(form.dayParts);
  return {
    errors,
    payload:
      language === 'all'
        ? {
          ...(url ? { url } : {}),
          channel: form.channel,
          language: 'all',
          messages: {
            en: messageEn,
            hi: messageHi,
            gu: messageGu,
          },
          startAt,
          endAt,
          dayParts,
          priority: Number.isFinite(priorityNumber) ? Math.round(priorityNumber) : 0,
          frequency: Math.min(10, Math.max(1, Math.round(form.frequency))),
          active: form.active,
        }
        : {
          message,
          ...(url ? { url } : {}),
          channel: form.channel,
          language,
          startAt,
          endAt,
          dayParts,
          priority: Number.isFinite(priorityNumber) ? Math.round(priorityNumber) : 0,
          frequency: Math.min(10, Math.max(1, Math.round(form.frequency))),
          active: form.active,
        },
  };
}

function truncateMessage(value: string, limit = 52): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}…`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function getCurrentDayPart(now: Date): TickerAdDayPart {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'noon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function isActiveNow(ad: TickerAd, now: Date): boolean {
  if (!ad.active) return false;

  const startAt = new Date(ad.startAt).getTime();
  const endAt = new Date(ad.endAt).getTime();
  const nowTime = now.getTime();
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return false;
  if (nowTime < startAt || nowTime >= endAt) return false;

  if (ad.dayParts.length === 0) return true;
  return ad.dayParts.includes(getCurrentDayPart(now));
}

function sortAds(items: TickerAd[]): TickerAd[] {
  return items.slice().sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    if (left.frequency !== right.frequency) return left.frequency - right.frequency;
    return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
  });
}

function apiErrorDetails(error: unknown): string {
  if (error instanceof AdminApiError) {
    const body = (error as any).body;
    if (!body) return error.message;
    if (typeof body === 'string') return `${error.message} • ${body}`;
    try {
      return `${error.message} • ${JSON.stringify(body)}`;
    } catch {
      return error.message;
    }
  }
  return (error as any)?.message || 'API error';
}

function channelMatches(target: 'breaking' | 'live', channel: TickerAdChannel): boolean {
  return channel === 'both' || channel === target;
}

function adMessageForLanguage(ad: TickerAd, language: 'en' | 'hi' | 'gu'): string {
  if (ad.language !== 'all') return ad.message;
  const fromMessages = ad.messages?.[language];
  return String(fromMessages || ad.message || '').trim();
}

export default function BroadcastCenterTickerAds() {
  const notify = useNotify();
  const submitInFlightRef = useRef(false);
  const [ads, setAds] = useState<TickerAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<TickerAd | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<TickerAd | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  async function loadAds(opts?: { silent?: boolean }) {
    if (!opts?.silent) {
      setRefreshing(true);
    }
    try {
      const items = await listTickerAds();
      setAds(sortAds(items));
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      notify.err('Ticker Ads refresh failed', apiErrorDetails(error));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAds();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const previewGroups = useMemo(() => {
    const currentAds = sortAds(ads.filter((ad) => isActiveNow(ad, now)));
    const matchesLang = (ad: TickerAd, lang: 'en' | 'hi' | 'gu') => ad.language === 'all' || ad.language === lang;
    return {
      breaking: {
        en: currentAds.filter((ad) => channelMatches('breaking', ad.channel) && matchesLang(ad, 'en')),
        hi: currentAds.filter((ad) => channelMatches('breaking', ad.channel) && matchesLang(ad, 'hi')),
        gu: currentAds.filter((ad) => channelMatches('breaking', ad.channel) && matchesLang(ad, 'gu')),
      },
      live: {
        en: currentAds.filter((ad) => channelMatches('live', ad.channel) && matchesLang(ad, 'en')),
        hi: currentAds.filter((ad) => channelMatches('live', ad.channel) && matchesLang(ad, 'hi')),
        gu: currentAds.filter((ad) => channelMatches('live', ad.channel) && matchesLang(ad, 'gu')),
      },
    };
  }, [ads, now]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'message' || key === 'messageEn' || key === 'messageHi' || key === 'messageGu' || key === 'url' || key === 'startAtLocal' || key === 'endAtLocal') {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof FormErrors];
        return next;
      });
    }
  }

  function openCreateModal() {
    setEditingAd(null);
    setForm(createEmptyForm());
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(ad: TickerAd) {
    setEditingAd(ad);
    setForm(formFromAd(ad));
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingAd(null);
    setFormErrors({});
  }

  async function handleSubmit() {
    if (submitInFlightRef.current || saving) return;
    submitInFlightRef.current = true;
    const result = validateForm(form);
    setFormErrors(result.errors);
    if (!result.payload) {
      submitInFlightRef.current = false;
      return;
    }

    setSaving(true);
    try {
      if (editingAd?.id) {
        await updateTickerAd(editingAd.id, result.payload);
        notify.ok('Ticker ad updated');
      } else {
        await createTickerAd(result.payload);
        notify.ok('Ticker ad created');
      }
      closeModal();
      await loadAds({ silent: true });
    } catch (error) {
      notify.err(editingAd ? 'Ticker ad update failed' : 'Ticker ad create failed', apiErrorDetails(error));
    } finally {
      setSaving(false);
      submitInFlightRef.current = false;
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget?.id) {
      setDeleteTarget(null);
      return;
    }
    const current = deleteTarget;
    setBusyIds((prev) => ({ ...prev, [current.id]: true }));
    try {
      await deleteTickerAd(current.id);
      notify.ok('Ticker ad deleted');
      setDeleteTarget(null);
      await loadAds({ silent: true });
    } catch (error) {
      notify.err('Ticker ad delete failed', apiErrorDetails(error));
    } finally {
      setBusyIds((prev) => ({ ...prev, [current.id]: false }));
    }
  }

  async function handleToggle(ad: TickerAd, nextActive: boolean) {
    if (!ad.id) return;
    setBusyIds((prev) => ({ ...prev, [ad.id]: true }));
    try {
      await updateTickerAd(
        ad.id,
        ad.language === 'all'
          ? {
            ...(ad.url ? { url: ad.url } : {}),
            channel: ad.channel,
            language: 'all',
            messages: {
              en: String(ad.messages?.en || ad.message || '').trim(),
              hi: String(ad.messages?.hi || ad.message || '').trim(),
              gu: String(ad.messages?.gu || ad.message || '').trim(),
            },
            dayParts: ad.dayParts,
            startAt: ad.startAt,
            endAt: ad.endAt,
            priority: ad.priority,
            frequency: ad.frequency,
            active: nextActive,
          }
          : {
            message: ad.message,
            ...(ad.url ? { url: ad.url } : {}),
            channel: ad.channel,
            language: ad.language,
            dayParts: ad.dayParts,
            startAt: ad.startAt,
            endAt: ad.endAt,
            priority: ad.priority,
            frequency: ad.frequency,
            active: nextActive,
          },
      );
      notify.ok(nextActive ? 'Ticker ad enabled' : 'Ticker ad disabled');
      await loadAds({ silent: true });
    } catch (error) {
      notify.err('Ticker ad toggle failed', apiErrorDetails(error));
    } finally {
      setBusyIds((prev) => ({ ...prev, [ad.id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ticker Ads (Paid Scroll)</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Separate paid scroll manager for scheduled ticker lines. Breaking and Live Updates 24h items are unchanged.
            </p>
            {lastLoadedAt ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Last refreshed {formatDateTime(lastLoadedAt)}</div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              disabled={refreshing}
              onClick={() => void loadAds()}
            >
              {refreshing ? 'Refreshing…' : 'Refresh list'}
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              onClick={openCreateModal}
            >
              Create ticker ad
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Preview (Now)</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Active window at {now.toLocaleString()} based on channel, language, schedule, and day parts.
            </div>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Current day part: {getCurrentDayPart(now)}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {(['breaking', 'live'] as const).map((channel) => (
            <div key={channel} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {channel === 'breaking' ? 'Breaking' : 'Live Updates'}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {(['en', 'hi', 'gu'] as const).map((language) => {
                  const items = previewGroups[channel][language];
                  return (
                    <div key={`${channel}-${language}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                      <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : 'Gujarati'}
                      </div>
                      {items.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">No active paid scroll lines right now.</div>
                      ) : (
                        <div className="space-y-2">
                          {items.map((ad) => (
                            <div key={`${channel}-${language}-${ad.id || ad.message}-${ad.startAt}`} className="rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                              <div className="font-medium text-slate-900 dark:text-white">{adMessageForLanguage(ad, language)}</div>
                              <div className="mt-1 text-slate-500 dark:text-slate-400">P{ad.priority} • Every {ad.frequency} items</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-3 py-3 font-semibold">Message</th>
                <th className="px-3 py-3 font-semibold">Channel</th>
                <th className="px-3 py-3 font-semibold">Language</th>
                <th className="px-3 py-3 font-semibold">DayParts</th>
                <th className="px-3 py-3 font-semibold">Start → End</th>
                <th className="px-3 py-3 font-semibold">Active</th>
                <th className="px-3 py-3 font-semibold">Priority</th>
                <th className="px-3 py-3 font-semibold">Frequency</th>
                <th className="px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {ads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {loading ? 'Loading ticker ads…' : 'No paid ticker ads found.'}
                  </td>
                </tr>
              ) : (
                ads.map((ad) => {
                  const busy = !!busyIds[ad.id];
                  return (
                    <tr key={ad.id || `${ad.message}-${ad.startAt}`} className="align-top text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-3">
                        <div className="max-w-xs truncate font-medium text-slate-900 dark:text-white" title={ad.message}>
                          {truncateMessage(ad.message)}
                        </div>
                        {ad.url ? (
                          <div className="mt-1 max-w-xs truncate text-xs text-slate-500 dark:text-slate-400" title={ad.url}>
                            {ad.url}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {ad.channel}
                        </span>
                      </td>
                      <td className="px-3 py-3 uppercase">{ad.language}</td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-[14rem] flex-wrap gap-1">
                          {ad.dayParts.length === 0 ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                              All day
                            </span>
                          ) : (
                            ad.dayParts.map((dayPart) => (
                              <span key={`${ad.id}-${dayPart}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {dayPart}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>{formatDateTime(ad.startAt)}</div>
                        <div className="mt-1">{formatDateTime(ad.endAt)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Switch checked={ad.active} onCheckedChange={(next) => void handleToggle(ad, next)} disabled={busy} label="Toggle active status" />
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{ad.active ? 'ON' : 'OFF'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">{ad.priority}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">Every {ad.frequency} items</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                            disabled={busy}
                            onClick={() => openEditModal(ad)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/40"
                            disabled={busy}
                            onClick={() => setDeleteTarget(ad)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="mx-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingAd ? 'Edit ticker ad' : 'Create ticker ad'}
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Configure the paid scroll line, schedule, language, and injection frequency.
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              <div>
                {form.language === 'all' ? (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-900 dark:text-white">Message (English)</label>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{form.messageEn.length}/140</div>
                      </div>
                      <textarea
                        value={form.messageEn}
                        maxLength={140}
                        rows={3}
                        onChange={(event) => updateForm('messageEn', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        placeholder="Sponsored ticker message (EN)"
                      />
                      {formErrors.messageEn ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{formErrors.messageEn}</div> : null}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-900 dark:text-white">Message (Hindi)</label>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{form.messageHi.length}/140</div>
                      </div>
                      <textarea
                        value={form.messageHi}
                        maxLength={140}
                        rows={3}
                        onChange={(event) => updateForm('messageHi', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        placeholder="Sponsored ticker message (HI)"
                      />
                      {formErrors.messageHi ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{formErrors.messageHi}</div> : null}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-900 dark:text-white">Message (Gujarati)</label>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{form.messageGu.length}/140</div>
                      </div>
                      <textarea
                        value={form.messageGu}
                        maxLength={140}
                        rows={3}
                        onChange={(event) => updateForm('messageGu', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        placeholder="Sponsored ticker message (GU)"
                      />
                      {formErrors.messageGu ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{formErrors.messageGu}</div> : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-900 dark:text-white">Message</label>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{form.message.length}/140</div>
                    </div>
                    <textarea
                      value={form.message}
                      maxLength={140}
                      rows={3}
                      onChange={(event) => updateForm('message', event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder="Sponsored ticker message"
                    />
                    {formErrors.message ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{formErrors.message}</div> : null}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">URL (optional)</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(event) => updateForm('url', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="https://example.com/offer"
                />
                {formErrors.url ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{formErrors.url}</div> : null}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">Channel</label>
                  <select
                    value={form.channel}
                    onChange={(event) => updateForm('channel', event.target.value as TickerAdChannel)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {CHANNEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">Language</label>
                  <select
                    value={form.language}
                    onChange={(event) => {
                      const nextLanguage = normalizeLanguageCode(event.target.value);
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next.message;
                        delete next.messageEn;
                        delete next.messageHi;
                        delete next.messageGu;
                        return next;
                      });
                      setForm((prev) => {
                        if (nextLanguage === prev.language) return prev;

                        if (nextLanguage === 'all' && prev.language !== 'all') {
                          return {
                            ...prev,
                            language: nextLanguage,
                            messageEn: prev.messageEn || prev.message,
                          };
                        }

                        if (nextLanguage !== 'all' && prev.language === 'all') {
                          const nextMessage = nextLanguage === 'en'
                            ? prev.messageEn
                            : nextLanguage === 'hi'
                              ? prev.messageHi
                              : prev.messageGu;
                          return {
                            ...prev,
                            language: nextLanguage,
                            message: prev.message || nextMessage || prev.messageEn || prev.messageHi || prev.messageGu,
                          };
                        }

                        return { ...prev, language: nextLanguage };
                      });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">Start datetime</label>
                  <input
                    type="datetime-local"
                    value={form.startAtLocal}
                    onChange={(event) => updateForm('startAtLocal', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  {formErrors.startAtLocal ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{formErrors.startAtLocal}</div> : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">End datetime</label>
                  <input
                    type="datetime-local"
                    value={form.endAtLocal}
                    onChange={(event) => updateForm('endAtLocal', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  {formErrors.endAtLocal ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{formErrors.endAtLocal}</div> : null}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">DayParts</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_PART_OPTIONS.map((option) => {
                    const selected = form.dayParts.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? form.dayParts.filter((value) => value !== option.value)
                            : [...form.dayParts, option.value];
                          updateForm('dayParts', next);
                        }}
                        className={
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition ' +
                          (selected
                            ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800')
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Leave empty to run all day.</div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">Priority</label>
                  <input
                    type="number"
                    step={1}
                    value={form.priority}
                    onChange={(event) => updateForm('priority', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white">Frequency</label>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Every {form.frequency} items</div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={form.frequency}
                    onChange={(event) => updateForm('frequency', Number(event.target.value))}
                    className="w-full"
                  />
                  <select
                    value={form.frequency}
                    onChange={(event) => updateForm('frequency', Number(event.target.value))}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>Every {value} items</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Active</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Turn the line on or off without changing its schedule.</div>
                </div>
                <Switch checked={form.active} onCheckedChange={(next) => updateForm('active', next)} label="Active toggle" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                disabled={saving}
                onClick={() => void handleSubmit()}
              >
                {saving ? 'Saving…' : editingAd ? 'Save changes' : 'Create ad'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete ticker ad?"
        description={deleteTarget ? `This removes the paid scroll line: ${deleteTarget.message}` : undefined}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </div>
  );
}