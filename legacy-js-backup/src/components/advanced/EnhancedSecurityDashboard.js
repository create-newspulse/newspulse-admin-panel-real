import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ≡ƒ¢í∩╕Å Enhanced Zero-Trust Security System (Phase 2: WebAuthn + Rate Limiting)
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, Users, Activity, Lock, AlertTriangle, CheckCircle, XCircle, Key, Smartphone, Zap, Ban, TrendingUp, Globe } from 'lucide-react';
const API_BASE = 'http://localhost:3002/api';
export default function EnhancedSecurityDashboard() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    // State for all tabs
    const [metrics, setMetrics] = useState(null);
    const [auditLog, setAuditLog] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [rbacData, setRbacData] = useState(null);
    const [credentials, setCredentials] = useState([]);
    const [rateLimitData, setRateLimitData] = useState(null);
    const [attacks, setAttacks] = useState([]);
    useEffect(() => {
        loadData();
    }, [activeTab]);
    const loadData = async () => {
        setLoading(true);
        try {
            switch (activeTab) {
                case 'dashboard':
                    const [auditRes, sessionsRes, rateLimitRes] = await Promise.all([
                        axios.get(`${API_BASE}/security/audit?limit=10`),
                        axios.get(`${API_BASE}/security/sessions`),
                        axios.get(`${API_BASE}/security/rate-limit/stats`)
                    ]);
                    setMetrics({
                        threatLevel: 'low',
                        activeSessions: sessionsRes.data.sessions?.length || 0,
                        auditEvents24h: auditRes.data.total || 0,
                        blockedIPs: rateLimitRes.data.stats?.manualBlockCount || 0,
                        failedLogins24h: 3
                    });
                    setAuditLog(auditRes.data.events?.slice(0, 5) || []);
                    break;
                case 'audit':
                    const auditFullRes = await axios.get(`${API_BASE}/security/audit?limit=50`);
                    setAuditLog(auditFullRes.data.events || []);
                    break;
                case 'sessions':
                    const sessionsFullRes = await axios.get(`${API_BASE}/security/sessions`);
                    setSessions(sessionsFullRes.data.sessions || []);
                    break;
                case 'rbac':
                    const [rolesRes, usersRes] = await Promise.all([
                        axios.get(`${API_BASE}/security/rbac/roles`),
                        axios.get(`${API_BASE}/security/rbac/users`)
                    ]);
                    setRbacData({
                        roles: rolesRes.data.roles || [],
                        users: usersRes.data.users || []
                    });
                    break;
                case 'webauthn':
                    const credsRes = await axios.get(`${API_BASE}/security/webauthn/credentials/founder@newspulse.com`);
                    setCredentials(credsRes.data.credentials || []);
                    break;
                case 'rate-limit':
                    const [statsRes, attacksRes, patternsRes] = await Promise.all([
                        axios.get(`${API_BASE}/security/rate-limit/stats`),
                        axios.get(`${API_BASE}/security/rate-limit/attacks?limit=20`),
                        axios.get(`${API_BASE}/security/rate-limit/patterns`)
                    ]);
                    setRateLimitData({
                        stats: statsRes.data.stats,
                        activeRateLimits: statsRes.data.activeRateLimits || [],
                        patterns: patternsRes.data.patterns || []
                    });
                    setAttacks(attacksRes.data.attacks || []);
                    break;
            }
        }
        catch (error) {
            console.error('Failed to load security data:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const revokeSession = async (sessionId) => {
        try {
            await axios.delete(`${API_BASE}/security/sessions/${sessionId}`);
            loadData();
        }
        catch (error) {
            console.error('Failed to revoke session:', error);
        }
    };
    const removeCredential = async (credentialId) => {
        try {
            await axios.delete(`${API_BASE}/security/webauthn/credentials/founder@newspulse.com/${credentialId}`);
            loadData();
        }
        catch (error) {
            console.error('Failed to remove credential:', error);
        }
    };
    const blockIP = async () => {
        const ip = prompt('Enter IP address to block:');
        if (!ip)
            return;
        try {
            await axios.post(`${API_BASE}/security/rate-limit/block`, { ip, reason: 'Manual block from dashboard' });
            loadData();
        }
        catch (error) {
            console.error('Failed to block IP:', error);
        }
    };
    const unblockIP = async (ip) => {
        try {
            await axios.delete(`${API_BASE}/security/rate-limit/block/${ip}`);
            loadData();
        }
        catch (error) {
            console.error('Failed to unblock IP:', error);
        }
    };
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: Shield },
        { id: 'audit', label: 'Audit Trail', icon: Activity },
        { id: 'sessions', label: 'Sessions', icon: Users },
        { id: 'rbac', label: 'RBAC', icon: Lock },
        { id: 'webauthn', label: 'Passkeys', icon: Key },
        { id: 'rate-limit', label: 'Rate Limiting', icon: Zap }
    ];
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsxs("h1", { className: "text-4xl font-bold text-white flex items-center gap-3 mb-2", children: [_jsx(Shield, { className: "w-10 h-10 text-cyan-400" }), "Zero-Trust Security Center"] }), _jsx("p", { className: "text-slate-400", children: "Phase 2: WebAuthn + Rate Limiting + Advanced Protection" })] }), _jsx("div", { className: "flex gap-2 mb-6 overflow-x-auto pb-2", children: tabs.map(tab => {
                        const Icon = tab.icon;
                        return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`, children: [_jsx(Icon, { className: "w-4 h-4" }), tab.label] }, tab.id));
                    }) }), loading ? (_jsxs("div", { className: "bg-slate-800/50 rounded-xl p-12 text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4" }), _jsx("p", { className: "text-slate-400", children: "Loading security data..." })] })) : (_jsxs(_Fragment, { children: [activeTab === 'dashboard' && metrics && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx(AlertTriangle, { className: `w-6 h-6 ${metrics.threatLevel === 'high' ? 'text-red-400' :
                                                                metrics.threatLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'}` }), _jsx("span", { className: `text-xs font-semibold px-2 py-1 rounded ${metrics.threatLevel === 'high' ? 'bg-red-500/20 text-red-300' :
                                                                metrics.threatLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`, children: metrics.threatLevel.toUpperCase() })] }), _jsx("p", { className: "text-2xl font-bold text-white mb-1", children: "Threat Level" }), _jsx("p", { className: "text-sm text-slate-400", children: "System protected" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx(Users, { className: "w-6 h-6 text-blue-400 mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white mb-1", children: metrics.activeSessions }), _jsx("p", { className: "text-sm text-slate-400", children: "Active Sessions" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx(Activity, { className: "w-6 h-6 text-purple-400 mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white mb-1", children: metrics.auditEvents24h }), _jsx("p", { className: "text-sm text-slate-400", children: "Audit Events (24h)" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx(Ban, { className: "w-6 h-6 text-red-400 mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white mb-1", children: metrics.blockedIPs }), _jsx("p", { className: "text-sm text-slate-400", children: "Blocked IPs" })] })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Recent Security Events" }), _jsx("div", { className: "space-y-3", children: auditLog.slice(0, 5).map((event) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-slate-700/30 rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Activity, { className: "w-4 h-4 text-cyan-400" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-white font-medium", children: event.action }), _jsxs("p", { className: "text-xs text-slate-400", children: [event.actor, " \u2022 ", event.entity] })] })] }), _jsx("span", { className: "text-xs text-slate-500", children: new Date(event.timestamp).toLocaleTimeString() })] }, event.id))) })] })] })), activeTab === 'webauthn' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("h3", { className: "text-xl font-semibold text-white flex items-center gap-2", children: [_jsx(Key, { className: "w-6 h-6 text-cyan-400" }), "Registered Passkeys"] }), _jsx("button", { className: "px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition", children: "Add Passkey" })] }), credentials.length === 0 ? (_jsxs("div", { className: "text-center py-12", children: [_jsx(Smartphone, { className: "w-16 h-16 text-slate-600 mx-auto mb-4" }), _jsx("p", { className: "text-slate-400 mb-2", children: "No passkeys registered" }), _jsx("p", { className: "text-sm text-slate-500", children: "Add a security key or use your device's biometrics" })] })) : (_jsx("div", { className: "grid gap-4", children: credentials.map(cred => (_jsxs("div", { className: "flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center", children: cred.device.type === 'security-key' ? (_jsx(Key, { className: "w-6 h-6 text-cyan-400" })) : (_jsx(Smartphone, { className: "w-6 h-6 text-cyan-400" })) }), _jsxs("div", { children: [_jsx("p", { className: "text-white font-medium", children: cred.device.name }), _jsxs("p", { className: "text-sm text-slate-400", children: [cred.device.browser, " \u2022 Used ", cred.counter, " times"] }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: ["Added ", new Date(cred.createdAt).toLocaleDateString(), " \u2022", cred.lastUsed ? ` Last used ${new Date(cred.lastUsed).toLocaleDateString()}` : ' Never used'] })] })] }), _jsx("button", { onClick: () => removeCredential(cred.id), className: "px-3 py-1 text-sm text-red-400 hover:text-red-300 transition", children: "Remove" })] }, cred.id))) }))] }), _jsx("div", { className: "bg-blue-500/10 border border-blue-500/20 rounded-xl p-4", children: _jsxs("div", { className: "flex gap-3", children: [_jsx(CheckCircle, { className: "w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "text-white font-medium mb-1", children: "WebAuthn Benefits" }), _jsx("p", { className: "text-sm text-slate-300", children: "Passkeys provide phishing-resistant authentication using your device's biometrics or security keys. No passwords to remember or steal." })] })] }) })] })), activeTab === 'rate-limit' && rateLimitData && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx(TrendingUp, { className: "w-6 h-6 text-green-400 mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white mb-1", children: rateLimitData.stats.totalActiveIPs }), _jsx("p", { className: "text-sm text-slate-400", children: "Active IP Addresses" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx(Ban, { className: "w-6 h-6 text-yellow-400 mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white mb-1", children: rateLimitData.stats.autoBlockCount }), _jsx("p", { className: "text-sm text-slate-400", children: "Auto-blocked (Rate Limit)" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx(XCircle, { className: "w-6 h-6 text-red-400 mb-2" }), _jsx("p", { className: "text-2xl font-bold text-white mb-1", children: rateLimitData.stats.manualBlockCount }), _jsx("p", { className: "text-sm text-slate-400", children: "Manual Blocks" })] })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-semibold text-white", children: "Top Offenders" }), _jsx("button", { onClick: blockIP, className: "px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition", children: "Block IP" })] }), _jsx("div", { className: "space-y-3", children: rateLimitData.activeRateLimits.slice(0, 10).map((limit) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-slate-700/30 rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Globe, { className: "w-4 h-4 text-slate-400" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-white font-mono", children: limit.ip }), _jsxs("p", { className: "text-xs text-slate-400", children: [limit.requests, " requests"] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [limit.blocked && (_jsx("span", { className: "text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded", children: "BLOCKED" })), !limit.blocked && limit.requests > 80 && (_jsx("span", { className: "text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded", children: "WARNING" })), _jsx("button", { onClick: () => unblockIP(limit.ip), className: "text-xs text-cyan-400 hover:text-cyan-300", children: "Unblock" })] })] }, limit.ip))) })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Recent Attack Attempts" }), _jsx("div", { className: "space-y-2", children: attacks.slice(0, 15).map((attack) => (_jsxs("div", { className: "flex items-center justify-between p-2 bg-slate-700/20 rounded text-sm", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "font-mono text-slate-300", children: attack.ip }), _jsx("span", { className: "text-slate-400", children: attack.endpoint }), _jsxs("span", { className: "text-slate-500 text-xs", children: [attack.requests, " req"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-xs px-2 py-0.5 rounded ${attack.status === 'blocked' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`, children: attack.status }), _jsx("span", { className: "text-xs text-slate-500", children: new Date(attack.timestamp).toLocaleTimeString() })] })] }, attack.id))) })] })] })), activeTab === 'audit' && (_jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Audit Trail" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-700", children: [_jsx("th", { className: "text-left py-3 px-4 text-slate-400 font-medium", children: "Timestamp" }), _jsx("th", { className: "text-left py-3 px-4 text-slate-400 font-medium", children: "Actor" }), _jsx("th", { className: "text-left py-3 px-4 text-slate-400 font-medium", children: "Action" }), _jsx("th", { className: "text-left py-3 px-4 text-slate-400 font-medium", children: "Entity" }), _jsx("th", { className: "text-left py-3 px-4 text-slate-400 font-medium", children: "IP" })] }) }), _jsx("tbody", { children: auditLog.map((entry) => (_jsxs("tr", { className: "border-b border-slate-700/50", children: [_jsx("td", { className: "py-3 px-4 text-slate-300", children: new Date(entry.timestamp).toLocaleString() }), _jsx("td", { className: "py-3 px-4 text-white", children: entry.actor }), _jsx("td", { className: "py-3 px-4 text-cyan-400", children: entry.action }), _jsx("td", { className: "py-3 px-4 text-slate-300", children: entry.entity }), _jsx("td", { className: "py-3 px-4 text-slate-400 font-mono text-xs", children: entry.ip })] }, entry.id))) })] }) })] })), activeTab === 'sessions' && (_jsx("div", { className: "space-y-4", children: sessions.map((session) => (_jsx("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex gap-4", children: [_jsx("div", { className: "w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center", children: _jsx(Users, { className: "w-6 h-6 text-blue-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-white font-medium", children: session.email }), _jsxs("p", { className: "text-sm text-slate-400 mt-1", children: [session.device, " \u2022 ", session.browser] }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [session.location, " \u2022 ", session.ip] }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: ["Created ", new Date(session.createdAt).toLocaleString()] })] })] }), _jsx("button", { onClick: () => revokeSession(session.id), className: "px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition", children: "Revoke" })] }) }, session.id))) })), activeTab === 'rbac' && rbacData && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "User Role Assignments" }), _jsx("div", { className: "space-y-3", children: rbacData.users.map((user) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-slate-700/30 rounded-lg", children: [_jsxs("div", { children: [_jsx("p", { className: "text-white font-medium", children: user.email }), _jsx("p", { className: "text-sm text-slate-400", children: user.roleName })] }), _jsx("span", { className: "text-xs px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded", children: user.role })] }, user.userId))) })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Available Roles" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: rbacData.roles.map((role) => (_jsxs("div", { className: "p-4 bg-slate-700/30 rounded-lg border border-slate-600", children: [_jsx("p", { className: "text-white font-medium mb-2", children: role.name }), _jsx("p", { className: "text-sm text-slate-400 mb-3", children: role.description }), _jsx("div", { className: "flex flex-wrap gap-1", children: (role.permissions[0] === '*' ? ['ALL PERMISSIONS'] : role.permissions.slice(0, 5)).map((perm) => (_jsx("span", { className: "text-xs px-2 py-0.5 bg-slate-600 text-slate-300 rounded", children: perm }, perm))) })] }, role.name))) })] })] }))] }))] }) }));
}
