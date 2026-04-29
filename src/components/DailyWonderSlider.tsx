import React, { useEffect, useState } from 'react';
import settingsApi from '@/lib/settingsApi';

const DEFAULT_DAILY_WONDERS = {
  enabled: true,
  showOnHomepage: true,
  smallLabel: 'DAILY WONDERS',
  title: 'Thought of the Day',
  subtitle: 'One meaningful thought to pause, reflect, and move through the day with clarity.',
  thoughtLabel: "TODAY'S THOUGHT",
  thoughtText: 'A peaceful mind does not come from a perfect day, but from choosing calm in the middle of it.',
  reminderLabel: 'GENTLE REMINDER',
  reminderText: 'You do not need to solve the whole day at once. One honest step is enough.',
  footerText: 'A small daily pause for calm, clarity, and inspiration.',
  publishDate: '',
};

type DailyWondersSettings = typeof DEFAULT_DAILY_WONDERS;

function firstObject(...values: unknown[]) {
  return values.find((value) => value && typeof value === 'object') as Record<string, unknown> | undefined;
}

function extractDailyWondersSettings(input: unknown): DailyWondersSettings {
  const raw = input as any;
  const value = firstObject(
    raw?.settings?.published?.dailyWonders,
    raw?.settings?.dailyWonders,
    raw?.published?.dailyWonders,
    raw?.public?.dailyWonders,
    raw?.dailyWonders
  ) || {};

  return {
    ...DEFAULT_DAILY_WONDERS,
    ...value,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_DAILY_WONDERS.enabled,
    showOnHomepage: typeof value.showOnHomepage === 'boolean' ? value.showOnHomepage : DEFAULT_DAILY_WONDERS.showOnHomepage,
    smallLabel: typeof value.smallLabel === 'string' && value.smallLabel.trim() ? value.smallLabel : DEFAULT_DAILY_WONDERS.smallLabel,
    title: typeof value.title === 'string' && value.title.trim() ? value.title : DEFAULT_DAILY_WONDERS.title,
    subtitle: typeof value.subtitle === 'string' && value.subtitle.trim() ? value.subtitle : DEFAULT_DAILY_WONDERS.subtitle,
    thoughtLabel: typeof value.thoughtLabel === 'string' && value.thoughtLabel.trim() ? value.thoughtLabel : DEFAULT_DAILY_WONDERS.thoughtLabel,
    thoughtText: typeof value.thoughtText === 'string' && value.thoughtText.trim() ? value.thoughtText : DEFAULT_DAILY_WONDERS.thoughtText,
    reminderLabel: typeof value.reminderLabel === 'string' && value.reminderLabel.trim() ? value.reminderLabel : DEFAULT_DAILY_WONDERS.reminderLabel,
    reminderText: typeof value.reminderText === 'string' && value.reminderText.trim() ? value.reminderText : DEFAULT_DAILY_WONDERS.reminderText,
    footerText: typeof value.footerText === 'string' && value.footerText.trim() ? value.footerText : DEFAULT_DAILY_WONDERS.footerText,
    publishDate: typeof value.publishDate === 'string' ? value.publishDate : DEFAULT_DAILY_WONDERS.publishDate,
  };
}

const DailyWonderSlider: React.FC = () => {
  const [settings, setSettings] = useState<DailyWondersSettings>(DEFAULT_DAILY_WONDERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    settingsApi.getPublicSettings()
      .then((raw) => {
        if (alive) setSettings(extractDailyWondersSettings(raw));
      })
      .catch((error) => {
        console.error('Failed to load Daily Wonders settings:', error);
        if (alive) setSettings(DEFAULT_DAILY_WONDERS);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 h-6 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </section>
    );
  }

  if (!settings.enabled || !settings.showOnHomepage) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-slate-950 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-200">
          {settings.smallLabel}
        </div>
        {settings.publishDate ? (
          <time className="text-xs font-medium text-amber-700 dark:text-amber-200" dateTime={settings.publishDate}>
            {settings.publishDate}
          </time>
        ) : null}
      </div>

      <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{settings.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-amber-100">{settings.subtitle}</p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-white px-4 py-4 dark:border-amber-800 dark:bg-slate-950">
        <div className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-200">{settings.thoughtLabel}</div>
        <blockquote className="mt-2 text-lg font-medium leading-8 text-slate-900 dark:text-white">
          {settings.thoughtText}
        </blockquote>
      </div>

      <div className="mt-3 rounded-lg border border-amber-200 bg-white/70 px-4 py-3 dark:border-amber-800 dark:bg-slate-950/70">
        <div className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-200">{settings.reminderLabel}</div>
        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-amber-100">{settings.reminderText}</p>
      </div>

      <div className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-100">{settings.footerText}</div>
    </section>
  );
};

export default DailyWonderSlider;
