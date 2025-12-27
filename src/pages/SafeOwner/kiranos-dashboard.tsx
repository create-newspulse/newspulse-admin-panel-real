// 📁 src/pages/SafeOwner/kiranos-dashboard.tsx

import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaRobot, FaChartPie, FaMagic, FaClipboardList } from 'react-icons/fa';
import { GiArtificialHive } from 'react-icons/gi';
import AuthenticatedLayout from '../../layouts/AuthenticatedLayout';

const KiranOSDashboard: React.FC = () => {
  return (
    <AuthenticatedLayout requiredRoles={["admin", "founder"]}>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gradient bg-gradient-to-r from-purple-500 to-indigo-600 text-transparent bg-clip-text mb-6 flex items-center gap-3">
          <GiArtificialHive className="text-4xl text-purple-600 animate-pulse" />
          KiranOS AI Manager
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 🧪 AI Playground */}
          <NavLink
            to="/admin-ai-test"
            className={({ isActive }) =>
              `bg-blue-100 hover:bg-blue-200 p-5 rounded-lg shadow flex items-center gap-4 ${
                isActive ? 'ring-2 ring-blue-400' : ''
              }`
            }
          >
            <FaMagic className="text-2xl text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold">AI Test Playground</h2>
              <p className="text-sm text-gray-600">Try summaries, headlines, and rewrites</p>
            </div>
          </NavLink>

          {/* 🧾 AI Logs */}
          <NavLink
            to="/admin-ai-logs"
            className={({ isActive }) =>
              `bg-green-100 hover:bg-green-200 p-5 rounded-lg shadow flex items-center gap-4 ${
                isActive ? 'ring-2 ring-green-400' : ''
              }`
            }
          >
            <FaClipboardList className="text-2xl text-green-600" />
            <div>
              <h2 className="text-lg font-semibold">AI Logs</h2>
              <p className="text-sm text-gray-600">View task history and usage records</p>
            </div>
          </NavLink>

          {/* 📈 Stats */}
          <NavLink
            to="/admin-ai-stats"
            className={({ isActive }) =>
              `bg-yellow-100 hover:bg-yellow-200 p-5 rounded-lg shadow flex items-center gap-4 ${
                isActive ? 'ring-2 ring-yellow-400' : ''
              }`
            }
          >
            <FaChartPie className="text-2xl text-yellow-600" />
            <div>
              <h2 className="text-lg font-semibold">AI Engine Stats</h2>
              <p className="text-sm text-gray-600">Track usage of GPT and Gemini over time</p>
            </div>
          </NavLink>

          {/* ⚙️ Raw Logs Link */}
          <a
            href={'/api/ai/logs/all'}
            target="_blank"
            className="bg-gray-100 hover:bg-gray-200 p-5 rounded-lg shadow flex items-center gap-4"
            rel="noreferrer"
          >
            <FaRobot className="text-2xl text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold">Raw Logs (JSON)</h2>
              <p className="text-sm text-gray-600">View raw log data in API format</p>
            </div>
          </a>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default KiranOSDashboard;
