import { useEffect, useState } from 'react';
import { useStats } from '@/store/stats';
import { motion } from 'framer-motion';

export default function QuickCards() {
  const { stats } = useStats();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500); // simple shimmer delay
    return () => clearTimeout(t);
  }, []);

  const items = [
    { k: 'totalArticles', label: 'Total Articles' },
    { k: 'pendingArticles', label: 'Pending Reviews' },
    { k: 'activePolls', label: 'Active Polls' },
    { k: 'traffic24h', label: 'Traffic (24h)' },
    { k: 'flags', label: 'Flagged Content' },
  ] as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((it, idx) => (
        <motion.div key={it.k}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="rounded-lg border dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
        >
          <div className="text-xs opacity-70 mb-2">{it.label}</div>
          {loading ? (
            <div className="h-7 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          ) : (
            <div className="text-2xl font-semibold">{(stats as any)[it.k] ?? 0}</div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
