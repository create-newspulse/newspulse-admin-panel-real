import { useEffect, useState } from 'react';
import axios from 'axios';
import { FaTrash } from 'react-icons/fa';
import moment from 'moment';

interface PushEntry {
  _id: string;
  title: string;
  category: string;
  score: number;
  type: 'auto' | 'manual';
  triggeredAt: string | Date | null;
}

export default function PushHistory() {
  const [data, setData] = useState<PushEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    try {
      const res = await axios.get<{ success: boolean; data: PushEntry[] }>('/api/push-history');
      setData(res.data.data || []);
    } catch (err) {
      console.error('❌ Failed to fetch push history:', err);
      setError('❌ Failed to fetch push history');
    } finally {
      setLoading(false);
    }
  };

  const deleteAll = async () => {
    if (!confirm('Are you sure you want to delete all push history?')) return;
    try {
      await axios.delete('/api/push-history');
      setData([]);
    } catch (err) {
      console.error('❌ Delete failed:', err);
      alert('❌ Failed to delete push history');
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">🔔 Push History</h2>
        <button
          onClick={deleteAll}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <FaTrash /> Delete All
        </button>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : data.length === 0 ? (
        <div className="text-gray-500">📭 No push history found.</div>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm table-auto">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr className="text-left">
                <th className="px-4 py-2">TITLE</th>
                <th className="px-4 py-2">CATEGORY</th>
                <th className="px-4 py-2">SCORE</th>
                <th className="px-4 py-2">TYPE</th>
                <th className="px-4 py-2">TIME</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item._id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-2">{item.title}</td>
                  <td className="px-4 py-2">{item.category || '—'}</td>
                  <td className="px-4 py-2">{item.score ?? 0}</td>
                  <td className="px-4 py-2 capitalize">{item.type}</td>
                  <td className="px-4 py-2">
                    {item.triggeredAt && moment(new Date(item.triggeredAt)).isValid()
                      ? moment(item.triggeredAt).format('DD MMM YYYY, hh:mm A')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
