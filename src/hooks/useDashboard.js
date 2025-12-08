import { useEffect, useState } from 'react';
import { api } from '../lib/api';
export function useDashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totals, setTotals] = useState({ news: 0, categories: 0, languages: 0, users: 0 });
    const [aiLogs, setAiLogs] = useState(0);
    const [weekly, setWeekly] = useState({ suggestedStories: 0, top: { title: '', reads: 0, engagement: 0 } });
    const [series, setSeries] = useState([]);
    useEffect(() => {
        (async () => {
            try {
                const [s, w, t] = await Promise.all([api.stats(), api.weekly(), api.traffic()]);
                setTotals(s.totals);
                setAiLogs(s.aiLogs);
                setWeekly({ suggestedStories: w.summary.suggestedStories, top: w.top });
                setSeries(t.series);
            }
            catch (e) {
                setError(e.message || 'Failed to load');
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    return { loading, error, totals, aiLogs, weekly, series };
}
