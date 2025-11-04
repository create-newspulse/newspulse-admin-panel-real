import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FounderProfileCard from '@/components/founder/FounderProfileCard';
import TwoFactorSetup from '@/components/founder/TwoFactorSetup';
import AuthorityLock from '@/components/founder/AuthorityLock';
import AiManagerPanel from '@/components/founder/AiManagerPanel';
import AiLogsViewer from '@/components/founder/AiLogsViewer';
import MasterControls from '@/components/founder/MasterControls';
import LegalOwnership from '@/components/founder/LegalOwnership';
import Monetization from '@/components/founder/Monetization';
import FounderAnalytics from '@/components/founder/FounderAnalytics';
import SecurityEmergency from '@/components/founder/SecurityEmergency';
import FounderRoute from '@/routes/FounderRoute';
import { founderApi } from '@/lib/founderApi';

const tabs = [
  'Identity & Access',
  'AI System Control',
  'Website Master Controls',
  'Legal & Ownership',
  'Monetization',
  'Founder Tools & Analytics',
  'Security & Emergency',
  'AI Logs',
];

export default function FounderControlPage() {
  const [active, setActive] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    let timer: any;
    const load = async () => setSummary(await founderApi.getSystemSummary());
    load();
    timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const content = (
    <div className="space-y-4">
      {/* Live Status Bar */}
      <div className="rounded-xl p-3 bg-gradient-to-r from-black/60 to-executive-card text-slate-200 border border-white/5 flex items-center gap-4 text-sm">
        <div>🟢 System <span className="text-emerald-300">{summary?.systems?.system || '...'}</span></div>
        <div>| AI: <span className="text-cyan-300">{summary?.systems?.ai || '...'}</span></div>
        <div>| Backup: <span className="text-amber-300">{summary?.systems?.backup || '...'}</span></div>
        <div>| Security: <span className="text-purple-300">{summary?.systems?.security || '...'}</span></div>
        <div className="ml-auto text-xs text-slate-400">{summary?.updatedAt ? new Date(summary.updatedAt).toLocaleTimeString() : ''}</div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t, i) => (
          <button key={t} onClick={()=>setActive(i)} className={`px-3 py-2 rounded-full border border-white/10 text-sm ${i===active ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'bg-black/40 text-slate-200 hover:bg-black/30'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-8}} transition={{duration:0.2}}>
            {active===0 && (<div className="grid md:grid-cols-2 gap-4"><FounderProfileCard /><TwoFactorSetup /><AuthorityLock /></div>)}
            {active===1 && (<AiManagerPanel />)}
            {active===2 && (<MasterControls />)}
            {active===3 && (<LegalOwnership />)}
            {active===4 && (<Monetization />)}
            {active===5 && (<FounderAnalytics />)}
            {active===6 && (<SecurityEmergency />)}
            {active===7 && (<AiLogsViewer />)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <FounderRoute>
      <div className="bg-executive-bg min-h-[60vh] text-white">
        <header className="mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-amber-300 to-purple-400 bg-clip-text text-transparent">Founder Control</h1>
          <p className="text-slate-400 text-sm">Strictly founder-only area. Executive dark theme.</p>
        </header>
        {content}
      </div>
    </FounderRoute>
  );
}
