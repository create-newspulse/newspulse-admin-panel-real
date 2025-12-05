import React, { useEffect, useState } from "react";
const API_ORIGIN = (
  import.meta.env.VITE_ADMIN_API_BASE_URL?.toString() ||
  import.meta.env.VITE_API_URL?.toString() ||
  (import.meta.env.MODE === 'development' ? 'http://localhost:10000' : 'https://newspulse-backend-real.onrender.com')
).replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;
import { FaHeartbeat, FaRobot, FaBolt, FaBrain } from "react-icons/fa";

interface AIStatus {
  system: string;
  status: "active" | "idle" | "error";
}

const AIGlowPanel: React.FC = () => {
  const [aiSystems, setAISystems] = useState<AIStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/ai-glow-status`, { credentials: 'include' });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}. Body: ${txt.slice(0, 160)}`);
        }
        if (!/application\/json/i.test(ct)) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Expected JSON, got ${ct}. Body: ${txt.slice(0, 160)}`);
        }
        const json = await res.json();

        if (isMounted && json.systems && Array.isArray(json.systems)) {
          setAISystems(json.systems);
        } else {
          throw new Error('Invalid API data format');
        }
      } catch (err) {
        if (isMounted) {
          setAISystems([]);
          setError("⚠️ Failed to load AI system status.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const statusColor: Record<AIStatus["status"], string> = {
    active: "text-green-400",
    idle: "text-yellow-300",
    error: "text-red-400",
  };

  return (
    <section className="relative p-6 bg-gradient-to-br from-purple-700/40 to-indigo-800/40 border border-purple-500/30 rounded-2xl shadow-xl transition hover:shadow-2xl hover:scale-[1.01] duration-300 text-white backdrop-blur-lg overflow-hidden">
      {/* Glowing pulse effect */}
      <div className="absolute -top-4 -left-4 w-32 h-32 bg-purple-500 blur-2xl opacity-20 animate-ping rounded-full pointer-events-none" />

      <h2 className="text-2xl font-bold mb-3 flex items-center gap-2 text-purple-100 drop-shadow">
        <FaRobot className="text-purple-300 animate-pulse" /> KiranOS AI Panel
      </h2>

      <p className="text-sm md:text-base text-purple-200 mb-4 flex items-center gap-2">
        <FaBolt className="text-yellow-300 animate-bounce" />
        Real-time snapshot of AI engines working inside News Pulse.
      </p>

      {loading ? (
        <p className="text-xs text-purple-300 animate-pulse flex items-center gap-2">
          <FaHeartbeat className="animate-spin text-pink-400" />
          Loading AI systems...
        </p>
      ) : error ? (
        <p className="text-xs text-red-400 flex items-center gap-2">{error}</p>
      ) : aiSystems.length === 0 ? (
        <p className="text-xs text-purple-300">No AI systems found.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {aiSystems.map((ai, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between text-purple-100 bg-white/5 px-3 py-2 rounded-lg shadow-inner border border-purple-500/10 hover:bg-purple-500/10 transition"
            >
              <span className="flex items-center gap-2">
                <FaBrain className="text-indigo-300" />
                {ai.system}
              </span>
              <span className={`font-mono ${statusColor[ai.status]} animate-pulse`}>
                ● {ai.status.toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default AIGlowPanel;
