import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒ¢í∩╕Å FOUNDER CONTROL CENTER - Maximum Security News Command
// Zero-Trust Architecture with Emergency Controls
import { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Lock, Unlock, AlertTriangle, Activity, Globe, Zap, Ban, CheckCircle, XCircle, AlertCircle, Monitor, HardDrive, Cpu, MemoryStick, Download, RefreshCw, Key } from 'lucide-react';
const FounderControlCenter = () => {
    const [systemHealth] = useState({
        server: 'healthy',
        database: 'healthy',
        cdn: 'healthy',
        security: 'warning',
        backup: 'healthy'
    });
    const [controls, setControls] = useState({
        globalPublishing: true,
        emergencyMode: false,
        readOnlyMode: false,
        founderShield: true,
        backupRunning: false,
        auditMode: true
    });
    const [securityEvents] = useState([
        {
            id: '1',
            type: 'login_attempt',
            severity: 'high',
            user: 'unknown@suspicious.com',
            action: 'Failed login attempt (5x)',
            timestamp: new Date(Date.now() - 300000),
            ip: '192.168.1.100',
            location: 'Mumbai, India',
            resolved: false
        },
        {
            id: '2',
            type: 'permission_change',
            severity: 'medium',
            user: 'editor@newspulse.ai',
            action: 'Role elevated to Managing Editor',
            timestamp: new Date(Date.now() - 1800000),
            ip: '10.0.1.50',
            location: 'Delhi, India',
            resolved: true
        },
        {
            id: '3',
            type: 'data_access',
            severity: 'low',
            user: 'reporter@newspulse.ai',
            action: 'Bulk story download',
            timestamp: new Date(Date.now() - 3600000),
            ip: '10.0.1.75',
            location: 'Bangalore, India',
            resolved: true
        }
    ]);
    const [showFounderCode, setShowFounderCode] = useState(false);
    const [foundationCode, setFoundationCode] = useState('');
    // Emergency Controls
    const toggleEmergencyMode = () => {
        if (!controls.emergencyMode) {
            // Entering emergency mode
            setControls(prev => ({
                ...prev,
                emergencyMode: true,
                globalPublishing: false,
                readOnlyMode: true,
                founderShield: true
            }));
        }
        else {
            // Exiting emergency mode requires founder code
            if (foundationCode === 'NEWSPULSE-FOUNDER-2025') {
                setControls(prev => ({
                    ...prev,
                    emergencyMode: false,
                    readOnlyMode: false,
                    globalPublishing: true
                }));
                setFoundationCode('');
                setShowFounderCode(false);
            }
        }
    };
    const toggleGlobalPublishing = () => {
        if (!controls.emergencyMode) {
            setControls(prev => ({ ...prev, globalPublishing: !prev.globalPublishing }));
        }
    };
    const initiateBackup = () => {
        setControls(prev => ({ ...prev, backupRunning: true }));
        // Simulate backup process
        setTimeout(() => {
            setControls(prev => ({ ...prev, backupRunning: false }));
        }, 10000);
    };
    const getHealthIcon = (status) => {
        switch (status) {
            case 'healthy': return _jsx(CheckCircle, { className: "w-5 h-5 text-green-500" });
            case 'warning': return _jsx(AlertTriangle, { className: "w-5 h-5 text-yellow-500" });
            case 'critical': return _jsx(XCircle, { className: "w-5 h-5 text-red-500" });
            default: return _jsx(AlertCircle, { className: "w-5 h-5 text-gray-500" });
        }
    };
    const getHealthColor = (status) => {
        switch (status) {
            case 'healthy': return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300';
            case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300';
            case 'critical': return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300';
            default: return 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-900/20 dark:border-gray-700 dark:text-gray-300';
        }
    };
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
            case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white", children: [_jsx("div", { className: "bg-gradient-to-r from-red-900/20 to-red-800/20 border-b border-red-700/30", children: _jsx("div", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "p-3 bg-red-600/20 rounded-lg border border-red-500/30", children: _jsx(Shield, { className: "w-8 h-8 text-red-400" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-white", children: "\uD83D\uDEE1\uFE0F FOUNDER COMMAND CENTER" }), _jsx("p", { className: "text-red-300 mt-1", children: "Zero-Trust Security \u2022 Global System Control \u2022 Emergency Response" })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [controls.emergencyMode && (_jsxs("div", { className: "flex items-center space-x-2 px-3 py-2 bg-red-600/30 rounded-lg border border-red-500/50", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-red-300 animate-pulse" }), _jsx("span", { className: "text-red-300 font-semibold", children: "EMERGENCY MODE" })] })), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-3 h-3 bg-green-500 rounded-full animate-pulse" }), _jsx("span", { className: "text-sm text-slate-300", children: "Founder Online" })] })] })] }) }) }), _jsxs("div", { className: "p-6", children: [_jsx("div", { className: "mb-8", children: _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white mb-6 flex items-center", children: [_jsx(Zap, { className: "w-6 h-6 text-yellow-400 mr-3" }), "FOUNDER COMMAND STRIP"] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("button", { onClick: toggleGlobalPublishing, disabled: controls.emergencyMode, className: `p-4 rounded-lg border-2 transition-all ${controls.globalPublishing
                                                ? 'bg-green-900/20 border-green-500/50 text-green-300'
                                                : 'bg-red-900/20 border-red-500/50 text-red-300'} ${controls.emergencyMode ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`, children: [_jsx("div", { className: "flex items-center justify-center mb-2", children: controls.globalPublishing ? _jsx(Unlock, { className: "w-8 h-8" }) : _jsx(Lock, { className: "w-8 h-8" }) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-semibold", children: "Global Publishing" }), _jsx("p", { className: "text-xs opacity-75", children: controls.globalPublishing ? 'ENABLED' : 'DISABLED' })] })] }), _jsxs("button", { onClick: () => {
                                                if (controls.emergencyMode) {
                                                    setShowFounderCode(true);
                                                }
                                                else {
                                                    toggleEmergencyMode();
                                                }
                                            }, className: `p-4 rounded-lg border-2 transition-all ${controls.emergencyMode
                                                ? 'bg-red-900/20 border-red-500/50 text-red-300'
                                                : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-red-900/10 hover:border-red-500/30'}`, children: [_jsx("div", { className: "flex items-center justify-center mb-2", children: _jsx(Ban, { className: "w-8 h-8" }) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-semibold", children: "Emergency Lockdown" }), _jsx("p", { className: "text-xs opacity-75", children: controls.emergencyMode ? 'ACTIVE' : 'STANDBY' })] })] }), _jsxs("button", { onClick: () => setControls(prev => ({ ...prev, founderShield: !prev.founderShield })), className: `p-4 rounded-lg border-2 transition-all ${controls.founderShield
                                                ? 'bg-blue-900/20 border-blue-500/50 text-blue-300'
                                                : 'bg-slate-700/50 border-slate-600/50 text-slate-300'}`, children: [_jsx("div", { className: "flex items-center justify-center mb-2", children: _jsx(ShieldCheck, { className: "w-8 h-8" }) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-semibold", children: "Founder Shield" }), _jsx("p", { className: "text-xs opacity-75", children: controls.founderShield ? 'PROTECTED' : 'EXPOSED' })] })] }), _jsxs("button", { onClick: initiateBackup, disabled: controls.backupRunning, className: `p-4 rounded-lg border-2 transition-all ${controls.backupRunning
                                                ? 'bg-yellow-900/20 border-yellow-500/50 text-yellow-300'
                                                : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-purple-900/10 hover:border-purple-500/30'}`, children: [_jsx("div", { className: "flex items-center justify-center mb-2", children: controls.backupRunning ? (_jsx(RefreshCw, { className: "w-8 h-8 animate-spin" })) : (_jsx(Download, { className: "w-8 h-8" })) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-semibold", children: "System Backup" }), _jsx("p", { className: "text-xs opacity-75", children: controls.backupRunning ? 'RUNNING' : 'READY' })] })] })] })] }) }), showFounderCode && (_jsx("div", { className: "fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-slate-800 rounded-xl border border-slate-700 p-8 max-w-md w-full mx-4", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx(Key, { className: "w-12 h-12 text-yellow-400 mx-auto mb-4" }), _jsx("h3", { className: "text-xl font-bold text-white", children: "Founder Authentication Required" }), _jsx("p", { className: "text-slate-400 mt-2", children: "Enter your foundation code to exit emergency mode" })] }), _jsx("input", { type: "password", value: foundationCode, onChange: (e) => setFoundationCode(e.target.value), placeholder: "Foundation Code", className: "w-full p-4 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 mb-4", autoFocus: true }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: toggleEmergencyMode, className: "flex-1 p-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors", children: "Authenticate" }), _jsx("button", { onClick: () => {
                                                setShowFounderCode(false);
                                                setFoundationCode('');
                                            }, className: "flex-1 p-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold transition-colors", children: "Cancel" })] })] }) })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [_jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white mb-6 flex items-center", children: [_jsx(Activity, { className: "w-6 h-6 text-green-400 mr-3" }), "SYSTEM INTELLIGENCE"] }), _jsx("div", { className: "space-y-4", children: Object.entries(systemHealth).map(([system, status]) => (_jsx("div", { className: `p-4 rounded-lg border ${getHealthColor(status)}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [getHealthIcon(status), _jsxs("div", { children: [_jsx("p", { className: "font-semibold capitalize", children: system }), _jsx("p", { className: "text-sm opacity-75 capitalize", children: status })] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("p", { className: "text-sm font-mono", children: [system === 'server' && '99.9%', system === 'database' && '100%', system === 'cdn' && '99.8%', system === 'security' && '98.5%', system === 'backup' && '100%'] }), _jsx("p", { className: "text-xs opacity-60", children: "Uptime" })] })] }) }, system))) })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white mb-6 flex items-center", children: [_jsx(ShieldAlert, { className: "w-6 h-6 text-red-400 mr-3" }), "SECURITY EVENTS"] }), _jsx("div", { className: "space-y-4 max-h-96 overflow-y-auto", children: securityEvents.map((event) => (_jsxs("div", { className: "p-4 bg-slate-700/30 rounded-lg border border-slate-600/30", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: `px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(event.severity)}`, children: event.severity.toUpperCase() }), _jsx("span", { className: "text-xs text-slate-400", children: event.type.replace('_', ' ').toUpperCase() })] }), event.resolved ? (_jsx(CheckCircle, { className: "w-4 h-4 text-green-400" })) : (_jsx(AlertCircle, { className: "w-4 h-4 text-red-400" }))] }), _jsx("p", { className: "text-white font-medium mb-1", children: event.action }), _jsxs("div", { className: "text-xs text-slate-400 space-y-1", children: [_jsxs("p", { children: ["User: ", event.user] }), _jsxs("p", { children: ["IP: ", event.ip, " \u2022 ", event.location] }), _jsxs("p", { children: ["Time: ", event.timestamp.toLocaleString()] })] })] }, event.id))) })] })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white mb-6 flex items-center", children: [_jsx(Monitor, { className: "w-6 h-6 text-blue-400 mr-3" }), "SYSTEM RESOURCES"] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: [_jsxs("div", { className: "text-center", children: [_jsx(Cpu, { className: "w-8 h-8 text-blue-400 mx-auto mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white", children: "23%" }), _jsx("p", { className: "text-sm text-slate-400", children: "CPU Usage" })] }), _jsxs("div", { className: "text-center", children: [_jsx(MemoryStick, { className: "w-8 h-8 text-green-400 mx-auto mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white", children: "67%" }), _jsx("p", { className: "text-sm text-slate-400", children: "Memory" })] }), _jsxs("div", { className: "text-center", children: [_jsx(HardDrive, { className: "w-8 h-8 text-yellow-400 mx-auto mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white", children: "45%" }), _jsx("p", { className: "text-sm text-slate-400", children: "Storage" })] }), _jsxs("div", { className: "text-center", children: [_jsx(Globe, { className: "w-8 h-8 text-purple-400 mx-auto mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white", children: "1.2GB" }), _jsx("p", { className: "text-sm text-slate-400", children: "Bandwidth" })] })] })] })] })] }));
};
export default FounderControlCenter;
