import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  lazy,
  Suspense,
  type ReactNode,
  type ComponentType,
  type LazyExoticComponent,
} from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import debounce from "lodash.debounce";
import {
  FaFilePdf, FaSun, FaMoon, FaThumbtack,
  FaSyncAlt, FaCog, FaFilter, FaChartLine, FaHistory,
  FaKey, FaClipboardCheck, FaLock, FaLockOpen, FaCodeBranch, FaComments,
  FaShieldAlt, FaExclamationTriangle, FaFileInvoiceDollar, FaRobot, FaBrain,
  FaLightbulb, FaGlobeAmericas, FaBug, FaEye, FaRadiationAlt, FaSearch
} from "react-icons/fa";

import KiranOSPanel from "../../panels/KiranOSPanel";
import AITrainer from "../../panels/AITrainer";
import LiveNewsPollsPanel from "../../components/SafeZone/LiveNewsPollsPanel";

interface PanelItem {
  key: string;
  icon: ReactNode; // ⬅️ no JSX namespace
  Component?: LazyExoticComponent<ComponentType>;
}

const panels: PanelItem[] = [
  { key: "FounderControlPanel", icon: <FaCog /> },
  { key: "SystemHealthPanel", icon: <FaSyncAlt /> },
  { key: "AIActivityLog", icon: <FaSearch /> },
  { key: "TrafficAnalytics", icon: <FaFilter /> },
  { key: "RevenuePanel", icon: <FaChartLine /> },
  { key: "BackupAndRecovery", icon: <FaHistory /> },
  { key: "LoginRecordTracker", icon: <FaKey /> },
  { key: "ComplianceAuditPanel", icon: <FaClipboardCheck /> },
  { key: "AutoLockdownSwitch", icon: <FaLock /> },
  { key: "APIKeyVault", icon: <FaLockOpen /> },
  { key: "SystemVersionControl", icon: <FaCodeBranch /> },
  { key: "AdminChatAudit", icon: <FaComments /> },
  { key: "GuardianRulesEngine", icon: <FaShieldAlt /> },
  { key: "IncidentResponseModule", icon: <FaExclamationTriangle /> },
  { key: "SecureFileVault", icon: <FaFileInvoiceDollar /> },
  { key: "EarningsForecastAI", icon: <FaRobot /> },
  { key: "AIBehaviorTrainer", icon: <FaBrain /> },
  { key: "GlobalThreatScanner", icon: <FaGlobeAmericas /> },
  { key: "BugReportAnalyzer", icon: <FaBug /> },
  { key: "ThreatDashboard", icon: <FaRadiationAlt /> },
  { key: "SmartAlertSystem", icon: <FaLightbulb /> },
  { key: "MonitorHubPanel", icon: <FaEye /> }
];

// Typed glob so lazy() is happy
const moduleMap = import.meta.glob<{ default: ComponentType }>("../../components/SafeZone/*.tsx");
panels.forEach((p) => {
  const path = `../../components/SafeZone/${p.key}.tsx`;
  if (moduleMap[path]) p.Component = lazy(moduleMap[path]);
});

const SafeOwnerZone: React.FC = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem("darkMode") === "true");
  const [pinned, setPinned] = useState<string[]>([]);
  const [aiStatus, setAIStatus] = useState<string>("");

  // Debounced search with cleanup
  const debouncedSetSearch = useCallback(debounce((v: string) => setSearch(v), 300), []);
  useEffect(() => () => debouncedSetSearch.cancel(), [debouncedSetSearch]);

  const togglePin = (key: string) => {
    setPinned((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const filtered = useMemo(() => {
    const list = search
      ? panels.filter((p) => p.key.toLowerCase().includes(search.toLowerCase()))
      : panels;
    const pinnedList = list.filter((p) => pinned.includes(p.key));
    const unpinnedList = list.filter((p) => !pinned.includes(p.key));
    return [...pinnedList, ...unpinnedList];
  }, [search, pinned]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("darkMode", isDark ? "true" : "false");
  }, [isDark]);

  useEffect(() => {
    fetch("/api/system/ai-training-info")
      .then((res) => res.json())
      .then((data) => setAIStatus(data?.data?.status || data?.status || "Inactive"))
      .catch(() => setAIStatus("Inactive"));
  }, []);

  // Dynamic html2pdf import on demand
  const exportPDF = async () => {
    const el = document.getElementById("safezone-root");
    if (!el) return;
    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf().set({
      filename: "SafeOwnerZone_Report.pdf",
      margin: 0.5,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
    }).from(el).save();
  };

  const exportAIPDF = async () => {
    const el = document.getElementById("ai-glow-panels");
    if (!el) return;
    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf().set({
      filename: "AI_Glow_Panels_Report.pdf",
      margin: 0.5,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
    }).from(el).save();
  };

  return (
    <main
      id="safezone-root"
      className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-8 space-y-6"
    >
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <FaShieldAlt /> Safe Owner Zone v4.5+ Monitor Core
        </h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search tools..."
            onChange={(e) => debouncedSetSearch(e.target.value)}
            className="px-3 py-2 rounded border dark:bg-slate-700 text-black dark:text-white"
          />
          <button onClick={exportPDF} className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700">
            <FaFilePdf className="inline mr-1" /> Export PDF
          </button>
          <button onClick={exportAIPDF} className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700">
            ⚡ Export AI Report
          </button>
          <button
            onClick={() => setIsDark((d) => !d)}
            className="bg-slate-700 text-white px-3 py-2 rounded hover:bg-slate-600"
          >
            {isDark ? <FaSun className="inline" /> : <FaMoon className="inline" />} {isDark ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      <section id="ai-glow-panels" className="grid gap-6 md:grid-cols-2 xl:grid-cols-2 mt-8">
        <div className="relative">
          <KiranOSPanel />
        </div>
        <div className="relative">
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-1 text-xs rounded font-semibold ${aiStatus === "Active" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
              {aiStatus === "Active" ? "🟢 Active" : "🔴 Inactive"}
            </span>
          </div>
          <AITrainer />
        </div>
      </section>

      <section className="mt-8">
        <LiveNewsPollsPanel />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-8">
        {filtered.map(({ key, Component, icon }, index) => (
          <motion.section
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="ai-card glow-panel ai-highlight hover-glow"
          >
            <div className="flex justify-between items-center px-4 py-2 border-b dark:border-slate-600 bg-slate-100 dark:bg-slate-700 rounded-t-xl">
              <h2 className="ai-title flex items-center gap-2">
                {icon} {t(`safeZone.${key}`) || key.replace(/([a-z])([A-Z])/g, "$1 $2")}
              </h2>
              <button onClick={() => togglePin(key)} title="Pin/Unpin Panel">
                {pinned.includes(key) ? <FaThumbtack className="text-yellow-400" /> : <FaThumbtack className="opacity-30" />}
              </button>
            </div>
            <div className="p-4 ai-desc">
              <Suspense fallback={<div className="text-slate-500 dark:text-slate-300">Loading...</div>}>
                {Component ? <Component /> : <div className="text-red-500">⚠️ Component missing</div>}
              </Suspense>
            </div>
          </motion.section>
        ))}
      </div>
    </main>
  );
};

export default SafeOwnerZone;
