import { useEffect, useState } from 'react';
import apiClient, { safeSettingsLoad } from '../lib/api';
import toast from 'react-hot-toast';
import html2pdf from 'html2pdf.js';
import {
  FaBrain, FaMoneyBill, FaUserShield
} from 'react-icons/fa';
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
  useLockdownCheck(settings);

  useEffect(() => {
    safeSettingsLoad({ skipProbe: true })
      .then((raw: any) => {
        const config = raw || defaultSettings;
        setSettings({
          aiTrainer: !!config.aiTrainer,
          adsenseEnabled: !!config.adsenseEnabled,
          voiceReader: !!config.voiceReader,
          lockdown: !!config.lockdown,
          signatureLock: !!config.signatureLock,
          founderOnly: !!config.founderOnly,
        });
        if (raw?._stub) {
          console.warn('[AdminControlCenter] settings stub active (route missing).');
        }
      })
      .catch(() => {
        toast.error('⚠️ Failed to load settings (stub defaults applied).');
        setSettings(defaultSettings);
      });
  }, []);

  const handleSave = () => {
    toast.promise(
      apiClient.post('/settings/save', settings),
      {
        loading: 'Saving settings...',
        success: '✅ Settings saved!',
        error: '❌ Failed to save settings.',
      }
    );
  };

  const handleReset = () => {
    setSettings(safeDefaults);
    toast.success('♻️ Settings reverted to Safe Mode');
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
      <h2 style="font-size:18px; margin-bottom:12px;">🧩 News Pulse Admin Settings</h2>
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
        filename: 'Admin_Settings_NewsPulse.pdf', /* internal filename kept; branding in UI updated */
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait' },
      })
      .save()
      .then(() => {
        document.body.removeChild(tempContainer);
      });
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-3 text-white">🧩 Admin Control Center</h1>
          <p className="text-lg text-slate-200">Configure AI intelligence, founder controls, and monetization settings</p>
          <div className="mt-4 bg-blue-900/50 border border-blue-500 rounded-lg p-4">
            <p className="text-base text-white">
              📊 <strong className="text-white">Need system monitoring?</strong> Visit <Link to="/safeownerzone/founder" className="text-blue-300 underline hover:text-blue-200 font-semibold">Safe Owner Zone</Link> for real-time metrics and detailed panels.
            </p>
          </div>
        </div>

        <div className="space-y-6">

          <ZoneSection title="AI Intelligence Zone" icon={<FaBrain />}>
            <label className="flex items-center gap-3 text-base text-white cursor-pointer">
              <input
                type="checkbox"
                checked={settings.aiTrainer}
                onChange={(e) => setSettings(prev => ({ ...prev, aiTrainer: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="font-medium">Enable AI Trainer (Beta)</span>
            </label>
          </ZoneSection>

          <ZoneSection title="Founder Control Zone" icon={<FaUserShield />}>
            <label className="flex items-center gap-3 text-base text-white mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.lockdown}
                onChange={(e) => setSettings(prev => ({ ...prev, lockdown: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="font-medium">🔒 Enable Lockdown Mode</span>
            </label>

            <label className="flex items-center gap-3 text-base text-white mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.signatureLock}
                onChange={(e) => setSettings(prev => ({ ...prev, signatureLock: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="font-medium">✍️ Enable Signature Lock</span>
            </label>

            <label className="flex items-center gap-3 text-base text-white mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.founderOnly}
                onChange={(e) => setSettings(prev => ({ ...prev, founderOnly: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="font-medium">👑 Founder-Only Panel Mode</span>
            </label>

            <Link
              to="/safe-owner/update-pin"
              className="inline-block px-5 py-3 text-base font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg"
            >
              🔁 Update Founder PIN
            </Link>
          </ZoneSection>

          <ZoneSection title="Monetization Zone" icon={<FaMoneyBill />}>
            <label className="flex items-center gap-3 text-base text-white cursor-pointer">
              <input
                type="checkbox"
                checked={settings.adsenseEnabled}
                onChange={(e) => setSettings(prev => ({ ...prev, adsenseEnabled: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="font-medium">Enable Google AdSense</span>
            </label>
          </ZoneSection>

          <div className="sticky bottom-0 bg-slate-800 p-6 rounded-xl shadow-2xl flex flex-wrap gap-4 justify-center items-center border-2 border-slate-700">
            <button onClick={handleSave} className="bg-green-600 px-8 py-3 rounded-lg text-lg font-bold text-white hover:bg-green-700 transition shadow-lg">
              💾 Save All
            </button>
            <button onClick={handleReset} className="bg-red-600 px-8 py-3 rounded-lg text-lg font-bold text-white hover:bg-red-700 transition shadow-lg">
              ♻️ Safe Mode
            </button>
            <button onClick={handleExportPDF} className="bg-blue-600 px-8 py-3 rounded-lg text-lg font-bold text-white hover:bg-blue-700 transition shadow-lg">
              📤 Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
