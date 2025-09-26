import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import html2pdf from 'html2pdf.js';
import {
  FaBrain, FaLock, FaChartLine, FaMoneyBill,
  FaGavel, FaCogs, FaSave, FaUserShield, FaWrench
} from 'react-icons/fa';
import MissionControlSidebar from "./SafeZone/MissionControlSidebar";
import { useNavigate, Link } from 'react-router-dom';

// ✅ Admin Panel Lock Protection Wrapper
function useLockdownCheck(settings: any) {
  const navigate = useNavigate();
  useEffect(() => {
    if (settings.lockdown) {
      toast.error('🔒 Lockdown Mode is ON. Admin tools are restricted.');
      navigate('/admin/locked');
    }
  }, [settings.lockdown]);
}

type ZoneSectionProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

const ZoneSection = ({ title, icon, children }: ZoneSectionProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-900 text-white mb-4 rounded-xl shadow-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-6 py-3 text-left font-bold text-lg"
      >
        <div className="flex items-center gap-2">{icon} {title}</div>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-6 border-t border-slate-700">{children}</div>}
    </div>
  );
};

const defaultSettings = {
  aiTrainer: false,
  adsenseEnabled: false,
  voiceReader: true,
  lockdown: false,
  signatureLock: false,
  founderOnly: false,
};

const safeDefaults = {
  aiTrainer: false,
  adsenseEnabled: false,
  voiceReader: false,
  lockdown: false,
  signatureLock: false,
  founderOnly: false,
};

export default function AdminControlCenter() {
  const [settings, setSettings] = useState(defaultSettings);
  const [backup, setBackup] = useState(defaultSettings);
  useLockdownCheck(settings);

  useEffect(() => {
    axios.get('/api/settings/load')
      .then(res => {
        const config = res.data || defaultSettings;
        setSettings(config);
        setBackup(config);
      })
      .catch(() => {
        toast.error('⚠️ Failed to load settings from database.');
        setSettings(defaultSettings);
      });
  }, []);

  const handleSave = () => {
    toast.promise(
      axios.post('/api/settings/save', settings),
      {
        loading: 'Saving settings...',
        success: () => {
          setBackup(settings);
          return '✅ Settings saved!';
        },
        error: '❌ Failed to save settings.',
      }
    );
  };

  const handleReset = () => {
    setSettings(safeDefaults);
    toast.success('♻️ Settings reverted to Safe Mode');
  };

  const handleRestoreBackup = () => {
    setSettings(backup);
    toast.success('🔁 Settings restored from last backup');
  };

  const handleExportPDF = () => {
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.top = '20px';
    tempContainer.style.left = '20px';
    tempContainer.style.padding = '20px';
    tempContainer.style.background = 'white';
    tempContainer.style.color = 'black';
    tempContainer.style.fontFamily = 'Arial, sans-serif';
    tempContainer.style.fontSize = '14px';
    tempContainer.style.lineHeight = '1.5';
    tempContainer.innerHTML = `
      <h2 style="font-size:18px; margin-bottom:12px;">🧩 NewsPulse Admin Settings</h2>
      <ul>
        <li><strong>AI Trainer:</strong> ${settings.aiTrainer ? 'Enabled ✅' : 'Disabled ❌'}</li>
        <li><strong>AdSense:</strong> ${settings.adsenseEnabled ? 'Enabled ✅' : 'Disabled ❌'}</li>
        <li><strong>Voice Reader:</strong> ${settings.voiceReader ? 'Enabled ✅' : 'Disabled ❌'}</li>
        <li><strong>Lockdown Mode:</strong> ${settings.lockdown ? 'Enabled 🔒' : 'Disabled 🔓'}</li>
        <li><strong>Signature Lock:</strong> ${settings.signatureLock ? 'Enabled ✍️' : 'Disabled ❌'}</li>
        <li><strong>Founder Only Mode:</strong> ${settings.founderOnly ? 'Active 👑' : 'Disabled ❌'}</li>
      </ul>
      <p style="margin-top:10px; font-size:12px; color:#444;">Exported on: ${new Date().toLocaleString()}</p>
    `;

    document.body.appendChild(tempContainer);

    html2pdf()
      .from(tempContainer)
      .set({
        margin: 0.5,
        filename: 'Admin_Settings_NewsPulse.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait' },
      })
      .save()
      .then(() => {
        document.body.removeChild(tempContainer);
      });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="w-full md:w-64 flex-shrink-0">
        <MissionControlSidebar
          onExportSettings={handleExportPDF}
          onBackupSite={() => toast.success('💾 Backup triggered (simulated).')}
          onRestoreBackup={handleRestoreBackup}
        />
      </div>

      <div className="flex-1 space-y-6">
        <h1 className="text-2xl font-bold mb-2 text-white">🧩 Admin Control Center – News Pulse</h1>

        <ZoneSection title="AI Intelligence Zone" icon={<FaBrain />}>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.aiTrainer}
              onChange={(e) => setSettings(prev => ({ ...prev, aiTrainer: e.target.checked }))}
            />
            Enable AI Trainer (Beta)
          </label>
        </ZoneSection>

        <ZoneSection title="Founder Control Zone" icon={<FaUserShield />}>
          <label className="flex items-center gap-3 text-sm mb-2">
            <input
              type="checkbox"
              checked={settings.lockdown}
              onChange={(e) => setSettings(prev => ({ ...prev, lockdown: e.target.checked }))}
            />
            🔒 Enable Lockdown Mode
          </label>

          <label className="flex items-center gap-3 text-sm mb-2">
            <input
              type="checkbox"
              checked={settings.signatureLock}
              onChange={(e) => setSettings(prev => ({ ...prev, signatureLock: e.target.checked }))}
            />
            ✍️ Enable Signature Lock
          </label>

          <label className="flex items-center gap-3 text-sm mb-4">
            <input
              type="checkbox"
              checked={settings.founderOnly}
              onChange={(e) => setSettings(prev => ({ ...prev, founderOnly: e.target.checked }))}
            />
            👑 Founder-Only Panel Mode
          </label>

          <Link
            to="/safe-owner/update-pin"
            className="inline-block px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            🔁 Update Founder PIN
          </Link>
        </ZoneSection>

        <ZoneSection title="Performance + Reach Zone" icon={<FaChartLine />}>
          <p className="text-sm">Control homepage performance, voice playlist behavior, engagement logic.</p>
        </ZoneSection>

        <ZoneSection title="Monetization Zone" icon={<FaMoneyBill />}>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.adsenseEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, adsenseEnabled: e.target.checked }))}
            />
            Enable Google AdSense
          </label>
        </ZoneSection>

        <ZoneSection title="Compliance & Legal Zone" icon={<FaGavel />}>
          <p className="text-sm">Enable PTI filters, AI trust checkers, defamation guard, and GDPR consent.</p>
        </ZoneSection>

        <ZoneSection title="UI Customization" icon={<FaCogs />}>
          <p className="text-sm">Choose layout mode, toggle dark/light theme, font preferences.</p>
        </ZoneSection>

        <ZoneSection title="Backup & Export Zone" icon={<FaSave />}>
          <p className="text-sm">Auto backup, manual export to PDF, and restore backup options.</p>
        </ZoneSection>

        <ZoneSection title="Admin & Team Control" icon={<FaLock />}>
          <p className="text-sm">Manage team roles, login logs, and admin panel access.</p>
        </ZoneSection>

        <ZoneSection title="Advanced Settings" icon={<FaWrench />}>
          <p className="text-sm">Advanced developer options: AMP toggle, API test tools.</p>
        </ZoneSection>

        <div className="sticky bottom-0 bg-slate-800 p-4 rounded-xl shadow-md flex justify-between items-center">
          <button onClick={handleSave} className="bg-green-500 px-6 py-2 rounded-lg font-bold hover:bg-green-600">
            💾 Save All
          </button>
          <button onClick={handleReset} className="bg-red-500 px-6 py-2 rounded-lg font-bold hover:bg-red-600">
            ♻️ Safe Mode
          </button>
          <button onClick={handleExportPDF} className="bg-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-700">
            📤 Export
          </button>
        </div>
      </div>
    </div>
  );
}
