// src/pages/SecurePanel.tsx

import { useEffect, useState } from 'react';
import { apiFetch } from '@utils/apiFetch';
import ErrorDisplay from '@components/ErrorDisplay';

export default function SecurePanel() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch('/api/system/secure-data');
      setData(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="font-bold text-2xl mb-4">🔒 Secure Data Panel</h2>
      <button onClick={fetchData} disabled={loading} className="mb-3 px-4 py-2 bg-blue-600 text-white rounded">
        Refresh
      </button>
      <ErrorDisplay error={error} />
      <div className="mt-4 bg-slate-100 rounded p-3">
        {loading ? "Loading..." : data ? (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        ) : "No data."}
      </div>
    </div>
  );
}
