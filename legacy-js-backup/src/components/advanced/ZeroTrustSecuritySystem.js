import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒ¢í∩╕Å ZERO-TRUST SECURITY SYSTEM - Enterprise Grade Security Architecture
// WebAuthn ΓÇó RBAC/ABAC ΓÇó JWT Tokens ΓÇó CSRF Protection ΓÇó Rate Limiting ΓÇó Audit Logging
import { useState } from 'react';
import { Shield, ShieldCheck, Key, Fingerprint, AlertTriangle, CheckCircle, XCircle, User, Users, Activity, BarChart3, RefreshCw, Monitor, Ban, AlertCircle, TrendingUp, Download } from 'lucide-react';
const ZeroTrustSecuritySystem = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    // Security Dashboard State
    const [securityMetrics] = useState({
        threatLevel: 'medium',
        activeThreats: 12,
        blockedAttacks: 247,
        activeSessions: 45,
        policyViolations: 8,
        riskScore: 68
    });
    // Security Policies State
    const [securityPolicies] = useState([
        {
            id: '1',
            name: 'Multi-Factor Authentication',
            type: 'authentication',
            status: 'active',
            lastUpdated: new Date(Date.now() - 86400000),
            violations: 0
        },
        {
            id: '2',
            name: 'Password Complexity Policy',
            type: 'authentication',
            status: 'active',
            lastUpdated: new Date(Date.now() - 172800000),
            violations: 3
        },
        {
            id: '3',
            name: 'Rate Limiting Protection',
            type: 'network',
            status: 'warning',
            lastUpdated: new Date(Date.now() - 3600000),
            violations: 15
        },
        {
            id: '4',
            name: 'Data Encryption at Rest',
            type: 'data',
            status: 'active',
            lastUpdated: new Date(Date.now() - 259200000),
            violations: 0
        }
    ]);
    // User Sessions State
    const [userSessions, setUserSessions] = useState([
        {
            id: '1',
            userId: 'user_001',
            email: 'editor@newspulse.ai',
            role: 'Editor',
            ipAddress: '192.168.1.100',
            location: 'Mumbai, India',
            device: 'Chrome on Windows',
            loginTime: new Date(Date.now() - 7200000),
            lastActivity: new Date(Date.now() - 600000),
            riskScore: 25,
            mfaEnabled: true,
            status: 'active'
        },
        {
            id: '2',
            userId: 'user_002',
            email: 'reporter@newspulse.ai',
            role: 'Reporter',
            ipAddress: '10.0.1.50',
            location: 'Delhi, India',
            device: 'Safari on macOS',
            loginTime: new Date(Date.now() - 14400000),
            lastActivity: new Date(Date.now() - 300000),
            riskScore: 15,
            mfaEnabled: true,
            status: 'active'
        },
        {
            id: '3',
            userId: 'user_003',
            email: 'unknown@suspicious.com',
            role: 'Guest',
            ipAddress: '203.0.113.195',
            location: 'Unknown',
            device: 'Unknown Browser',
            loginTime: new Date(Date.now() - 1800000),
            lastActivity: new Date(Date.now() - 120000),
            riskScore: 95,
            mfaEnabled: false,
            status: 'suspicious'
        }
    ]);
    // Security Events State
    const [securityEvents, setSecurityEvents] = useState([
        {
            id: '1',
            type: 'suspicious_activity',
            severity: 'high',
            user: 'unknown@suspicious.com',
            description: 'Multiple failed login attempts from unknown IP',
            timestamp: new Date(Date.now() - 900000),
            ipAddress: '203.0.113.195',
            location: 'Unknown',
            resolved: false
        },
        {
            id: '2',
            type: 'policy_violation',
            severity: 'medium',
            user: 'reporter@newspulse.ai',
            description: 'Attempted access to restricted resource',
            timestamp: new Date(Date.now() - 1800000),
            ipAddress: '10.0.1.50',
            location: 'Delhi, India',
            resolved: true
        },
        {
            id: '3',
            type: 'login_attempt',
            severity: 'low',
            user: 'editor@newspulse.ai',
            description: 'Successful login with MFA verification',
            timestamp: new Date(Date.now() - 7200000),
            ipAddress: '192.168.1.100',
            location: 'Mumbai, India',
            resolved: true
        }
    ]);
    // RBAC Permissions State
    const [rolePermissions] = useState([
        {
            id: '1',
            role: 'Founder',
            resource: 'all_resources',
            actions: ['create', 'read', 'update', 'delete', 'admin'],
            conditions: ['always'],
            granted: true
        },
        {
            id: '2',
            role: 'Editor',
            resource: 'articles',
            actions: ['create', 'read', 'update', 'publish'],
            conditions: ['business_hours', 'approved_content'],
            granted: true
        },
        {
            id: '3',
            role: 'Reporter',
            resource: 'articles',
            actions: ['create', 'read', 'update'],
            conditions: ['business_hours', 'own_content'],
            granted: true
        },
        {
            id: '4',
            role: 'Guest',
            resource: 'articles',
            actions: ['read'],
            conditions: ['public_content'],
            granted: false
        }
    ]);
    const getThreatLevelColor = (level) => {
        switch (level) {
            case 'low': return 'text-green-400 bg-green-900/20 border-green-500/50';
            case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/50';
            case 'high': return 'text-orange-400 bg-orange-900/20 border-orange-500/50';
            case 'critical': return 'text-red-400 bg-red-900/20 border-red-500/50';
            default: return 'text-gray-400 bg-gray-900/20 border-gray-500/50';
        }
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'active': return _jsx(CheckCircle, { className: "w-5 h-5 text-green-400" });
            case 'warning': return _jsx(AlertTriangle, { className: "w-5 h-5 text-yellow-400" });
            case 'inactive': return _jsx(XCircle, { className: "w-5 h-5 text-red-400" });
            case 'suspicious': return _jsx(AlertTriangle, { className: "w-5 h-5 text-red-400" });
            case 'blocked': return _jsx(Ban, { className: "w-5 h-5 text-red-400" });
            default: return _jsx(AlertCircle, { className: "w-5 h-5 text-gray-400" });
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
    const getRiskScoreColor = (score) => {
        if (score >= 80)
            return 'text-red-400';
        if (score >= 60)
            return 'text-orange-400';
        if (score >= 40)
            return 'text-yellow-400';
        return 'text-green-400';
    };
    const blockSession = (sessionId) => {
        setUserSessions(prev => prev.map(session => session.id === sessionId
            ? { ...session, status: 'blocked' }
            : session));
    };
    const resolveEvent = (eventId) => {
        setSecurityEvents(prev => prev.map(event => event.id === eventId
            ? { ...event, resolved: true }
            : event));
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 text-white", children: [_jsx("div", { className: "bg-gradient-to-r from-red-900/30 to-orange-900/30 border-b border-red-700/30", children: _jsx("div", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "p-3 bg-red-600/20 rounded-lg border border-red-500/30", children: _jsx(Shield, { className: "w-8 h-8 text-red-400" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-white", children: "\uD83D\uDEE1\uFE0F ZERO-TRUST SECURITY SYSTEM" }), _jsx("p", { className: "text-red-300 mt-1", children: "Enterprise Security \u2022 WebAuthn \u2022 RBAC/ABAC \u2022 Comprehensive Audit Logging" })] })] }), _jsx("div", { className: "flex items-center space-x-4", children: _jsxs("div", { className: `px-4 py-2 rounded-lg border-2 font-semibold ${getThreatLevelColor(securityMetrics.threatLevel)}`, children: ["THREAT LEVEL: ", securityMetrics.threatLevel.toUpperCase()] }) })] }) }) }), _jsxs("div", { className: "p-6", children: [_jsx("div", { className: "mb-8", children: _jsx("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-2", children: _jsx("div", { className: "grid grid-cols-5 gap-2", children: [
                                    { id: 'dashboard', label: 'Security Dashboard', icon: BarChart3 },
                                    { id: 'policies', label: 'Security Policies', icon: ShieldCheck },
                                    { id: 'sessions', label: 'User Sessions', icon: Users },
                                    { id: 'audit', label: 'Audit Logs', icon: Activity },
                                    { id: 'rbac', label: 'RBAC/ABAC', icon: Key }
                                ].map(({ id, label, icon: Icon }) => (_jsxs("button", { onClick: () => setActiveTab(id), className: `p-4 rounded-lg transition-all ${activeTab === id
                                        ? 'bg-red-600/30 border border-red-500/50 text-red-300'
                                        : 'bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-600/30'}`, children: [_jsx(Icon, { className: "w-5 h-5 mx-auto mb-2" }), _jsx("p", { className: "text-xs font-semibold", children: label })] }, id))) }) }) }), activeTab === 'dashboard' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-bold text-white", children: "Active Threats" }), _jsx(AlertTriangle, { className: "w-6 h-6 text-red-400" })] }), _jsx("div", { className: "text-3xl font-bold text-red-400 mb-2", children: securityMetrics.activeThreats }), _jsx("p", { className: "text-sm text-slate-400", children: "Requires immediate attention" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-bold text-white", children: "Blocked Attacks" }), _jsx(ShieldCheck, { className: "w-6 h-6 text-green-400" })] }), _jsx("div", { className: "text-3xl font-bold text-green-400 mb-2", children: securityMetrics.blockedAttacks }), _jsx("p", { className: "text-sm text-slate-400", children: "Last 24 hours" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-bold text-white", children: "Active Sessions" }), _jsx(Users, { className: "w-6 h-6 text-blue-400" })] }), _jsx("div", { className: "text-3xl font-bold text-blue-400 mb-2", children: securityMetrics.activeSessions }), _jsx("p", { className: "text-sm text-slate-400", children: "Currently online" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-bold text-white", children: "Policy Violations" }), _jsx(Ban, { className: "w-6 h-6 text-orange-400" })] }), _jsx("div", { className: "text-3xl font-bold text-orange-400 mb-2", children: securityMetrics.policyViolations }), _jsx("p", { className: "text-sm text-slate-400", children: "This week" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-bold text-white", children: "Risk Score" }), _jsx(TrendingUp, { className: "w-6 h-6 text-yellow-400" })] }), _jsxs("div", { className: `text-3xl font-bold mb-2 ${getRiskScoreColor(securityMetrics.riskScore)}`, children: [securityMetrics.riskScore, "%"] }), _jsx("p", { className: "text-sm text-slate-400", children: "Overall system risk" })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-bold text-white", children: "System Status" }), _jsx(Monitor, { className: "w-6 h-6 text-green-400" })] }), _jsx("div", { className: "text-xl font-bold text-green-400 mb-2", children: "OPERATIONAL" }), _jsx("p", { className: "text-sm text-slate-400", children: "All systems nominal" })] })] }), _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white mb-6 flex items-center", children: [_jsx(Activity, { className: "w-6 h-6 text-blue-400 mr-3" }), "REAL-TIME SECURITY FEED"] }), _jsx("div", { className: "space-y-4 max-h-96 overflow-y-auto", children: securityEvents.slice(0, 10).map((event) => (_jsxs("div", { className: "flex items-start justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600/30", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("span", { className: `px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(event.severity)}`, children: event.severity.toUpperCase() }), _jsxs("div", { children: [_jsx("p", { className: "text-white font-medium", children: event.description }), _jsxs("div", { className: "text-xs text-slate-400 mt-1", children: [_jsxs("p", { children: ["User: ", event.user, " \u2022 IP: ", event.ipAddress, " \u2022 ", event.location] }), _jsxs("p", { children: ["Time: ", event.timestamp.toLocaleString()] })] })] })] }), !event.resolved && (_jsx("button", { onClick: () => resolveEvent(event.id), className: "px-3 py-1 bg-green-600/20 text-green-300 rounded text-xs hover:bg-green-600/30 transition-colors", children: "Resolve" }))] }, event.id))) })] })] })), activeTab === 'policies' && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white flex items-center", children: [_jsx(ShieldCheck, { className: "w-6 h-6 text-green-400 mr-3" }), "SECURITY POLICIES MANAGEMENT"] }), _jsx("button", { className: "px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors", children: "Add Policy" })] }), _jsx("div", { className: "space-y-4", children: securityPolicies.map((policy) => (_jsxs("div", { className: "p-4 bg-slate-700/30 rounded-lg border border-slate-600/30", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [getStatusIcon(policy.status), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold text-white", children: policy.name }), _jsxs("p", { className: "text-sm text-slate-400 capitalize", children: [policy.type, " Policy"] })] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("p", { className: "text-sm text-slate-300", children: [policy.violations, " violations"] }), _jsxs("p", { className: "text-xs text-slate-400", children: ["Updated: ", policy.lastUpdated.toLocaleDateString()] })] })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { className: "px-3 py-1 bg-blue-600/20 text-blue-300 rounded text-sm hover:bg-blue-600/30 transition-colors", children: "Edit" }), _jsx("button", { className: "px-3 py-1 bg-green-600/20 text-green-300 rounded text-sm hover:bg-green-600/30 transition-colors", children: "Test" }), _jsx("button", { className: "px-3 py-1 bg-yellow-600/20 text-yellow-300 rounded text-sm hover:bg-yellow-600/30 transition-colors", children: "Audit" })] })] }, policy.id))) })] }) })), activeTab === 'sessions' && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white mb-6 flex items-center", children: [_jsx(Users, { className: "w-6 h-6 text-blue-400 mr-3" }), "ACTIVE USER SESSIONS"] }), _jsx("div", { className: "space-y-4", children: userSessions.map((session) => (_jsxs("div", { className: "p-4 bg-slate-700/30 rounded-lg border border-slate-600/30", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "p-2 bg-blue-600/20 rounded-lg", children: _jsx(User, { className: "w-5 h-5 text-blue-400" }) }), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold text-white", children: session.email }), _jsxs("p", { className: "text-sm text-slate-400", children: [session.role, " \u2022 ", session.device] })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [session.mfaEnabled && (_jsxs("div", { className: "flex items-center space-x-1 text-green-400", children: [_jsx(Fingerprint, { className: "w-4 h-4" }), _jsx("span", { className: "text-xs", children: "MFA" })] })), getStatusIcon(session.status)] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-slate-400", children: "IP Address" }), _jsx("p", { className: "text-white font-mono", children: session.ipAddress })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-400", children: "Location" }), _jsx("p", { className: "text-white", children: session.location })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-400", children: "Login Time" }), _jsx("p", { className: "text-white", children: session.loginTime.toLocaleTimeString() })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-400", children: "Risk Score" }), _jsxs("p", { className: `font-bold ${getRiskScoreColor(session.riskScore)}`, children: [session.riskScore, "%"] })] })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { className: "px-3 py-1 bg-blue-600/20 text-blue-300 rounded text-sm hover:bg-blue-600/30 transition-colors", children: "View Details" }), session.status === 'suspicious' && (_jsx("button", { onClick: () => blockSession(session.id), className: "px-3 py-1 bg-red-600/20 text-red-300 rounded text-sm hover:bg-red-600/30 transition-colors", children: "Block Session" })), _jsx("button", { className: "px-3 py-1 bg-yellow-600/20 text-yellow-300 rounded text-sm hover:bg-yellow-600/30 transition-colors", children: "Force Logout" })] })] }, session.id))) })] }) })), activeTab === 'audit' && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white flex items-center", children: [_jsx(Activity, { className: "w-6 h-6 text-purple-400 mr-3" }), "COMPREHENSIVE AUDIT LOGS"] }), _jsxs("div", { className: "flex space-x-2", children: [_jsxs("button", { className: "px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors flex items-center", children: [_jsx(Download, { className: "w-4 h-4 mr-2" }), "Export"] }), _jsxs("button", { className: "px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors flex items-center", children: [_jsx(RefreshCw, { className: "w-4 h-4 mr-2" }), "Refresh"] })] })] }), _jsx("div", { className: "space-y-4 max-h-96 overflow-y-auto", children: securityEvents.map((event) => (_jsxs("div", { className: "p-4 bg-slate-700/30 rounded-lg border border-slate-600/30", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("span", { className: `px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(event.severity)}`, children: event.severity.toUpperCase() }), _jsx("span", { className: "px-2 py-1 bg-slate-600 text-slate-300 rounded-full text-xs font-semibold", children: event.type.replace('_', ' ').toUpperCase() })] }), event.resolved ? (_jsx(CheckCircle, { className: "w-5 h-5 text-green-400" })) : (_jsx(AlertCircle, { className: "w-5 h-5 text-red-400" }))] }), _jsx("p", { className: "text-white font-medium mb-2", children: event.description }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-400", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "User:" }), " ", event.user] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "IP:" }), " ", event.ipAddress] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Location:" }), " ", event.location] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Time:" }), " ", event.timestamp.toLocaleString()] })] })] }, event.id))) })] }) })), activeTab === 'rbac' && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("h3", { className: "text-xl font-bold text-white flex items-center", children: [_jsx(Key, { className: "w-6 h-6 text-yellow-400 mr-3" }), "ROLE-BASED ACCESS CONTROL (RBAC/ABAC)"] }), _jsx("button", { className: "px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors", children: "Add Permission" })] }), _jsx("div", { className: "space-y-4", children: rolePermissions.map((permission) => (_jsxs("div", { className: "p-4 bg-slate-700/30 rounded-lg border border-slate-600/30", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold text-white", children: permission.role }), _jsxs("p", { className: "text-sm text-slate-400", children: ["Resource: ", permission.resource] })] }), _jsx("div", { className: "flex items-center space-x-2", children: permission.granted ? (_jsx("span", { className: "px-3 py-1 bg-green-600/20 text-green-300 rounded-full text-sm font-semibold", children: "GRANTED" })) : (_jsx("span", { className: "px-3 py-1 bg-red-600/20 text-red-300 rounded-full text-sm font-semibold", children: "DENIED" })) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-slate-400 mb-2", children: "Allowed Actions:" }), _jsx("div", { className: "flex flex-wrap gap-1", children: permission.actions.map((action, index) => (_jsx("span", { className: "px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs", children: action }, index))) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-slate-400 mb-2", children: "Conditions:" }), _jsx("div", { className: "flex flex-wrap gap-1", children: permission.conditions.map((condition, index) => (_jsx("span", { className: "px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs", children: condition }, index))) })] })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { className: "px-3 py-1 bg-blue-600/20 text-blue-300 rounded text-sm hover:bg-blue-600/30 transition-colors", children: "Edit" }), _jsx("button", { className: "px-3 py-1 bg-green-600/20 text-green-300 rounded text-sm hover:bg-green-600/30 transition-colors", children: "Test Access" }), _jsx("button", { className: "px-3 py-1 bg-yellow-600/20 text-yellow-300 rounded text-sm hover:bg-yellow-600/30 transition-colors", children: "Audit Trail" })] })] }, permission.id))) })] }) }))] })] }));
};
export default ZeroTrustSecuritySystem;
