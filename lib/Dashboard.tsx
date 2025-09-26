import { useEffect, useState } from 'react';
import api from '../lib/api';

interface NewsStat {
  _id: string;
  count: number;
}

export default function Dashboard() {
  const [total, setTotal] = useState(0);
  const [byCategory, setByCategory] = useState<NewsStat[]>([]);
  const [byLanguage, setByLanguage] = useState<NewsStat[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard-stats');
        if (res.data.success) {
          setTotal(res.data.total);
          setByCategory(res.data.byCategory);
          setByLanguage(res.data.byLanguage);
          setRecent(res.data.recent);
          console.log('✅ Dashboard stats loaded:', res.data);
        }
      } catch (err) {
        console.error('❌ Failed to fetch dashboard stats', err);
      }
    };

    fetchStats();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>📊 Dashboard Overview</h2>
      <p><strong>Total News:</strong> {total}</p>

      <h3>By Category</h3>
      <ul>
        {byCategory.map((item) => (
          <li key={item._id}>{item._id}: {item.count}</li>
        ))}
      </ul>

      <h3>By Language</h3>
      <ul>
        {byLanguage.map((item) => (
          <li key={item._id}>{item._id}: {item.count}</li>
        ))}
      </ul>

      <h3>🕘 Latest News</h3>
      <ul>
        {recent.map((news, idx) => (
          <li key={idx}>
            <strong>{news.title}</strong> — {new Date(news.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
