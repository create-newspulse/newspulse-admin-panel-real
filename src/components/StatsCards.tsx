import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type DashboardStatsValues = {
  totalNews: number;
  categoriesCount: number;
  languagesCount: number;
  activeUsersCount: number;
  aiLogsCount: number;
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
      totalNews: 0,
      categoriesCount: 0,
      languagesCount: 0,
      activeUsersCount: 0,
      aiLogsCount: 0,
    };

    const helperText = (value: number, whenPositive: string, whenZero: string) => (value > 0 ? whenPositive : whenZero);

    return [
      {
        key: 'totalNews',
        label: 'Total News',
        value: readyVals.totalNews,
        helperText: helperText(readyVals.totalNews, 'All time', 'No news yet'),
        link: '/admin/articles',
      },
      {
        key: 'categoriesCount',
        label: 'Categories',
        value: readyVals.categoriesCount,
        helperText: helperText(readyVals.categoriesCount, 'Configured', 'No categories configured'),
        link: '/admin/settings/public-site/homepage#categories',
      },
      {
        key: 'languagesCount',
        label: 'Languages',
        value: readyVals.languagesCount,
        helperText: helperText(readyVals.languagesCount, 'Detected', 'No language data yet'),
        link: '/safe-owner/language-settings',
      },
      {
        key: 'activeUsersCount',
        label: 'Active Users',
        value: readyVals.activeUsersCount,
        helperText: helperText(readyVals.activeUsersCount, 'Currently active', 'No active users'),
        link: '/admin/users',
      },
      {
        key: 'aiLogsCount',
        label: 'AI Logs',
        value: readyVals.aiLogsCount,
        helperText: helperText(readyVals.aiLogsCount, 'Recorded', 'No AI activity recorded'),
        link: '/admin/ai-logs',
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
