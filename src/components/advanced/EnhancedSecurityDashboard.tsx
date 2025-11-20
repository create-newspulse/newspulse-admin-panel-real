// 🛡️ Enhanced Zero-Trust Security System (Phase 2: WebAuthn + Rate Limiting)
import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { 
  Shield, Users, Activity, Lock, AlertTriangle, CheckCircle, XCircle,
  Key, Smartphone, Zap, Ban, TrendingUp, Globe
} from 'lucide-react';

// Uses shared api client; all endpoints are prefixed with '/api'

type Tab = 'dashboard' | 'audit' | 'sessions' | 'rbac' | 'webauthn' | 'rate-limit';

type WebAuthnCredential = {
  id: string;
  device: {
    name: string;
    type: string;
    browser: string;
  };
  createdAt: string;
  lastUsed: string | null;
  counter: number;
  transports: string[];
};

type RateLimitEntry = {
  ip: string;
  requests: number;
  blocked: boolean;
  blockedUntil: string | null;
  windowStart: string;
};

type AttackEntry = {
  id: string;
  ip: string;
  endpoint: string;
  method: string;
  requests: number;
  timestamp: string;
  status: string;
  userAgent: string;
  country: string;
};

export default function EnhancedSecurityDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);

  // State for all tabs
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [rbacData, setRbacData] = useState<any>(null);
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [rateLimitData, setRateLimitData] = useState<any>(null);
  const [attacks, setAttacks] = useState<AttackEntry[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'dashboard':
          const [auditRes, sessionsRes, rateLimitRes] = await Promise.all([
            api.get('/api/security/audit', { params: { limit: 10 } }),
            api.get('/api/security/sessions'),
            api.get('/api/security/rate-limit/stats')
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
          const auditFullRes = await api.get('/api/security/audit', { params: { limit: 50 } });
          setAuditLog(auditFullRes.data.events || []);
          break;

        case 'sessions':
          const sessionsFullRes = await api.get('/api/security/sessions');
          setSessions(sessionsFullRes.data.sessions || []);
          break;

        case 'rbac':
          const [rolesRes, usersRes] = await Promise.all([
            api.get('/api/security/rbac/roles'),
            api.get('/api/security/rbac/users')
          ]);
          setRbacData({
            roles: rolesRes.data.roles || [],
            users: usersRes.data.users || []
          });
          break;

        case 'webauthn':
          const credsRes = await api.get('/api/security/webauthn/credentials/founder@newspulse.com');
          setCredentials(credsRes.data.credentials || []);
          break;

        case 'rate-limit':
          const [statsRes, attacksRes, patternsRes] = await Promise.all([
            api.get('/api/security/rate-limit/stats'),
            api.get('/api/security/rate-limit/attacks', { params: { limit: 20 } }),
            api.get('/api/security/rate-limit/patterns')
          ]);
          setRateLimitData({
            stats: statsRes.data.stats,
            activeRateLimits: statsRes.data.activeRateLimits || [],
            patterns: patternsRes.data.patterns || []
          });
          setAttacks(attacksRes.data.attacks || []);
          break;
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      await api.delete(`/api/security/sessions/${sessionId}`);
      loadData();
    } catch (error) {
      console.error('Failed to revoke session:', error);
    }
  };

  const removeCredential = async (credentialId: string) => {
    try {
      await api.delete(`/api/security/webauthn/credentials/founder@newspulse.com/${credentialId}`);
      loadData();
    } catch (error) {
      console.error('Failed to remove credential:', error);
    }
  };

  const blockIP = async () => {
    const ip = prompt('Enter IP address to block:');
    if (!ip) return;

    try {
      await api.post('/api/security/rate-limit/block', { ip, reason: 'Manual block from dashboard' });
      loadData();
    } catch (error) {
      console.error('Failed to block IP:', error);
    }
  };

  const unblockIP = async (ip: string) => {
    try {
      await api.delete(`/api/security/rate-limit/block/${ip}`);
      loadData();
    } catch (error) {
      console.error('Failed to unblock IP:', error);
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Shield },
    { id: 'audit', label: 'Audit Trail', icon: Activity },
    { id: 'sessions', label: 'Sessions', icon: Users },
    { id: 'rbac', label: 'RBAC', icon: Lock },
    { id: 'webauthn', label: 'Passkeys', icon: Key },
    { id: 'rate-limit', label: 'Rate Limiting', icon: Zap }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
            <Shield className="w-10 h-10 text-cyan-400" />
            Zero-Trust Security Center
          </h1>
          <p className="text-slate-400">Phase 2: WebAuthn + Rate Limiting + Advanced Protection</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="bg-slate-800/50 rounded-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-400">Loading security data...</p>
          </div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && metrics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <AlertTriangle className={`w-6 h-6 ${
                        metrics.threatLevel === 'high' ? 'text-red-400' :
                        metrics.threatLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'
                      }`} />
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        metrics.threatLevel === 'high' ? 'bg-red-500/20 text-red-300' :
                        metrics.threatLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'
                      }`}>
                        {metrics.threatLevel.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">Threat Level</p>
                    <p className="text-sm text-slate-400">System protected</p>
                  </div>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                    <Users className="w-6 h-6 text-blue-400 mb-2" />
                    <p className="text-2xl font-bold text-white mb-1">{metrics.activeSessions}</p>
                    <p className="text-sm text-slate-400">Active Sessions</p>
                  </div>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                    <Activity className="w-6 h-6 text-purple-400 mb-2" />
                    <p className="text-2xl font-bold text-white mb-1">{metrics.auditEvents24h}</p>
                    <p className="text-sm text-slate-400">Audit Events (24h)</p>
                  </div>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                    <Ban className="w-6 h-6 text-red-400 mb-2" />
                    <p className="text-2xl font-bold text-white mb-1">{metrics.blockedIPs}</p>
                    <p className="text-sm text-slate-400">Blocked IPs</p>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Security Events</h3>
                  <div className="space-y-3">
                    {auditLog.slice(0, 5).map((event: any) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          <div>
                            <p className="text-sm text-white font-medium">{event.action}</p>
                            <p className="text-xs text-slate-400">{event.actor} • {event.entity}</p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* WebAuthn Tab */}
            {activeTab === 'webauthn' && (
              <div className="space-y-6">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <Key className="w-6 h-6 text-cyan-400" />
                      Registered Passkeys
                    </h3>
                    <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition">
                      Add Passkey
                    </button>
                  </div>

                  {credentials.length === 0 ? (
                    <div className="text-center py-12">
                      <Smartphone className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400 mb-2">No passkeys registered</p>
                      <p className="text-sm text-slate-500">Add a security key or use your device's biometrics</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {credentials.map(cred => (
                        <div key={cred.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                              {cred.device.type === 'security-key' ? (
                                <Key className="w-6 h-6 text-cyan-400" />
                              ) : (
                                <Smartphone className="w-6 h-6 text-cyan-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">{cred.device.name}</p>
                              <p className="text-sm text-slate-400">
                                {cred.device.browser} • Used {cred.counter} times
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Added {new Date(cred.createdAt).toLocaleDateString()} • 
                                {cred.lastUsed ? ` Last used ${new Date(cred.lastUsed).toLocaleDateString()}` : ' Never used'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeCredential(cred.id)}
                            className="px-3 py-1 text-sm text-red-400 hover:text-red-300 transition"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium mb-1">WebAuthn Benefits</p>
                      <p className="text-sm text-slate-300">
                        Passkeys provide phishing-resistant authentication using your device's biometrics or security keys.
                        No passwords to remember or steal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rate Limiting Tab */}
            {activeTab === 'rate-limit' && rateLimitData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                    <TrendingUp className="w-6 h-6 text-green-400 mb-2" />
                    <p className="text-2xl font-bold text-white mb-1">{rateLimitData.stats.totalActiveIPs}</p>
                    <p className="text-sm text-slate-400">Active IP Addresses</p>
                  </div>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                    <Ban className="w-6 h-6 text-yellow-400 mb-2" />
                    <p className="text-2xl font-bold text-white mb-1">{rateLimitData.stats.autoBlockCount}</p>
                    <p className="text-sm text-slate-400">Auto-blocked (Rate Limit)</p>
                  </div>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                    <XCircle className="w-6 h-6 text-red-400 mb-2" />
                    <p className="text-2xl font-bold text-white mb-1">{rateLimitData.stats.manualBlockCount}</p>
                    <p className="text-sm text-slate-400">Manual Blocks</p>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Top Offenders</h3>
                    <button
                      onClick={blockIP}
                      className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition"
                    >
                      Block IP
                    </button>
                  </div>

                  <div className="space-y-3">
                    {rateLimitData.activeRateLimits.slice(0, 10).map((limit: RateLimitEntry) => (
                      <div key={limit.ip} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Globe className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-sm text-white font-mono">{limit.ip}</p>
                            <p className="text-xs text-slate-400">{limit.requests} requests</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {limit.blocked && (
                            <span className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded">BLOCKED</span>
                          )}
                          {!limit.blocked && limit.requests > 80 && (
                            <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded">WARNING</span>
                          )}
                          <button
                            onClick={() => unblockIP(limit.ip)}
                            className="text-xs text-cyan-400 hover:text-cyan-300"
                          >
                            Unblock
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Attack Attempts</h3>
                  <div className="space-y-2">
                    {attacks.slice(0, 15).map((attack) => (
                      <div key={attack.id} className="flex items-center justify-between p-2 bg-slate-700/20 rounded text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-300">{attack.ip}</span>
                          <span className="text-slate-400">{attack.endpoint}</span>
                          <span className="text-slate-500 text-xs">{attack.requests} req</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            attack.status === 'blocked' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {attack.status}
                          </span>
                          <span className="text-xs text-slate-500">{new Date(attack.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audit Trail Tab */}
            {activeTab === 'audit' && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Audit Trail</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Timestamp</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Actor</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Action</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Entity</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map((entry: any) => (
                        <tr key={entry.id} className="border-b border-slate-700/50">
                          <td className="py-3 px-4 text-slate-300">{new Date(entry.timestamp).toLocaleString()}</td>
                          <td className="py-3 px-4 text-white">{entry.actor}</td>
                          <td className="py-3 px-4 text-cyan-400">{entry.action}</td>
                          <td className="py-3 px-4 text-slate-300">{entry.entity}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-xs">{entry.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="space-y-4">
                {sessions.map((session: any) => (
                  <div key={session.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{session.email}</p>
                          <p className="text-sm text-slate-400 mt-1">{session.device} • {session.browser}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {session.location} • {session.ip}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Created {new Date(session.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => revokeSession(session.id)}
                        className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* RBAC Tab */}
            {activeTab === 'rbac' && rbacData && (
              <div className="space-y-6">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">User Role Assignments</h3>
                  <div className="space-y-3">
                    {rbacData.users.map((user: any) => (
                      <div key={user.userId} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div>
                          <p className="text-white font-medium">{user.email}</p>
                          <p className="text-sm text-slate-400">{user.roleName}</p>
                        </div>
                        <span className="text-xs px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded">{user.role}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Available Roles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rbacData.roles.map((role: any) => (
                      <div key={role.name} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                        <p className="text-white font-medium mb-2">{role.name}</p>
                        <p className="text-sm text-slate-400 mb-3">{role.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {(role.permissions[0] === '*' ? ['ALL PERMISSIONS'] : role.permissions.slice(0, 5)).map((perm: string) => (
                            <span key={perm} className="text-xs px-2 py-0.5 bg-slate-600 text-slate-300 rounded">
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
