import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type StatsCardsProps = {
  totalNews: number;
  categoryCount: number;
  languageCount: number;
  trends?: {
    totalNews: number;
    category: number;
    language: number;
  };
  activeUsers: number;
  aiLogs: number;
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
  totalNews,
  categoryCount,
  languageCount,
  trends,
  activeUsers,
  aiLogs,
}: StatsCardsProps) {
  const navigate = useNavigate();

  const stats = [
    {
      label: '📰 Total News',
      value: totalNews,
      trend: trends?.totalNews ?? 0,
      link: '/manage-news',
    },
    {
      label: '📂 Categories',
      value: categoryCount,
      trend: trends?.category ?? 0,
      link: '/add-category',
    },
    {
      label: '🌐 Languages',
      value: languageCount,
      trend: trends?.language ?? 0,
      link: '/language-settings',
    },
    {
      label: '👥 Active Users',
      value: activeUsers,
      trend: 0,
      link: '/admin-users',
    },
    {
      label: '🧠 AI Logs',
      value: aiLogs,
      trend: 0,
      link: '/ai-logs',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {stats.map((item, i) => (
        <div
          key={i}
          onClick={() => navigate(item.link)}
          className="cursor-pointer rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow hover:shadow-lg transition hover:scale-[1.02] min-h-[120px]"
        >
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">
            {item.label}
          </div>
          <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mb-1">
            <CountUp target={item.value} />
          </div>
          <div
            className={`text-xs font-semibold ${
              item.trend > 0
                ? 'text-green-500'
                : item.trend < 0
                ? 'text-red-500'
                : 'text-gray-400'
            }`}
          >
            {item.trend > 0 && `↑ ${item.trend}%`}
            {item.trend < 0 && `↓ ${Math.abs(item.trend)}%`}
            {item.trend === 0 && '—'}
          </div>
        </div>
      ))}
    </div>
  );
}
