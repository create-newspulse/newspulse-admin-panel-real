import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
// import { useAuth } from '../context/AuthContext'; // Optional if roles are implemented

interface AiLog {
  _id: string;
  taskType: string;
  input: string;
  output: string;
  engine: string;
  language: string;
  timestamp: string;
}

const AdminAiLogs: React.FC = () => {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // const { user } = useAuth();
  // if (user?.role !== 'admin' && user?.role !== 'founder') {
  //   return <p className="text-red-500 p-4">🔒 Access Denied</p>;
  // }

  const fetchLogs = () => {
    setLoading(true);
    fetch(`${API_BASE_PATH}/ai/logs/all`, { credentials: 'include' })
      .then(async (res) => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Expected JSON, got "${ct}". Body: ${txt.slice(0, 160)}`);
        }
        return res.json();
      })
      .then(data => {
        setLogs(data.logs || []);
        setFilteredLogs(data.logs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    const query = value.toLowerCase();
    const results = logs.filter(
      (log) =>
        log.taskType.toLowerCase().includes(query) ||
        log.language.toLowerCase().includes(query) ||
        log.engine.toLowerCase().includes(query)
    );
    setFilteredLogs(results);
  };

  const exportToCSV = () => {
    const csvHeader = 'Task,Language,Engine,Input,Output,Timestamp\n';
    const csvRows = filteredLogs
      .map((log) =>
        [
          log.taskType,
          log.language,
          log.engine,
          `"${log.input.replace(/"/g, '""')}"`,
          `"${log.output.replace(/"/g, '""')}"`,
          new Date(log.timestamp).toLocaleString(),
        ].join(',')
      )
      .join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AI_Logs_${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-blue-700">🧠 AI Logs Viewer</h1>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by task, lang, engine..."
            className="border p-2 rounded w-full md:w-72 text-sm"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm"
          >
            📤 Export CSV
          </button>
          <button
            onClick={fetchLogs}
            className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading logs...</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-gray-600">No logs found.</p>
      ) : (
        <div className="space-y-6">
          {filteredLogs.map((log) => (
            <div
              key={log._id}
              className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition"
            >
              <div className="text-xs text-gray-500 mb-2">
                📅 {new Date(log.timestamp).toLocaleString()} | 🛠 {log.taskType} | 🗣 {log.language} | ⚙️ {log.engine}
              </div>

              <div className="mb-3">
                <label className="block text-sm font-semibold mb-1">Input:</label>
                <pre className="bg-gray-100 text-xs p-2 rounded whitespace-pre-wrap">{log.input}</pre>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Output:</label>
                <pre className="bg-blue-50 text-xs p-2 rounded whitespace-pre-wrap">{log.output}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAiLogs;
