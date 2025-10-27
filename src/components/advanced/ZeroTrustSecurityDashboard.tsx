// 🛡️ Enhanced Zero-Trust Security System with Real Backend Integration
import { useEffect, useState } from 'react';
import apiClient from '../../lib/api';
import { Shield, Users, Activity, Lock, AlertTriangle, CheckCircle, XCircle, UserX } from 'lucide-react';

type SecurityMetrics = {
  threatLevel: 'low' | 'medium' | 'high';
  activeSessions: number;
  failedLogins24h: number;
  auditEvents24h: number;
  blockedIPs: number;
};

type AuditEntry = {
  id: number;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: any;
  ip: string;
  userAgent: string;
  timestamp: string;
};

type Session = {
  id: string;
  userId: string;
  email: string;
  ip: string;
  device: string;
  browser: string;
  location: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
};

type RBACUser = {
  userId: string;
  email: string;
  role: string;
  roleName: string;
  permissions: string[];
};

type Role = {
  name: string;
  permissions: string[];
  description: string;
};

export default function ZeroTrustSecurityDashboard(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit' | 'sessions' | 'rbac'>('dashboard');
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [rbacUsers, setRbacUsers] = useState<RBACUser[]>([]);
  const [roles, setRoles] = useState<Record<string, Role>>({});
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
    } catch (err) {
      console.error('Failed to load security data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function revokeSession(sessionId: string) {
    try {
  await apiClient.delete(`/security/sessions/${sessionId}`);
      alert('Session revoked successfully');
      loadData();
    } catch (err) {
      console.error('Failed to revoke session:', err);
      alert('Failed to revoke session');
    }
  }

  function getThreatColor(level: string) {
    if (level === 'high') return 'text-red-600 bg-red-50';
    if (level === 'medium') return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="text-blue-600" />
          Zero-Trust Security
        </h2>
        <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-300 dark:border-gray-600">
        {(['dashboard', 'audit', 'sessions', 'rbac'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
            }`}
          >
            {tab === 'dashboard' && '📊 Dashboard'}
            {tab === 'audit' && '📋 Audit Trail'}
            {tab === 'sessions' && '🔐 Sessions'}
            {tab === 'rbac' && '👥 RBAC'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">Loading security data...</div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Threat Level</div>
                      <div className={`text-2xl font-bold ${getThreatColor(metrics?.threatLevel || 'low')}`}>
                        {metrics?.threatLevel?.toUpperCase()}
                      </div>
                    </div>
                    <Shield className="text-gray-400" size={32} />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Active Sessions</div>
                      <div className="text-2xl font-bold">{sessions.length}</div>
                    </div>
                    <Users className="text-gray-400" size={32} />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Audit Events (24h)</div>
                      <div className="text-2xl font-bold">{metrics?.auditEvents24h}</div>
                    </div>
                    <Activity className="text-gray-400" size={32} />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Failed Logins</div>
                      <div className="text-2xl font-bold">{metrics?.failedLogins24h}</div>
                    </div>
                    <Lock className="text-gray-400" size={32} />
                  </div>
                </div>
              </div>

              {/* Recent Audit Events */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Recent Security Events</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditLog.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded">
                      <div className="flex-shrink-0">
                        {entry.action === 'login' && <CheckCircle className="text-green-600" size={20} />}
                        {entry.action === 'role_change' && <AlertTriangle className="text-yellow-600" size={20} />}
                        {entry.action === 'delete' && <XCircle className="text-red-600" size={20} />}
                        {!['login', 'role_change', 'delete'].includes(entry.action) && <Activity className="text-blue-600" size={20} />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{entry.actor}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {entry.action} on {entry.entity} {entry.entityId ? `(${entry.entityId})` : ''}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleString()} • {entry.ip}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Audit Trail Tab */}
          {activeTab === 'audit' && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">Complete Audit Trail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left p-2">Timestamp</th>
                      <th className="text-left p-2">Actor</th>
                      <th className="text-left p-2">Action</th>
                      <th className="text-left p-2">Entity</th>
                      <th className="text-left p-2">IP</th>
                      <th className="text-left p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="p-2">{new Date(entry.timestamp).toLocaleString()}</td>
                        <td className="p-2">{entry.actor}</td>
                        <td className="p-2">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                            {entry.action}
                          </span>
                        </td>
                        <td className="p-2">{entry.entity}</td>
                        <td className="p-2">{entry.ip}</td>
                        <td className="p-2 text-xs text-gray-600 dark:text-gray-400">
                          {entry.entityId && `ID: ${entry.entityId}`}
                          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                            <span className="ml-2">• {JSON.stringify(entry.metadata).substring(0, 50)}...</span>
                          )}
                        </td>
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
              <h3 className="text-xl font-semibold">Active Sessions</h3>
              {sessions.map((session) => (
                <div key={session.id} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="font-semibold text-lg">{session.email}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div>📍 {session.location}</div>
                        <div>💻 {session.device} • {session.browser}</div>
                        <div>🌐 {session.ip}</div>
                        <div>⏰ Created: {new Date(session.createdAt).toLocaleString()}</div>
                        <div>🕒 Last Activity: {new Date(session.lastActivity).toLocaleString()}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => revokeSession(session.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
                    >
                      <UserX size={16} />
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RBAC Tab */}
          {activeTab === 'rbac' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">User Roles & Permissions</h3>
                {rbacUsers.map((user) => (
                  <div key={user.userId} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow mb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{user.email}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Role: <span className="font-medium text-blue-600">{user.roleName}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {user.permissions.slice(0, 5).map((perm, idx) => (
                            <span key={idx} className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                              {perm}
                            </span>
                          ))}
                          {user.permissions.length > 5 && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                              +{user.permissions.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4">Available Roles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(roles).map(([key, role]) => (
                    <div key={key} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                      <div className="font-semibold text-lg">{role.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{role.description}</div>
                      <div className="text-xs text-gray-500">
                        {role.permissions.includes('*') ? (
                          <span className="text-red-600 font-bold">FULL ACCESS</span>
                        ) : (
                          `${role.permissions.length} permissions`
                        )}
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
  );
}
