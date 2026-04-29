import { useMemo } from 'react';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';

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

export default function DailyWondersSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();

  const dailyWonders = useMemo(() => {
    const value = (draft as any)?.dailyWonders || {};
    return {
      ...DEFAULT_DAILY_WONDERS,
      ...value,
      enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_DAILY_WONDERS.enabled,
      showOnHomepage: typeof value.showOnHomepage === 'boolean' ? value.showOnHomepage : DEFAULT_DAILY_WONDERS.showOnHomepage,
      smallLabel: typeof value.smallLabel === 'string' ? value.smallLabel : DEFAULT_DAILY_WONDERS.smallLabel,
      title: typeof value.title === 'string' ? value.title : DEFAULT_DAILY_WONDERS.title,
      subtitle: typeof value.subtitle === 'string' ? value.subtitle : DEFAULT_DAILY_WONDERS.subtitle,
      thoughtLabel: typeof value.thoughtLabel === 'string' ? value.thoughtLabel : DEFAULT_DAILY_WONDERS.thoughtLabel,
      thoughtText: typeof value.thoughtText === 'string' ? value.thoughtText : DEFAULT_DAILY_WONDERS.thoughtText,
      reminderLabel: typeof value.reminderLabel === 'string' ? value.reminderLabel : DEFAULT_DAILY_WONDERS.reminderLabel,
      reminderText: typeof value.reminderText === 'string' ? value.reminderText : DEFAULT_DAILY_WONDERS.reminderText,
      footerText: typeof value.footerText === 'string' ? value.footerText : DEFAULT_DAILY_WONDERS.footerText,
      publishDate: typeof value.publishDate === 'string' ? value.publishDate : DEFAULT_DAILY_WONDERS.publishDate,
    };
  }, [draft]);

  const patchDailyWonders = (patch: Partial<typeof DEFAULT_DAILY_WONDERS>) => {
    patchDraft({ dailyWonders: patch } as any);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Daily Wonders / Thought of the Day</div>
        <div className="mt-1 text-sm text-slate-600">Manage the standalone daily thought shown on the public homepage.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
          <div className="text-sm font-semibold text-slate-900">Visibility</div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Enable Daily Thought</div>
                <div className="text-xs text-slate-600">Master switch for this Daily Wonders thought block.</div>
              </div>
              <Switch
                checked={dailyWonders.enabled}
                onCheckedChange={(value) => patchDailyWonders({ enabled: value })}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Show on Homepage</div>
                <div className="text-xs text-slate-600">Display this daily thought on the public homepage.</div>
              </div>
              <Switch
                checked={dailyWonders.showOnHomepage}
                onCheckedChange={(value) => patchDailyWonders({ showOnHomepage: value })}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
          <div className="text-sm font-semibold text-slate-900">Daily Thought Content</div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold">Small Label</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.smallLabel}
                onChange={(event) => patchDailyWonders({ smallLabel: event.target.value })}
                placeholder="DAILY WONDERS"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold">Publish Date optional</div>
              <input
                type="date"
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.publishDate}
                onChange={(event) => patchDailyWonders({ publishDate: event.target.value })}
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Title</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.title}
                onChange={(event) => patchDailyWonders({ title: event.target.value })}
                placeholder="Thought of the Day"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Subtitle</div>
              <textarea
                rows={2}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.subtitle}
                onChange={(event) => patchDailyWonders({ subtitle: event.target.value })}
                placeholder="One meaningful thought to pause, reflect, and move through the day with clarity."
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Today's Thought Label</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.thoughtLabel}
                onChange={(event) => patchDailyWonders({ thoughtLabel: event.target.value })}
                placeholder="TODAY'S THOUGHT"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Today's Thought Text</div>
              <textarea
                rows={4}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.thoughtText}
                onChange={(event) => patchDailyWonders({ thoughtText: event.target.value })}
                placeholder="A peaceful mind does not come from a perfect day, but from choosing calm in the middle of it."
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Gentle Reminder Label</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.reminderLabel}
                onChange={(event) => patchDailyWonders({ reminderLabel: event.target.value })}
                placeholder="GENTLE REMINDER"
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Gentle Reminder Text</div>
              <textarea
                rows={3}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.reminderText}
                onChange={(event) => patchDailyWonders({ reminderText: event.target.value })}
                placeholder="You do not need to solve the whole day at once. One honest step is enough."
              />
            </label>

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
              <div className="text-sm font-semibold">Footer Text</div>
              <input
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={dailyWonders.footerText}
                onChange={(event) => patchDailyWonders({ footerText: event.target.value })}
                placeholder="A small daily pause for calm, clarity, and inspiration."
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
