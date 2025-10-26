// 🛡️ ZERO-TRUST SECURITY SYSTEM - Enterprise Grade Security Architecture
// WebAuthn • RBAC/ABAC • JWT Tokens • CSRF Protection • Rate Limiting • Audit Logging

import React, { useState } from 'react';
import { 
  Shield, ShieldCheck, Key, Fingerprint, AlertTriangle,
  CheckCircle, XCircle, User, Users, Activity, BarChart3,
  RefreshCw, Monitor, Ban, AlertCircle, TrendingUp, Download
} from 'lucide-react';

interface SecurityPolicy {
  id: string;
  name: string;
  type: 'authentication' | 'authorization' | 'network' | 'data';
  status: 'active' | 'inactive' | 'warning';
  lastUpdated: Date;
  violations: number;
}

interface UserSession {
  id: string;
  userId: string;
  email: string;
  role: string;
  ipAddress: string;
  location: string;
  device: string;
  loginTime: Date;
  lastActivity: Date;
  riskScore: number;
  mfaEnabled: boolean;
  status: 'active' | 'suspicious' | 'blocked';
}

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'permission_denied' | 'suspicious_activity' | 'policy_violation' | 'data_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user: string;
  description: string;
  timestamp: Date;
  ipAddress: string;
  location: string;
  resolved: boolean;
}

interface RolePermission {
  id: string;
  role: string;
  resource: string;
  actions: string[];
  conditions: string[];
  granted: boolean;
}

const ZeroTrustSecuritySystem: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'policies' | 'sessions' | 'audit' | 'rbac'>('dashboard');

  // Security Dashboard State
  const [securityMetrics] = useState({
    threatLevel: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    activeThreats: 12,
    blockedAttacks: 247,
    activeSessions: 45,
    policyViolations: 8,
    riskScore: 68
  });

  // Security Policies State
  const [securityPolicies] = useState<SecurityPolicy[]>([
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
  const [userSessions, setUserSessions] = useState<UserSession[]>([
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
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([
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
  const [rolePermissions] = useState<RolePermission[]>([
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

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-900/20 border-green-500/50';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/50';
      case 'high': return 'text-orange-400 bg-orange-900/20 border-orange-500/50';
      case 'critical': return 'text-red-400 bg-red-900/20 border-red-500/50';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'inactive': return <XCircle className="w-5 h-5 text-red-400" />;
      case 'suspicious': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'blocked': return <Ban className="w-5 h-5 text-red-400" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 60) return 'text-orange-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-green-400';
  };

  const blockSession = (sessionId: string) => {
    setUserSessions(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'blocked' as const }
          : session
      )
    );
  };

  const resolveEvent = (eventId: string) => {
    setSecurityEvents(prev =>
      prev.map(event =>
        event.id === eventId
          ? { ...event, resolved: true }
          : event
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 text-white">
      {/* Security Header */}
      <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border-b border-red-700/30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-600/20 rounded-lg border border-red-500/30">
                <Shield className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  🛡️ ZERO-TRUST SECURITY SYSTEM
                </h1>
                <p className="text-red-300 mt-1">
                  Enterprise Security • WebAuthn • RBAC/ABAC • Comprehensive Audit Logging
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`px-4 py-2 rounded-lg border-2 font-semibold ${getThreatLevelColor(securityMetrics.threatLevel)}`}>
                THREAT LEVEL: {securityMetrics.threatLevel.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-2">
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'dashboard', label: 'Security Dashboard', icon: BarChart3 },
                { id: 'policies', label: 'Security Policies', icon: ShieldCheck },
                { id: 'sessions', label: 'User Sessions', icon: Users },
                { id: 'audit', label: 'Audit Logs', icon: Activity },
                { id: 'rbac', label: 'RBAC/ABAC', icon: Key }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`p-4 rounded-lg transition-all ${
                    activeTab === id
                      ? 'bg-red-600/30 border border-red-500/50 text-red-300'
                      : 'bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-600/30'
                  }`}
                >
                  <Icon className="w-5 h-5 mx-auto mb-2" />
                  <p className="text-xs font-semibold">{label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Security Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Active Threats</h3>
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div className="text-3xl font-bold text-red-400 mb-2">
                  {securityMetrics.activeThreats}
                </div>
                <p className="text-sm text-slate-400">Requires immediate attention</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Blocked Attacks</h3>
                  <ShieldCheck className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-green-400 mb-2">
                  {securityMetrics.blockedAttacks}
                </div>
                <p className="text-sm text-slate-400">Last 24 hours</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Active Sessions</h3>
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-blue-400 mb-2">
                  {securityMetrics.activeSessions}
                </div>
                <p className="text-sm text-slate-400">Currently online</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Policy Violations</h3>
                  <Ban className="w-6 h-6 text-orange-400" />
                </div>
                <div className="text-3xl font-bold text-orange-400 mb-2">
                  {securityMetrics.policyViolations}
                </div>
                <p className="text-sm text-slate-400">This week</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Risk Score</h3>
                  <TrendingUp className="w-6 h-6 text-yellow-400" />
                </div>
                <div className={`text-3xl font-bold mb-2 ${getRiskScoreColor(securityMetrics.riskScore)}`}>
                  {securityMetrics.riskScore}%
                </div>
                <p className="text-sm text-slate-400">Overall system risk</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">System Status</h3>
                  <Monitor className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-xl font-bold text-green-400 mb-2">
                  OPERATIONAL
                </div>
                <p className="text-sm text-slate-400">All systems nominal</p>
              </div>
            </div>

            {/* Real-time Security Feed */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                <Activity className="w-6 h-6 text-blue-400 mr-3" />
                REAL-TIME SECURITY FEED
              </h3>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {securityEvents.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex items-start justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <div className="flex items-start space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(event.severity)}`}>
                        {event.severity.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-white font-medium">{event.description}</p>
                        <div className="text-xs text-slate-400 mt-1">
                          <p>User: {event.user} • IP: {event.ipAddress} • {event.location}</p>
                          <p>Time: {event.timestamp.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    {!event.resolved && (
                      <button
                        onClick={() => resolveEvent(event.id)}
                        className="px-3 py-1 bg-green-600/20 text-green-300 rounded text-xs hover:bg-green-600/30 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Security Policies Tab */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <ShieldCheck className="w-6 h-6 text-green-400 mr-3" />
                  SECURITY POLICIES MANAGEMENT
                </h3>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors">
                  Add Policy
                </button>
              </div>
              
              <div className="space-y-4">
                {securityPolicies.map((policy) => (
                  <div key={policy.id} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(policy.status)}
                        <div>
                          <h4 className="text-lg font-semibold text-white">{policy.name}</h4>
                          <p className="text-sm text-slate-400 capitalize">{policy.type} Policy</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-300">
                          {policy.violations} violations
                        </p>
                        <p className="text-xs text-slate-400">
                          Updated: {policy.lastUpdated.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded text-sm hover:bg-blue-600/30 transition-colors">
                        Edit
                      </button>
                      <button className="px-3 py-1 bg-green-600/20 text-green-300 rounded text-sm hover:bg-green-600/30 transition-colors">
                        Test
                      </button>
                      <button className="px-3 py-1 bg-yellow-600/20 text-yellow-300 rounded text-sm hover:bg-yellow-600/30 transition-colors">
                        Audit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                <Users className="w-6 h-6 text-blue-400 mr-3" />
                ACTIVE USER SESSIONS
              </h3>
              
              <div className="space-y-4">
                {userSessions.map((session) => (
                  <div key={session.id} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                          <User className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">{session.email}</h4>
                          <p className="text-sm text-slate-400">{session.role} • {session.device}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {session.mfaEnabled && (
                          <div className="flex items-center space-x-1 text-green-400">
                            <Fingerprint className="w-4 h-4" />
                            <span className="text-xs">MFA</span>
                          </div>
                        )}
                        {getStatusIcon(session.status)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                      <div>
                        <p className="text-slate-400">IP Address</p>
                        <p className="text-white font-mono">{session.ipAddress}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Location</p>
                        <p className="text-white">{session.location}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Login Time</p>
                        <p className="text-white">{session.loginTime.toLocaleTimeString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Risk Score</p>
                        <p className={`font-bold ${getRiskScoreColor(session.riskScore)}`}>
                          {session.riskScore}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded text-sm hover:bg-blue-600/30 transition-colors">
                        View Details
                      </button>
                      {session.status === 'suspicious' && (
                        <button
                          onClick={() => blockSession(session.id)}
                          className="px-3 py-1 bg-red-600/20 text-red-300 rounded text-sm hover:bg-red-600/30 transition-colors"
                        >
                          Block Session
                        </button>
                      )}
                      <button className="px-3 py-1 bg-yellow-600/20 text-yellow-300 rounded text-sm hover:bg-yellow-600/30 transition-colors">
                        Force Logout
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <Activity className="w-6 h-6 text-purple-400 mr-3" />
                  COMPREHENSIVE AUDIT LOGS
                </h3>
                <div className="flex space-x-2">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                  <button className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors flex items-center">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {securityEvents.map((event) => (
                  <div key={event.id} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(event.severity)}`}>
                          {event.severity.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 bg-slate-600 text-slate-300 rounded-full text-xs font-semibold">
                          {event.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      {event.resolved ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    
                    <p className="text-white font-medium mb-2">{event.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-400">
                      <div>
                        <span className="font-medium">User:</span> {event.user}
                      </div>
                      <div>
                        <span className="font-medium">IP:</span> {event.ipAddress}
                      </div>
                      <div>
                        <span className="font-medium">Location:</span> {event.location}
                      </div>
                      <div>
                        <span className="font-medium">Time:</span> {event.timestamp.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RBAC/ABAC Tab */}
        {activeTab === 'rbac' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <Key className="w-6 h-6 text-yellow-400 mr-3" />
                  ROLE-BASED ACCESS CONTROL (RBAC/ABAC)
                </h3>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors">
                  Add Permission
                </button>
              </div>
              
              <div className="space-y-4">
                {rolePermissions.map((permission) => (
                  <div key={permission.id} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{permission.role}</h4>
                        <p className="text-sm text-slate-400">Resource: {permission.resource}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {permission.granted ? (
                          <span className="px-3 py-1 bg-green-600/20 text-green-300 rounded-full text-sm font-semibold">
                            GRANTED
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-red-600/20 text-red-300 rounded-full text-sm font-semibold">
                            DENIED
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-slate-400 mb-2">Allowed Actions:</p>
                        <div className="flex flex-wrap gap-1">
                          {permission.actions.map((action, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs">
                              {action}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 mb-2">Conditions:</p>
                        <div className="flex flex-wrap gap-1">
                          {permission.conditions.map((condition, index) => (
                            <span key={index} className="px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs">
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded text-sm hover:bg-blue-600/30 transition-colors">
                        Edit
                      </button>
                      <button className="px-3 py-1 bg-green-600/20 text-green-300 rounded text-sm hover:bg-green-600/30 transition-colors">
                        Test Access
                      </button>
                      <button className="px-3 py-1 bg-yellow-600/20 text-yellow-300 rounded text-sm hover:bg-yellow-600/30 transition-colors">
                        Audit Trail
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZeroTrustSecuritySystem;