import React, { useEffect, useState } from "react";
import { api } from '@lib/api';

type ActivityData = {
  autoPublished: number;
  flagged: number;
  suggestedHeadlines: number;
  lastTrustUpdate: string;
};

const AIActivityLog: React.FC = () => {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const json = await api.aiActivityLog() as any;

        // Accepts both { success: true, data: { ... } } and { ...fields }
        const activity: ActivityData =
          json?.data && typeof json.data === "object"
            ? json.data
            : json;

        if (
          typeof activity.autoPublished === "number" &&
          typeof activity.flagged === "number" &&
          typeof activity.suggestedHeadlines === "number" &&
          typeof activity.lastTrustUpdate === "string"
        ) {
          if (isMounted) setData(activity);
        } else {
          throw new Error("Invalid data shape");
        }
      } catch (err: any) {
        if (isMounted)
          setError("⚠️ Failed to load real AI activity data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="p-5 md:p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-300 dark:border-purple-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-2">
        ✅ AIActivityLog Loaded
      </p>
      <h2 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-3">
        🧠 AI Activity Log
      </h2>

      {loading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          ⏳ Loading real AI activity data...
        </div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : data ? (
        <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-200 list-disc list-inside ml-2">
          <li>
            <strong>Auto-published:</strong>{" "}
            {data.autoPublished.toLocaleString()} stories today
          </li>
          <li>
            <strong>Flagged:</strong>{" "}
            {data.flagged.toLocaleString()} articles for review
          </li>
          <li>
            <strong>Suggestions:</strong>{" "}
            {data.suggestedHeadlines.toLocaleString()} trending headlines
          </li>
          <li>
            <strong>Last Trust Update:</strong> {data.lastTrustUpdate}
          </li>
        </ul>
      ) : (
        <div className="text-sm text-gray-400 dark:text-gray-500">
          No activity data available yet.
        </div>
      )}
    </section>
  );
};

export default AIActivityLog;
