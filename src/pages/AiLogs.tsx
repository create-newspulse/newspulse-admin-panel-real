// 📁 src/pages/AiLogs.tsx

import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';

export default function AiLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_PATH}/ai/logs`, { credentials: 'include' })
      .then(async (res) => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Expected JSON, got "${ct}". Body: ${txt.slice(0, 160)}`);
        }
        return res.json();
      })
      .then((data) => setLogs(data.logs || []))
      .catch(() => setLogs([]));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">📜 AI Logs</h2>
      <div className="space-y-2">
        {logs.map((log: any, index) => (
          <div key={index} className="bg-slate-800 p-3 rounded">
            <p className="text-sm">🧠 {log.tool}</p>
            <p className="text-xs text-gray-400">{log.timestamp}</p>
          </div>
        ))}
        {logs.length === 0 && <p className="text-gray-500">No logs yet.</p>}
      </div>
    </div>
  );
}
