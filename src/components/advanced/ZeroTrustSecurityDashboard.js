import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 🛡️ Enhanced Zero-Trust Security System with Real Backend Integration
import { useEffect, useState } from 'react';
import apiClient from '../../lib/api';
import { Shield, Users, Activity, Lock, AlertTriangle, CheckCircle, XCircle, UserX } from 'lucide-react';
export default function ZeroTrustSecurityDashboard() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [metrics, setMetrics] = useState(null);
    const [auditLog, setAuditLog] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [rbacUsers, setRbacUsers] = useState([]);
    const [roles, setRoles] = useState({});
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        loadData();
    }, [activeTab]);
    async function loadData() {
        setLoading(true);
        try {
            if (activeTab === 'dashboard' || activeTab === 'audit') {
                const auditRes = await apiClient.get('/security/audit?limit=50');
                setAuditLog(auditRes.data?.entries || []);
                const statsRes = await apiClient.get('/security/audit/stats');
                setMetrics({
                    threatLevel: 'low',
                    activeSessions: statsRes.data?.stats?.totalEvents || 0,
                    failedLogins24h: 0,
                    auditEvents24h: statsRes.data?.stats?.last24h || 0,
                    blockedIPs: 0,
                });
            }
            if (activeTab === 'sessions') {
                const sessRes = await apiClient.get('/security/sessions');
                setSessions(sessRes.data?.sessions || []);
            }
            if (activeTab === 'rbac') {
                const [usersRes, rolesRes] = await Promise.all([
                    apiClient.get('/security/rbac/users'),
                    apiClient.get('/security/rbac/roles'),
                ]);
                setRbacUsers(usersRes.data?.users || []);
                setRoles(rolesRes.data?.roles || {});
            }
        }
        catch (err) {
            console.error('Failed to load security data:', err);
        }
        finally {
            setLoading(false);
        }
    }
    async function revokeSession(sessionId) {
        try {
            await apiClient.delete(`/security/sessions/${sessionId}`);
            alert('Session revoked successfully');
            loadData();
        }
        catch (err) {
            console.error('Failed to revoke session:', err);
            alert('Failed to revoke session');
        }
    }
    function getThreatColor(level) {
        if (level === 'high')
            return 'text-red-600 bg-red-50';
        if (level === 'medium')
            return 'text-yellow-600 bg-yellow-50';
        return 'text-green-600 bg-green-50';
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-3xl font-bold flex items-center gap-2", children: [_jsx(Shield, { className: "text-blue-600" }), "Zero-Trust Security"] }), _jsx("button", { onClick: loadData, className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", children: "Refresh" })] }), _jsx("div", { className: "flex gap-2 border-b border-gray-300 dark:border-gray-600", children: ['dashboard', 'audit', 'sessions', 'rbac'].map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab), className: `px-4 py-2 font-medium transition ${activeTab === tab
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'}`, children: [tab === 'dashboard' && '📊 Dashboard', tab === 'audit' && '📋 Audit Trail', tab === 'sessions' && '🔐 Sessions', tab === 'rbac' && '👥 RBAC'] }, tab))) }), loading ? (_jsx("div", { className: "text-center py-12", children: "Loading security data..." })) : (_jsxs(_Fragment, { children: [activeTab === 'dashboard' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-500", children: "Threat Level" }), _jsx("div", { className: `text-2xl font-bold ${getThreatColor(metrics?.threatLevel || 'low')}`, children: metrics?.threatLevel?.toUpperCase() })] }), _jsx(Shield, { className: "text-gray-400", size: 32 })] }) }), _jsx("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-500", children: "Active Sessions" }), _jsx("div", { className: "text-2xl font-bold", children: sessions.length })] }), _jsx(Users, { className: "text-gray-400", size: 32 })] }) }), _jsx("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-500", children: "Audit Events (24h)" }), _jsx("div", { className: "text-2xl font-bold", children: metrics?.auditEvents24h })] }), _jsx(Activity, { className: "text-gray-400", size: 32 })] }) }), _jsx("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-500", children: "Failed Logins" }), _jsx("div", { className: "text-2xl font-bold", children: metrics?.failedLogins24h })] }), _jsx(Lock, { className: "text-gray-400", size: 32 })] }) })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Recent Security Events" }), _jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto", children: auditLog.slice(0, 10).map((entry) => (_jsxs("div", { className: "flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded", children: [_jsxs("div", { className: "flex-shrink-0", children: [entry.action === 'login' && _jsx(CheckCircle, { className: "text-green-600", size: 20 }), entry.action === 'role_change' && _jsx(AlertTriangle, { className: "text-yellow-600", size: 20 }), entry.action === 'delete' && _jsx(XCircle, { className: "text-red-600", size: 20 }), !['login', 'role_change', 'delete'].includes(entry.action) && _jsx(Activity, { className: "text-blue-600", size: 20 })] }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium", children: entry.actor }), _jsxs("div", { className: "text-sm text-gray-600 dark:text-gray-400", children: [entry.action, " on ", entry.entity, " ", entry.entityId ? `(${entry.entityId})` : ''] }), _jsxs("div", { className: "text-xs text-gray-500", children: [new Date(entry.timestamp).toLocaleString(), " \u2022 ", entry.ip] })] })] }, entry.id))) })] })] })), activeTab === 'audit' && (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Complete Audit Trail" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b dark:border-gray-700", children: [_jsx("th", { className: "text-left p-2", children: "Timestamp" }), _jsx("th", { className: "text-left p-2", children: "Actor" }), _jsx("th", { className: "text-left p-2", children: "Action" }), _jsx("th", { className: "text-left p-2", children: "Entity" }), _jsx("th", { className: "text-left p-2", children: "IP" }), _jsx("th", { className: "text-left p-2", children: "Details" })] }) }), _jsx("tbody", { children: auditLog.map((entry) => (_jsxs("tr", { className: "border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700", children: [_jsx("td", { className: "p-2", children: new Date(entry.timestamp).toLocaleString() }), _jsx("td", { className: "p-2", children: entry.actor }), _jsx("td", { className: "p-2", children: _jsx("span", { className: "px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs", children: entry.action }) }), _jsx("td", { className: "p-2", children: entry.entity }), _jsx("td", { className: "p-2", children: entry.ip }), _jsxs("td", { className: "p-2 text-xs text-gray-600 dark:text-gray-400", children: [entry.entityId && `ID: ${entry.entityId}`, entry.metadata && Object.keys(entry.metadata).length > 0 && (_jsxs("span", { className: "ml-2", children: ["\u2022 ", JSON.stringify(entry.metadata).substring(0, 50), "..."] }))] })] }, entry.id))) })] }) })] })), activeTab === 'sessions' && (_jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-xl font-semibold", children: "Active Sessions" }), sessions.map((session) => (_jsx("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "font-semibold text-lg", children: session.email }), _jsxs("div", { className: "text-sm text-gray-600 dark:text-gray-400 space-y-1", children: [_jsxs("div", { children: ["\uD83D\uDCCD ", session.location] }), _jsxs("div", { children: ["\uD83D\uDCBB ", session.device, " \u2022 ", session.browser] }), _jsxs("div", { children: ["\uD83C\uDF10 ", session.ip] }), _jsxs("div", { children: ["\u23F0 Created: ", new Date(session.createdAt).toLocaleString()] }), _jsxs("div", { children: ["\uD83D\uDD52 Last Activity: ", new Date(session.lastActivity).toLocaleString()] })] })] }), _jsxs("button", { onClick: () => revokeSession(session.id), className: "px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2", children: [_jsx(UserX, { size: 16 }), "Revoke"] })] }) }, session.id)))] })), activeTab === 'rbac' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "User Roles & Permissions" }), rbacUsers.map((user) => (_jsx("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow mb-4", children: _jsx("div", { className: "flex items-start justify-between", children: _jsxs("div", { children: [_jsx("div", { className: "font-semibold", children: user.email }), _jsxs("div", { className: "text-sm text-gray-600 dark:text-gray-400", children: ["Role: ", _jsx("span", { className: "font-medium text-blue-600", children: user.roleName })] }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-1", children: [user.permissions.slice(0, 5).map((perm, idx) => (_jsx("span", { className: "px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs", children: perm }, idx))), user.permissions.length > 5 && (_jsxs("span", { className: "px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs", children: ["+", user.permissions.length - 5, " more"] }))] })] }) }) }, user.userId)))] }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Available Roles" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: Object.entries(roles).map(([key, role]) => (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "font-semibold text-lg", children: role.name }), _jsx("div", { className: "text-sm text-gray-600 dark:text-gray-400 mb-2", children: role.description }), _jsx("div", { className: "text-xs text-gray-500", children: role.permissions.includes('*') ? (_jsx("span", { className: "text-red-600 font-bold", children: "FULL ACCESS" })) : (`${role.permissions.length} permissions`) })] }, key))) })] })] }))] }))] }));
}
