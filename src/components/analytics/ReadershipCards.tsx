import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDurationShort, formatNumberCompact } from '@/lib/formatDuration';

export type ReadershipSummary = {
  views: number;
  readers: number;
  engagedReads: number;
  avgReadTimeSec: number;
  topSourceLabel: string;
  topSourceViews?: number;
  languageSummaryLabel: string;
  languageSummaryDetail?: string;
};

type Props = {
  state: 'loading' | 'ready' | 'error' | 'empty';
  summary?: ReadershipSummary;
  errorText?: string;
  onOpenAnalyticsPath?: string;
};

function CardShell(
  {
    label,
    value,
    helper,
    state,
    onClick,
  }: {
    label: string;
    value: React.ReactNode;
    helper?: React.ReactNode;
    state: 'loading' | 'ready' | 'disabled';
    onClick?: () => void;
  },
) {
  return (
    <div
      role={onClick && state === 'ready' ? 'button' : undefined}
      tabIndex={onClick && state === 'ready' ? 0 : undefined}
      onClick={() => {
        if (state !== 'ready') return;
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (state !== 'ready') return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={
        'rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm min-h-[110px] '
        + (state === 'ready' && onClick ? 'cursor-pointer hover:shadow transition' : 'cursor-default')
        + (state !== 'ready' ? ' opacity-80' : '')
      }
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-3xl font-extrabold text-slate-800 dark:text-white">{value}</div>
      {helper ? <div className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{helper}</div> : null}
    </div>
  );
}

export function ReadershipCards({ state, summary, errorText, onOpenAnalyticsPath = '/admin/analytics/articles' }: Props) {
  const navigate = useNavigate();

  if (state === 'error') {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-5">
        <div className="text-sm font-semibold text-red-800 dark:text-red-200">Readership analytics unavailable</div>
        <div className="mt-1 text-xs text-red-700/90 dark:text-red-200/80">{errorText || 'Failed to load analytics.'}</div>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">No analytics yet</div>
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Traffic data will appear once readers start viewing articles.</div>
      </div>
    );
  }

  const ready = state === 'ready' && summary;
  const s = summary;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {CardShell({
        label: 'Views',
        value: state === 'loading' ? '…' : ready ? formatNumberCompact(s!.views) : '—',
        helper: 'Total views',
        state: state === 'loading' ? 'disabled' : ready ? 'ready' : 'disabled',
        onClick: () => navigate(onOpenAnalyticsPath),
      })}

      {CardShell({
        label: 'Readers',
        value: state === 'loading' ? '…' : ready ? formatNumberCompact(s!.readers) : '—',
        helper: 'Unique readers',
        state: state === 'loading' ? 'disabled' : ready ? 'ready' : 'disabled',
        onClick: () => navigate(onOpenAnalyticsPath),
      })}

      {CardShell({
        label: 'Engaged',
        value: state === 'loading' ? '…' : ready ? formatNumberCompact(s!.engagedReads) : '—',
        helper: 'Engaged reads',
        state: state === 'loading' ? 'disabled' : ready ? 'ready' : 'disabled',
        onClick: () => navigate(onOpenAnalyticsPath),
      })}

      {CardShell({
        label: 'Avg Read',
        value: state === 'loading' ? '…' : ready ? formatDurationShort(s!.avgReadTimeSec) : '—',
        helper: 'Average read time',
        state: state === 'loading' ? 'disabled' : ready ? 'ready' : 'disabled',
        onClick: () => navigate(onOpenAnalyticsPath),
      })}

      {CardShell({
        label: 'Top Source',
        value: state === 'loading' ? '…' : ready ? (s!.topSourceLabel || '—') : '—',
        helper: ready && typeof s!.topSourceViews === 'number' ? `${formatNumberCompact(s!.topSourceViews)} views` : 'Highest-traffic channel',
        state: state === 'loading' ? 'disabled' : ready ? 'ready' : 'disabled',
        onClick: () => navigate(onOpenAnalyticsPath),
      })}

      {CardShell({
        label: 'Languages',
        value: state === 'loading' ? '…' : ready ? (s!.languageSummaryLabel || '—') : '—',
        helper: ready ? (s!.languageSummaryDetail || 'Detected from readership traffic') : undefined,
        state: state === 'loading' ? 'disabled' : ready ? 'ready' : 'disabled',
        onClick: () => navigate(onOpenAnalyticsPath),
      })}
    </div>
  );
}
