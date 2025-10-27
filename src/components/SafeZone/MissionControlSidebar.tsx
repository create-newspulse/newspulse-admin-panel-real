import { useState, useEffect } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import {
  FaBrain, FaTrafficLight, FaMoneyBill, FaHeartbeat, FaTools,
  FaExclamationTriangle, FaLock, FaRedoAlt, FaChevronDown, FaChevronUp
} from 'react-icons/fa';

type SidebarProps = {
  onExportSettings: () => void;
  onBackupSite: () => void;
  onRestoreBackup: () => void;
};

export default function MissionControlSidebar({
  onExportSettings,
  onBackupSite,
  onRestoreBackup,
}: SidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'ok' | 'fail' | null>(null);
  const [lastCheck, setLastCheck] = useState<string>("");

  useEffect(() => {
    fetchJson<{ status?: string }>(`${API_BASE_PATH}/system/constitution-status`)
      .then((data) => {
        setSyncStatus(data.status === 'ok' ? 'ok' : 'fail');
        setLastCheck(new Date().toLocaleTimeString());
      })
      .catch(() => {
        setSyncStatus('fail');
        setLastCheck(new Date().toLocaleTimeString());
      });
  }, []);

  const toggleSection = (key: string) => {
    setExpanded(prev => (prev === key ? null : key));
  };

  const panels = [
    {
      id: 'ai',
      icon: <FaBrain />,
      title: 'AI Status',
      content: (
        <>
          <p className="text-green-300 text-sm mb-1">Auto-Mode Active</p>
          <ul className="list-disc pl-5 text-xs space-y-0.5">
            <li>Summarizer <span className="text-green-400">✅</span></li>
            <li>Fact Checker <span className="text-green-400">✅</span></li>
            <li>AI Voice <span className="text-green-400">✅</span></li>
          </ul>
        </>
      )
    },
    {
      id: 'traffic',
      icon: <FaTrafficLight />,
      title: 'Traffic',
      content: (
        <>
          <p className="text-sm">🟢 <span className="font-medium">183</span> live users</p>
          <p className="text-xs text-muted">Top page: <strong>Youth Pulse Zone</strong></p>
        </>
      )
    },
    {
      id: 'revenue',
      icon: <FaMoneyBill />,
      title: "Today's Revenue",
      content: (
        <>
          <p className="text-yellow-300 text-sm font-semibold">₹1,920.00</p>
          <p className="text-xs text-muted">AdSense + Affiliates</p>
        </>
      )
    },
    {
      id: 'health',
      icon: <FaHeartbeat />,
      title: 'System Health',
      content: (
        <ul className="text-xs pl-4 list-disc">
          <li>DB: <span className="text-green-400">✅</span></li>
          <li>Voice Engine: <span className="text-green-400">✅</span></li>
          <li>News Crawler: <span className="text-green-400">✅</span></li>
        </ul>
      )
    },
    {
      id: 'tools',
      icon: <FaTools />,
      title: 'Quick Tools',
      content: (
        <div className="text-xs space-y-2">
          <button onClick={onExportSettings} className="text-blue-300 hover:underline">
            📤 Export Settings PDF
          </button><br />
          <button onClick={onBackupSite} className="text-blue-300 hover:underline">
            💾 Backup Site Now
          </button><br />
          <button onClick={onRestoreBackup} className="text-blue-300 hover:underline">
            <FaRedoAlt className="inline mr-1" /> Restore Backup
          </button>
        </div>
      )
    },
    {
      id: 'alerts',
      icon: <FaExclamationTriangle />,
      title: 'Alerts',
      content: (
        <p className="text-xs text-red-300">
          ⚠️ 3 flagged stories<br />
          ⚠️ 1 missing backup
        </p>
      )
    },
    {
      id: 'lock',
      icon: <FaLock />,
      title: 'Founder Lock',
      content: (
        <p className="text-xs text-orange-300">
          🛡️ Emergency Lock: <span className="text-green-400 font-semibold">OFF</span>
        </p>
      )
    },
    {
      id: 'constitution',
      icon: <FaLock />,
      title: 'Constitution Status',
      content: (
        <div className="text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${
              syncStatus === 'ok' ? 'text-green-400' : 'text-red-400'
            }`}>
              {syncStatus === 'ok' ? '🟢 Verified' : '🔴 Not Synced'}
            </span>
            <span className="text-[10px] text-gray-400">Status from KiranOS</span>
          </div>
          <p className="text-blue-300 text-sm">
            <a href="/admin/control-constitution" className="hover:underline">
              🔎 View Constitution Page
            </a>
          </p>
          <p className="text-[10px] text-gray-500 italic">
            Last Check: {lastCheck}
          </p>
        </div>
      )
    }
  ];

  return (
    <aside className="w-full md:w-72 bg-slate-800 text-white rounded-xl p-4 space-y-4 shadow-2xl sticky top-4 h-fit">
      <h2 className="text-2xl font-bold mb-3 flex items-center gap-2 text-white z-10 relative">
        Mission Control
      </h2>

      {panels.map(({ id, icon, title, content }) => (
        <div key={id} className="bg-slate-700 p-3 rounded-lg">
          <div
            className="font-semibold flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection(id)}
            title={`Toggle ${title}`}
          >
            <span className="flex items-center gap-2">{icon} {title}</span>
            {expanded === id ? <FaChevronUp /> : <FaChevronDown />}
          </div>
          {expanded === id && (
            <div className="mt-2 text-slate-100">
              {content}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
