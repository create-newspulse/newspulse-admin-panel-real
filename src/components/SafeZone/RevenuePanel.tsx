import { useEffect, useState } from 'react';
import { api } from '@lib/api';

type RevenueData = {
  adsense: number;
  affiliates: number;
  sponsors: number;
  total: number;
  lastUpdated: string | null;
};

const RevenuePanel = () => {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.revenue()
      .then((resData: any) => {
        // Defensive: Check for required fields, not error object
        if (
          typeof resData.adsense === "number" &&
          typeof resData.affiliates === "number" &&
          typeof resData.sponsors === "number" &&
          typeof resData.total === "number"
        ) {
          setData(resData);
        } else if (resData.error) {
          setError(resData.error);
        } else {
          setError("Invalid revenue data format.");
        }
        setLoading(false);
      })
      .catch((err: any) => {
        setError("Failed to load revenue data: " + err.message);
        setLoading(false);
      });
  }, []);

  const isEmpty =
    data?.adsense === 0 && data?.affiliates === 0 && data?.sponsors === 0;

  return (
    <section className="p-5 md:p-6 bg-lime-50 dark:bg-lime-900/10 border border-lime-300 dark:border-lime-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <p className="text-green-600 dark:text-green-400 font-mono text-sm">
          ✅ RevenuePanel Loaded
        </p>
        <a
          href={api.revenueExportPdfPath()}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          📄 Export PDF
        </a>
      </div>

      <h2 className="text-xl font-bold text-lime-700 dark:text-lime-300 mb-2">
        💰 Revenue Panel
      </h2>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">⏳ Loading revenue data...</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : isEmpty ? (
        <p className="text-sm text-yellow-600 dark:text-yellow-300">
          ⚠️ Revenue data will appear after the site goes live.
        </p>
      ) : (
        <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-1">
          <li>• Google AdSense: ₹{data?.adsense?.toLocaleString?.() ?? 0} (This Month)</li>
          <li>• Affiliates: ₹{data?.affiliates?.toLocaleString?.() ?? 0}</li>
          <li>• Sponsors: ₹{data?.sponsors?.toLocaleString?.() ?? 0}</li>
          <li className="font-semibold mt-2">
            • Total Revenue: ₹{data?.total?.toLocaleString?.() ?? 0}
          </li>
        </ul>
      )}

      {data?.lastUpdated && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          Last updated {data.lastUpdated}
        </p>
      )}
    </section>
  );
};

export default RevenuePanel;
