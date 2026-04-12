import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type DashboardStatsValues = {
  totalNewsRecords: number;
  publishedNews: number;
  draftNews: number;
  archivedNews: number;
  latestPublicVisible: number;
  configuredCategoriesCount: number;
  activeCategoriesInUseCount: number;
};

type StatsCardsProps = {
  state: 'loading' | 'ready' | 'disabled';
  values?: DashboardStatsValues;
  errorText?: string;
};

const CountUp = ({ target }: { target: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let current = 0;
    const step = Math.ceil(target / 50);
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(current);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [target]);

  return <>{count}</>;
};

export default function StatsCards({
  state,
  values,
  errorText,
}: StatsCardsProps) {
  const navigate = useNavigate();

  const cards = useMemo(() => {
    const v = values;
    const readyVals: DashboardStatsValues = v || {
      totalNewsRecords: 0,
      publishedNews: 0,
      draftNews: 0,
      archivedNews: 0,
      latestPublicVisible: 0,
      configuredCategoriesCount: 0,
      activeCategoriesInUseCount: 0,
    };

    const helperText = (value: number, whenPositive: string, whenZero: string) => (value > 0 ? whenPositive : whenZero);

    return [
      {
        key: 'totalNewsRecords',
        label: 'Total News Records',
        value: readyVals.totalNewsRecords,
        helperText: helperText(readyVals.totalNewsRecords, 'All statuses in admin records', 'No news records yet'),
        link: '/admin/articles',
      },
      {
        key: 'publishedNews',
        label: 'Published News',
        value: readyVals.publishedNews,
        helperText: helperText(readyVals.publishedNews, 'Published/article-live scope', 'No published records'),
        link: '/admin/articles',
      },
      {
        key: 'draftNews',
        label: 'Draft News',
        value: readyVals.draftNews,
        helperText: helperText(readyVals.draftNews, 'Draft/editorial scope', 'No draft records'),
        link: '/draft-desk',
      },
      {
        key: 'archivedNews',
        label: 'Archived News',
        value: readyVals.archivedNews,
        helperText: helperText(readyVals.archivedNews, 'Archived admin records', 'No archived records'),
        link: '/admin/articles',
      },
      {
        key: 'latestPublicVisible',
        label: 'Latest/Public Visible',
        value: readyVals.latestPublicVisible,
        helperText: helperText(readyVals.latestPublicVisible, 'Public-facing published scope', 'No public-facing records'),
        link: '/admin/articles',
      },
      {
        key: 'configuredCategoriesCount',
        label: 'Configured Categories',
        value: readyVals.configuredCategoriesCount,
        helperText: helperText(readyVals.configuredCategoriesCount, 'Category registry', 'No configured categories'),
        link: '/add-category',
      },
      {
        key: 'activeCategoriesInUseCount',
        label: 'Active Categories in Use',
        value: readyVals.activeCategoriesInUseCount,
        helperText: helperText(readyVals.activeCategoriesInUseCount, 'Seen in article records', 'No categories used yet'),
        link: '/admin/articles',
      },
    ];
  }, [values]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((item) => (
        <div
          key={item.key}
          onClick={() => {
            if (state !== 'ready') return;
            navigate(item.link);
          }}
          className={
            state === 'ready'
              ? 'cursor-pointer rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow hover:shadow-lg transition hover:scale-[1.02] min-h-[120px]'
              : 'cursor-not-allowed rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow min-h-[120px] opacity-70'
          }
        >
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">
            {item.label}
          </div>

          {state === 'loading' ? (
            <>
              <div className="mt-1 h-10 w-24 rounded bg-gray-200 dark:bg-slate-700 animate-pulse" />
              <div className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">…</div>
            </>
          ) : state === 'disabled' ? (
            <>
              <div className="text-4xl font-extrabold text-gray-400 dark:text-gray-500 mb-1">—</div>
              <div className="text-xs font-semibold text-gray-400">{errorText || 'Failed to load stats'}</div>
            </>
          ) : (
            <>
              <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mb-1">
                <CountUp target={item.value} />
              </div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.helperText}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
