import React, { ComponentType, Suspense } from 'react';
import OwnerZoneShell from './OwnerZoneShell';
import FounderQuickActions from './widgets/FounderQuickActions';
import NotFound from './stubs/NotFound';

// Helper to lazy-load with static import paths (ensures Vite resolves correctly)
function lazyComp<T = any>(loader: () => Promise<{ default: ComponentType<T> }>): ComponentType<T> {
  try { return React.lazy(loader as any); } catch { return NotFound as any; }
}

// Mapping of domain modules to their tabs and underlying panel components.
export const OwnerModules = [
  {
    id: 'founder',
    title: 'Founder Command & Snapshot',
    tabs: [
  { id: 'command', label: 'Command Palette', component: lazyComp(() => import('../../components/SafeZone/FounderControlPanel')) },
  { id: 'snapshots', label: 'Snapshots', component: lazyComp(() => import('../../components/SafeZone/SystemVersionControl')) },
  { id: 'runbooks', label: 'Runbooks', component: lazyComp(() => import('../../components/SafeZone/FeatureHelpPanel')) },
    ],
  },
  {
    id: 'security',
    title: 'Security & Lockdown',
    tabs: [
  { id: 'overview', label: 'Overview', component: lazyComp(() => import('../../components/SafeZone/ThreatDashboard')) },
  { id: 'alerts', label: 'Smart Alerts', component: lazyComp(() => import('../../components/SafeZone/SmartAlertSystem')) },
  { id: 'escalation', label: 'Escalation', component: lazyComp(() => import('./tabs/EscalationSettings')) },
  { id: 'incidents', label: 'Incidents', component: lazyComp(() => import('../../components/SafeZone/IncidentResponseModule')) },
  { id: 'scan', label: 'Threat Scan', component: lazyComp(() => import('../../components/SafeZone/GlobalThreatScanner')) },
  { id: 'lockdown', label: 'Lockdown', component: lazyComp(() => import('../../components/SafeZone/AutoLockdownSwitch')) },
  { id: 'unlock', label: 'Unlock', component: lazyComp(() => import('../../components/SafeZone/SignatureUnlock')) },
  { id: 'logins', label: 'Login Records', component: lazyComp(() => import('../../components/SafeZone/LoginRecordTracker')) },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Policy (PTI)',
    tabs: [
  { id: 'rules', label: 'Rules Engine', component: lazyComp(() => import('../../components/SafeZone/GuardianRulesEngine.tsx')) },
  { id: 'audits', label: 'Audit Logs', component: lazyComp(() => import('../../components/SafeZone/ComplianceAuditPanel.tsx')) },
    ],
  },
  {
    id: 'ai',
    title: 'AI Control & Guardrails',
    tabs: [
  { id: 'overview', label: 'Overview', component: lazyComp(() => import('../../components/SafeZone/AIGlowPanel.tsx')) },
  { id: 'tools', label: 'Tools', component: lazyComp(() => import('../../components/SafeZone/AiToolsPanel.tsx')) },
  { id: 'activity', label: 'Activity Log', component: lazyComp(() => import('../../components/SafeZone/AIActivityLog.tsx')) },
  { id: 'trainer', label: 'Behavior Trainer', component: lazyComp(() => import('../../components/SafeZone/AIBehaviorTrainer.tsx')) },
  { id: 'guardrails', label: 'Guardrails', component: lazyComp(() => import('../../components/SafeZone/SystemUnlockPanel.tsx')) },
    ],
  },
  {
    id: 'vaults',
    title: 'Data & Vaults',
    tabs: [
  { id: 'apikeys', label: 'API Keys', component: lazyComp(() => import('../../components/SafeZone/APIKeyVault.tsx')) },
  { id: 'files', label: 'Secure Files', component: lazyComp(() => import('../../components/SafeZone/SecureFileVault.tsx')) },
  { id: 'backups', label: 'Backups', component: lazyComp(() => import('../../components/SafeZone/BackupAndRecovery.tsx')) },
  { id: 'versions', label: 'Versions', component: lazyComp(() => import('../../components/SafeZone/SystemVersionControl.tsx')) },
    ],
  },
  {
    id: 'ops',
    title: 'Operations Monitor',
    tabs: [
  { id: 'traffic', label: 'Traffic', component: lazyComp(() => import('../../components/SafeZone/TrafficAnalytics.tsx')) },
  { id: 'realtime', label: 'Realtime', component: lazyComp(() => import('../../components/SafeZone/RealtimeTrafficGlobe.tsx')) },
  { id: 'uptime', label: 'API Uptime', component: lazyComp(() => import('../../components/SafeZone/MonitorHubPanel.tsx')) },
  { id: 'health', label: 'System Health', component: lazyComp(() => import('../../components/SafeZone/SystemHealthPanel.tsx')) },
    ],
  },
  {
    id: 'revenue',
    title: 'Revenue & Growth',
    tabs: [
  { id: 'revenue', label: 'Revenue', component: lazyComp(() => import('../../components/SafeZone/RevenuePanel.tsx')) },
  { id: 'forecast', label: 'Forecast AI', component: lazyComp(() => import('../../components/SafeZone/EarningsForecastAI.tsx')) },
    ],
  },
  {
    id: 'admin',
    title: 'Admin Oversight',
    tabs: [
  { id: 'chat', label: 'Chat Audit', component: lazyComp(() => import('../../components/SafeZone/AdminChatAudit.tsx')) },
  { id: 'bugs', label: 'Bug Reports', component: lazyComp(() => import('../../components/SafeZone/BugReportAnalyzer.tsx')) },
  { id: 'polls', label: 'Live Polls', component: lazyComp(() => import('../../components/SafeZone/LiveNewsPollsPanel.tsx')) },
  { id: 'help', label: 'Feature Help', component: lazyComp(() => import('../../components/SafeZone/FeatureHelpPanel.tsx')) },
  { id: 'audit', label: 'Audit Viewer', component: lazyComp(() => import('./tabs/AuditViewer.tsx')) },
    ],
  },
];

export function OwnerModulePage({ moduleId }: { moduleId: string }) {
  const mod = OwnerModules.find(m => m.id === moduleId);
  if (!mod) return <NotFound />;
  // optimistic demo lock + snapshot status from window globals or fallback
  const lockState = (window as any).__LOCK_STATE__ || 'UNLOCKED';
  const snapshotId = (window as any).__LAST_SNAPSHOT_ID__ || null;
  return (
    <Suspense fallback={<div className="text-sm">Loading module…</div>}>
      <OwnerZoneShell
        title={mod.title}
        toolbar={mod.id === 'founder' ? <FounderQuickActions /> : null}
  tabs={mod.tabs.map(t => ({ id: t.id, label: t.label, render: () => React.createElement(t.component as any, {}) }))}
        defaultTab={mod.tabs[0]?.id || 'overview'}
        status={{ lockState: lockState, snapshotId }}
      />
    </Suspense>
  );
}

// Mapping report (export for diagnostics)
export const OwnerZoneMappingReport = OwnerModules.flatMap(m => m.tabs.map(t => ({ module: m.id, tab: t.id, label: t.label })));
