// 🛡️ FOUNDER CONTROL CENTER - Maximum Security News Command
// Zero-Trust Architecture with Emergency Controls

import React, { useState } from 'react';
import { 
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock,
  AlertTriangle, Activity, Globe, Zap,
  Ban, CheckCircle, XCircle, AlertCircle,
  Monitor, HardDrive, Cpu, MemoryStick, Download,
  RefreshCw, Key
} from 'lucide-react';

interface SystemHealth {
  server: 'healthy' | 'warning' | 'critical';
  database: 'healthy' | 'warning' | 'critical';
  cdn: 'healthy' | 'warning' | 'critical';
  security: 'healthy' | 'warning' | 'critical';
  backup: 'healthy' | 'warning' | 'critical';
}

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'permission_change' | 'data_access' | 'system_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user: string;
  action: string;
  timestamp: Date;
  ip: string;
  location: string;
  resolved: boolean;
}

interface FounderControl {
  globalPublishing: boolean;
  emergencyMode: boolean;
  readOnlyMode: boolean;
  founderShield: boolean;
  backupRunning: boolean;
  auditMode: boolean;
}

const FounderControlCenter: React.FC = () => {
  const [systemHealth] = useState<SystemHealth>({
    server: 'healthy',
    database: 'healthy', 
    cdn: 'healthy',
    security: 'warning',
    backup: 'healthy'
  });

  const [controls, setControls] = useState<FounderControl>({
    globalPublishing: true,
    emergencyMode: false,
    readOnlyMode: false,
    founderShield: true,
    backupRunning: false,
    auditMode: true
  });

  const [securityEvents] = useState<SecurityEvent[]>([
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
    } else {
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

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300';
      case 'critical': return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300';
      default: return 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-900/20 dark:border-gray-700 dark:text-gray-300';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Founder Header */}
      <div className="bg-gradient-to-r from-red-900/20 to-red-800/20 border-b border-red-700/30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-600/20 rounded-lg border border-red-500/30">
                <Shield className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  🛡️ FOUNDER COMMAND CENTER
                </h1>
                <p className="text-red-300 mt-1">
                  Zero-Trust Security • Global System Control • Emergency Response
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {controls.emergencyMode && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-red-600/30 rounded-lg border border-red-500/50">
                  <AlertTriangle className="w-5 h-5 text-red-300 animate-pulse" />
                  <span className="text-red-300 font-semibold">EMERGENCY MODE</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-300">Founder Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Emergency Controls */}
        <div className="mb-8">
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Zap className="w-6 h-6 text-yellow-400 mr-3" />
              FOUNDER COMMAND STRIP
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Global Publishing Control */}
              <button
                onClick={toggleGlobalPublishing}
                disabled={controls.emergencyMode}
                className={`p-4 rounded-lg border-2 transition-all ${
                  controls.globalPublishing 
                    ? 'bg-green-900/20 border-green-500/50 text-green-300' 
                    : 'bg-red-900/20 border-red-500/50 text-red-300'
                } ${controls.emergencyMode ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`}
              >
                <div className="flex items-center justify-center mb-2">
                  {controls.globalPublishing ? <Unlock className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
                </div>
                <div className="text-center">
                  <p className="font-semibold">Global Publishing</p>
                  <p className="text-xs opacity-75">
                    {controls.globalPublishing ? 'ENABLED' : 'DISABLED'}
                  </p>
                </div>
              </button>

              {/* Emergency Mode */}
              <button
                onClick={() => {
                  if (controls.emergencyMode) {
                    setShowFounderCode(true);
                  } else {
                    toggleEmergencyMode();
                  }
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  controls.emergencyMode 
                    ? 'bg-red-900/20 border-red-500/50 text-red-300' 
                    : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-red-900/10 hover:border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <Ban className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Emergency Lockdown</p>
                  <p className="text-xs opacity-75">
                    {controls.emergencyMode ? 'ACTIVE' : 'STANDBY'}
                  </p>
                </div>
              </button>

              {/* Founder Shield */}
              <button
                onClick={() => setControls(prev => ({ ...prev, founderShield: !prev.founderShield }))}
                className={`p-4 rounded-lg border-2 transition-all ${
                  controls.founderShield 
                    ? 'bg-blue-900/20 border-blue-500/50 text-blue-300' 
                    : 'bg-slate-700/50 border-slate-600/50 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Founder Shield</p>
                  <p className="text-xs opacity-75">
                    {controls.founderShield ? 'PROTECTED' : 'EXPOSED'}
                  </p>
                </div>
              </button>

              {/* System Backup */}
              <button
                onClick={initiateBackup}
                disabled={controls.backupRunning}
                className={`p-4 rounded-lg border-2 transition-all ${
                  controls.backupRunning 
                    ? 'bg-yellow-900/20 border-yellow-500/50 text-yellow-300' 
                    : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-purple-900/10 hover:border-purple-500/30'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  {controls.backupRunning ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : (
                    <Download className="w-8 h-8" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold">System Backup</p>
                  <p className="text-xs opacity-75">
                    {controls.backupRunning ? 'RUNNING' : 'READY'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Founder Code Input Modal */}
        {showFounderCode && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div
              className="bg-slate-800 rounded-xl border border-slate-700 p-8 max-w-md w-full mx-4"
            >
              <div className="text-center mb-6">
                <Key className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">Founder Authentication Required</h3>
                <p className="text-slate-400 mt-2">Enter your foundation code to exit emergency mode</p>
              </div>
              
              <input
                type="password"
                value={foundationCode}
                onChange={(e) => setFoundationCode(e.target.value)}
                placeholder="Foundation Code"
                className="w-full p-4 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 mb-4"
                autoFocus
              />
              
              <div className="flex space-x-3">
                <button
                  onClick={toggleEmergencyMode}
                  className="flex-1 p-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
                >
                  Authenticate
                </button>
                <button
                  onClick={() => {
                    setShowFounderCode(false);
                    setFoundationCode('');
                  }}
                  className="flex-1 p-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* System Health Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* System Health */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Activity className="w-6 h-6 text-green-400 mr-3" />
              SYSTEM INTELLIGENCE
            </h3>
            
            <div className="space-y-4">
              {Object.entries(systemHealth).map(([system, status]) => (
                <div
                  key={system}
                  className={`p-4 rounded-lg border ${getHealthColor(status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getHealthIcon(status)}
                      <div>
                        <p className="font-semibold capitalize">{system}</p>
                        <p className="text-sm opacity-75 capitalize">{status}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono">
                        {system === 'server' && '99.9%'}
                        {system === 'database' && '100%'}
                        {system === 'cdn' && '99.8%'}
                        {system === 'security' && '98.5%'}
                        {system === 'backup' && '100%'}
                      </p>
                      <p className="text-xs opacity-60">Uptime</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Events */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <ShieldAlert className="w-6 h-6 text-red-400 mr-3" />
              SECURITY EVENTS
            </h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {securityEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(event.severity)}`}>
                        {event.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">{event.type.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    {event.resolved ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  
                  <p className="text-white font-medium mb-1">{event.action}</p>
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>User: {event.user}</p>
                    <p>IP: {event.ip} • {event.location}</p>
                    <p>Time: {event.timestamp.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Resources */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <Monitor className="w-6 h-6 text-blue-400 mr-3" />
            SYSTEM RESOURCES
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <Cpu className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">23%</p>
              <p className="text-sm text-slate-400">CPU Usage</p>
            </div>
            
            <div className="text-center">
              <MemoryStick className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">67%</p>
              <p className="text-sm text-slate-400">Memory</p>
            </div>
            
            <div className="text-center">
              <HardDrive className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">45%</p>
              <p className="text-sm text-slate-400">Storage</p>
            </div>
            
            <div className="text-center">
              <Globe className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">1.2GB</p>
              <p className="text-sm text-slate-400">Bandwidth</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FounderControlCenter;