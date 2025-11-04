import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import apiClient from '../lib/api';
import toast from 'react-hot-toast';
import html2pdf from 'html2pdf.js';
import { FaBrain, FaMoneyBill, FaUserShield } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
// ✅ Admin Panel Lock Protection Wrapper
function useLockdownCheck(settings) {
    const navigate = useNavigate();
    useEffect(() => {
        if (settings.lockdown) {
            toast.error('🔒 Lockdown Mode is ON. Admin tools are restricted.');
            navigate('/admin/locked');
        }
    }, [settings.lockdown]);
}
const ZoneSection = ({ title, icon, children }) => {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "bg-slate-900 text-white mb-4 rounded-xl shadow-lg", children: [_jsxs("button", { onClick: () => setOpen(!open), className: "w-full flex justify-between items-center px-6 py-3 text-left font-bold text-lg", children: [_jsxs("div", { className: "flex items-center gap-2", children: [icon, " ", title] }), _jsx("span", { children: open ? '▲' : '▼' })] }), open && _jsx("div", { className: "p-6 border-t border-slate-700", children: children })] }));
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
        apiClient.get('/settings/load')
            .then(res => {
            const config = res.data || defaultSettings;
            setSettings(config);
        })
            .catch(() => {
            toast.error('⚠️ Failed to load settings from database.');
            setSettings(defaultSettings);
        });
    }, []);
    const handleSave = () => {
        toast.promise(apiClient.post('/settings/save', settings), {
            loading: 'Saving settings...',
            success: '✅ Settings saved!',
            error: '❌ Failed to save settings.',
        });
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
    return (_jsx("div", { className: "min-h-screen bg-slate-900 p-4 md:p-6", children: _jsxs("div", { className: "max-w-5xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-4xl font-bold mb-3 text-white", children: "\uD83E\uDDE9 Admin Control Center" }), _jsx("p", { className: "text-lg text-slate-200", children: "Configure AI intelligence, founder controls, and monetization settings" }), _jsx("div", { className: "mt-4 bg-blue-900/50 border border-blue-500 rounded-lg p-4", children: _jsxs("p", { className: "text-base text-white", children: ["\uD83D\uDCCA ", _jsx("strong", { className: "text-white", children: "Need system monitoring?" }), " Visit ", _jsx(Link, { to: "/safe-owner", className: "text-blue-300 underline hover:text-blue-200 font-semibold", children: "Safe Owner Zone" }), " for real-time metrics and detailed panels."] }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsx(ZoneSection, { title: "AI Intelligence Zone", icon: _jsx(FaBrain, {}), children: _jsxs("label", { className: "flex items-center gap-3 text-base text-white cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.aiTrainer, onChange: (e) => setSettings(prev => ({ ...prev, aiTrainer: e.target.checked })), className: "w-5 h-5" }), _jsx("span", { className: "font-medium", children: "Enable AI Trainer (Beta)" })] }) }), _jsxs(ZoneSection, { title: "Founder Control Zone", icon: _jsx(FaUserShield, {}), children: [_jsxs("label", { className: "flex items-center gap-3 text-base text-white mb-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.lockdown, onChange: (e) => setSettings(prev => ({ ...prev, lockdown: e.target.checked })), className: "w-5 h-5" }), _jsx("span", { className: "font-medium", children: "\uD83D\uDD12 Enable Lockdown Mode" })] }), _jsxs("label", { className: "flex items-center gap-3 text-base text-white mb-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.signatureLock, onChange: (e) => setSettings(prev => ({ ...prev, signatureLock: e.target.checked })), className: "w-5 h-5" }), _jsx("span", { className: "font-medium", children: "\u270D\uFE0F Enable Signature Lock" })] }), _jsxs("label", { className: "flex items-center gap-3 text-base text-white mb-4 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.founderOnly, onChange: (e) => setSettings(prev => ({ ...prev, founderOnly: e.target.checked })), className: "w-5 h-5" }), _jsx("span", { className: "font-medium", children: "\uD83D\uDC51 Founder-Only Panel Mode" })] }), _jsx(Link, { to: "/safe-owner/update-pin", className: "inline-block px-5 py-3 text-base font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg", children: "\uD83D\uDD01 Update Founder PIN" })] }), _jsx(ZoneSection, { title: "Monetization Zone", icon: _jsx(FaMoneyBill, {}), children: _jsxs("label", { className: "flex items-center gap-3 text-base text-white cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.adsenseEnabled, onChange: (e) => setSettings(prev => ({ ...prev, adsenseEnabled: e.target.checked })), className: "w-5 h-5" }), _jsx("span", { className: "font-medium", children: "Enable Google AdSense" })] }) }), _jsxs("div", { className: "sticky bottom-0 bg-slate-800 p-6 rounded-xl shadow-2xl flex flex-wrap gap-4 justify-center items-center border-2 border-slate-700", children: [_jsx("button", { onClick: handleSave, className: "bg-green-600 px-8 py-3 rounded-lg text-lg font-bold text-white hover:bg-green-700 transition shadow-lg", children: "\uD83D\uDCBE Save All" }), _jsx("button", { onClick: handleReset, className: "bg-red-600 px-8 py-3 rounded-lg text-lg font-bold text-white hover:bg-red-700 transition shadow-lg", children: "\u267B\uFE0F Safe Mode" }), _jsx("button", { onClick: handleExportPDF, className: "bg-blue-600 px-8 py-3 rounded-lg text-lg font-bold text-white hover:bg-blue-700 transition shadow-lg", children: "\uD83D\uDCE4 Export" })] })] })] }) }));
}
