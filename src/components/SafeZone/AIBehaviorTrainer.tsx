import React, { useEffect, useState } from "react";
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';

type ActivityData = {
  autoPublished: number;
  flagged: number;
  suggestedHeadlines: number;
  lastTrustUpdate: string;
};

const AIBehaviorTrainer: React.FC = () => {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchJson<any>(`${API_BASE_PATH}/ai-behavior-log`, { timeoutMs: 15000 });

        // Accepts both { data: {...} } and just {...}
        const info: ActivityData =
          json.data && typeof json.data === "object" ? json.data : json;

        if (
          typeof info.autoPublished === "number" &&
          typeof info.flagged === "number" &&
          typeof info.suggestedHeadlines === "number" &&
          typeof info.lastTrustUpdate === "string"
        ) {
          if (isMounted) setData(info);
        } else {
          throw new Error("Invalid data shape");
        }
      } catch (err: any) {
  if (isMounted) setError("AIBehaviorTrainer Failed");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatDate = (dateStr: string) => {
    const parsed = Date.parse(dateStr);
    return isNaN(parsed) ? "Not available" : new Date(parsed).toLocaleString();
  };

  return (
    <section className="p-5 md:p-6 bg-violet-50 dark:bg-violet-950 border border-violet-400 dark:border-violet-600 rounded-2xl shadow max-h-[90vh] overflow-y-auto">
      {loading ? (
        <p className="text-sm text-slate-500">⏳ Loading AI Behavior Log...</p>
      ) : error || !data ? (
        <>
          <p className="text-red-500 font-mono text-sm mb-2">❌ AIBehaviorTrainer Failed</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Please check backend status or retry later.
          </p>
        </>
      ) : (
        <>
          <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-2">
            ✅ AIBehaviorTrainer Loaded
          </p>
          <h2 className="text-xl font-bold text-violet-700 dark:text-violet-300 mb-3">
            🤖 AI Behavior Log
          </h2>
          <ul className="text-slate-700 dark:text-slate-200 text-sm space-y-2 list-disc list-inside ml-2">
            <li>
              <strong>Auto-published:</strong> {data.autoPublished.toLocaleString()} stories today
            </li>
            <li>
              <strong>Flagged:</strong> {data.flagged.toLocaleString()} articles for review
            </li>
            <li>
              <strong>Suggestions:</strong> {data.suggestedHeadlines.toLocaleString()} trending headlines
            </li>
            <li>
              <strong>Last Trust Update:</strong> {formatDate(data.lastTrustUpdate)}
            </li>
          </ul>
        </>
      )}
    </section>
  );
};

export default AIBehaviorTrainer;
