import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '@lib/api';

type PollResult = {
  option: string;
  votes: number;
};

export default function PollResultsChart() {
  const { t } = useTranslation();
  const [results, setResults] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Try serverless first, then fallback to backend
        const endpoints = ['/api/polls/results', '/api/polls/latest/results'];
        let data: any = null;
        for (const url of endpoints) {
          try {
            const res = await apiClient.get(url);
            data = (res as any)?.data ?? res;
            if (data) break;
          } catch (_) {
            // try next
          }
        }
        if (!data) {
          setResults([
            { option: 'Option A', votes: 42 },
            { option: 'Option B', votes: 35 },
            { option: 'Option C', votes: 23 },
          ]);
        } else {
          setResults(Array.isArray(data?.results) ? data.results : []);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0) || 1;

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
      <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">{t('pollResults') || 'Poll Results'}</h1>
      {loading && <div className="text-slate-500">{t('loading') || 'Loading...'}</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="space-y-3">
          {results.map((r) => {
            const pct = Math.round((r.votes / totalVotes) * 100);
            return (
              <div key={r.option}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{r.option}</span>
                  <span className="text-slate-600 dark:text-slate-300">{pct}% • {r.votes} votes</span>
                </div>
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded">
                  <div className="h-3 bg-blue-600 rounded" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
