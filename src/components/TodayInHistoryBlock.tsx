import React, { useEffect, useState } from 'react';
import { adminJson } from '@/lib/http/adminFetch';

interface HistoryEntry {
  year: string;
  event: string;
}

const TodayInHistoryBlock: React.FC = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminJson<any>('/today-history', { method: 'GET' });
        if (res?.success) setEntries(res.data);
      } catch (err) {
        console.error('❌ Failed to load history:', err);
      }
    })();
  }, []);

  if (!entries.length) return null;

  return (
    <div className="bg-blue-100 dark:bg-blue-900 text-black dark:text-white p-4 rounded-xl shadow mb-6">
      <h3 className="font-bold text-lg mb-2">📜 Today in History</h3>
      <ul className="list-disc pl-5 space-y-1">
        {entries.map((item, idx) => (
          <li key={idx}>
            <span className="font-semibold">{item.year}:</span> {item.event}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodayInHistoryBlock;
