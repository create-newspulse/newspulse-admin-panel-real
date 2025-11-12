import { Role } from '@/store/auth';
import {
  HomeIcon, ShieldCheckIcon, KeyIcon, CpuChipIcon, PresentationChartLineIcon,
  DocumentChartBarIcon, ClipboardDocumentCheckIcon, WrenchIcon, BoltIcon,
  InboxStackIcon, BellAlertIcon, FolderOpenIcon, GlobeAltIcon
} from '@heroicons/react/24/outline';

export type Item = {
  key: string;
  label: string;
  path: string;
  icon: any;
  roles: Role[];
  badgeKey?: string;
  children?: Item[];
  section?: 'founder' | 'admin' | 'employee';
};

export const MENU: Item[] = [
  { key:'dashboard', label:'Dashboard', path:'/panel', icon:HomeIcon, roles:['founder','admin','employee'] },

  // Founder Zone
  { key:'founderCommand', label:'Founder Command', path:'/panel/founder/command', icon:WrenchIcon, roles:['founder'], section:'founder' },
  { key:'securityLockdown', label:'Security & Lockdown', path:'/panel/founder/security', icon:ShieldCheckIcon, roles:['founder'], section:'founder' },
  { key:'vaults', label:'Vaults', path:'/panel/founder/vaults', icon:FolderOpenIcon, roles:['founder'], section:'founder' },
  { key:'aiControl', label:'AI Control', path:'/panel/founder/ai-control', icon:CpuChipIcon, roles:['founder'], section:'founder' },
  { key:'analyticsRevenue', label:'Analytics & Revenue', path:'/panel/founder/analytics-revenue', icon:PresentationChartLineIcon, roles:['founder'], section:'founder' },
  { key:'founderLogs', label:'Founder Logs', path:'/panel/founder/logs', icon:ClipboardDocumentCheckIcon, roles:['founder'], section:'founder' },
  { key:'systemIntelligence', label:'System Intelligence Panel', path:'/panel/founder/system-intel', icon:DocumentChartBarIcon, roles:['founder'], section:'founder' },

  // Admin Operations
  { key:'newsAdd', label:'Add News', path:'/panel/admin/news/new', icon:BoltIcon, roles:['founder','admin'], section:'admin' },
  { key:'newsManage', label:'Manage News', path:'/panel/admin/news', icon:InboxStackIcon, roles:['founder','admin'], section:'admin', badgeKey:'pendingArticles' },
  { key:'moderation', label:'Moderation', path:'/panel/admin/moderation', icon:BellAlertIcon, roles:['founder','admin'], section:'admin', badgeKey:'flags' },
  { key:'compliance', label:'Compliance', path:'/panel/admin/compliance', icon:ShieldCheckIcon, roles:['founder','admin'], section:'admin', badgeKey:'complianceIssues' },
  { key:'operations', label:'Operations', path:'/panel/admin/operations', icon:WrenchIcon, roles:['founder','admin'], section:'admin' },
  { key:'editorialMedia', label:'Editorial & Media', path:'/panel/admin/editorial-media', icon:GlobeAltIcon, roles:['founder','admin'], section:'admin' },
  { key:'workflow', label:'Workflow', path:'/panel/admin/workflow', icon:KeyIcon, roles:['founder','admin'], section:'admin' },

  // Employee
  { key:'employeeAdd', label:'Add News (Restricted)', path:'/panel/employee/news/new', icon:BoltIcon, roles:['employee','admin','founder'], section:'employee' },
  { key:'drafts', label:'Draft Box', path:'/panel/employee/drafts', icon:FolderOpenIcon, roles:['employee','admin','founder'], section:'employee' },
  { key:'assistant', label:'AI Assistant Tip Box', path:'/panel/employee/assistant', icon:CpuChipIcon, roles:['employee','admin','founder'], section:'employee' },
  { key:'tools', label:'Grammar & Dictionary', path:'/panel/employee/tools', icon:GlobeAltIcon, roles:['employee','admin','founder'], section:'employee' },
];
