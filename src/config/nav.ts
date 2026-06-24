import React from 'react';
import {
  filterNavItemsByOwnerVisibility,
  type AdminFeatureVisibilityState,
} from '@/lib/adminFeatureVisibility';
import { canAccessAdminModule, type AdminModuleKey } from '@/lib/adminAccessControl';

export type Role = string;
export type NavItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  path: string;
  roles: Role[];
  moduleKey?: AdminModuleKey;
  rightSide?: boolean;
  hidden?: boolean;
  locked?: boolean;
};

// Central navigation definition
export const NAV_ITEMS: NavItem[] = [
  // Hide duplicate Home from the main menu since the Navbar already renders a Home link at the far left.
  { key:'home', label:'Home', path:'/', roles:['viewer','editor','admin','founder','moderator'], icon:'🏠', hidden: true },
  { key:'dashboard', label:'Dashboard', path:'/admin/dashboard', roles:['editor','admin','founder','moderator'], icon:'📊', moduleKey:'dashboard' },
  { key:'add', label:'Add News', path:'/admin/add-news', roles:['editor','admin','founder'], icon:'📰', moduleKey:'add_news' },
  // Keep main nav pointing to /admin/articles (alias routes handle others)
  { key:'manage', label:'Manage News', path:'/admin/articles', roles:['editor','admin','founder','moderator'], icon:'📁', moduleKey:'manage_news' },
  { key:'drafts', label:'Draft Desk', path:'/admin/draft-desk', roles:['editor','admin','founder'], icon:'📰', moduleKey:'draft_desk' },
  { key:'community-reporter-queue', label:'Community Reporter Queue', path:'/community/reporter', roles:['editor','admin','founder','moderator'], icon:'🗂️', moduleKey:'community_reporter_queue' },
  // Founder/Admin oversight for the live reporter workspace
  { key:'reporter-portal', label:'Reporter Portal Admin', path:'/admin/reporter-portal-admin', roles:['admin','founder'], icon:'👥', moduleKey:'reporter_portal_admin' },
  { key:'broadcast-center', label:'Broadcast Center', path:'/admin/broadcast-center', roles:['founder'], icon:'📡', moduleKey:'broadcast_center' },
  { key:'ads', label:'Ads Manager', path:'/admin/ads-manager', roles:['editor','admin','founder'], icon:'📣', moduleKey:'ads_manager' },
  { key:'finance', label:'Finance Desk', path:'/admin/finance', roles:['admin','founder'], icon:'💼', moduleKey:'finance_desk' },
  { key:'media', label:'Media', path:'/admin/media', roles:['editor','admin','founder'], icon:'📸', moduleKey:'media' },
  { key:'viral-videos', label:'Viral Videos', path:'/admin/viral-videos/new', roles:['editor','admin','founder'], icon:'🎬', moduleKey:'viral_videos' },
  { key:'aira', label:'AIRA', path:'/admin/aira', roles:['admin','founder'], icon:'🧍‍♀️', moduleKey:'aira' },
  { key:'livetv', label:'Live TV', path:'/admin/live-tv', roles:['editor','admin','founder'], icon:'🎥', moduleKey:'live_tv' },
  { key:'editorial', label:'Editorial', path:'/admin/editorial', roles:['editor','admin','founder'], icon:'✍️', moduleKey:'editorial' },
  { key:'seo', label:'SEO', path:'/admin/seo', roles:['admin','founder'], icon:'🔍', moduleKey:'seo' },
  { key:'analytics', label:'Analytics', path:'/admin/analytics', roles:['admin','founder'], icon:'👩‍💻', moduleKey:'analytics' },
  { key:'moderation', label:'Moderation', path:'/admin/moderation', roles:['moderator','admin','founder'], icon:'💬', moduleKey:'moderation' },
  { key:'compliance-reports', label:'Compliance Reports', path:'/admin/compliance-reports', roles:['admin','founder'], icon:'🧾', moduleKey:'compliance_reports' },
  { key:'ai-engine', label:'AI Engine', path:'/admin/ai-engine', roles:['editor','admin','founder'], icon:'🧠', moduleKey:'ai_engine' },
  // Settings entry
  { key:'settings', label:'Settings', path:'/admin/settings', roles:['editor','admin','founder','moderator'], icon:'⚙️', moduleKey:'settings' },
  // Owner Control Center (single link; module navigation handled inside the pages)
  { key:'soz', label:'Safe Zone', path:'/admin/safe-owner-zone', roles:['founder','admin'], icon:'🧩', moduleKey:'safe_zone' },
  { key:'community-hub', label:'Community Hub', path:'/community', roles:['editor','admin','founder','moderator'], icon:'🧑‍🤝‍🧑' },
  // Right side utility items
  // Admin global security dashboard (Zero-Trust controls)
  { key:'security', label:'Zero-Trust Security', path:'/admin/security', roles:['admin','founder'], icon:'🧱', rightSide:true, hidden: true },
  { key:'lang', label:'Language', path:'#lang', roles:['viewer','editor','admin','founder','moderator'], icon:'🌐', rightSide:true, hidden: true },
  { key:'dark', label:'Dark', path:'#dark', roles:['viewer','editor','admin','founder','moderator'], icon:'🌙', rightSide:true },
  { key:'founder-my-account', label:'Founder My Account', path:'/admin/founder/my-account', roles:['founder'], icon:'👤', rightSide:true },
  { key:'my-account', label:'My Account', path:'/admin/my-account', roles:['viewer','editor','admin','moderator','manager','reporter','copyeditor','copy_editor','factchecker','fact_checker','livetv_controller','video_editor','finance_accounts_manager','ads_revenue_growth_manager','social_media_manager','tech_support','intern'], icon:'👤', rightSide:true },
  { key:'logout', label:'Logout', path:'/logout', roles:['viewer','editor','admin','founder','moderator'], icon:'🚪', rightSide:true },
  { key:'change-password', label:'Change Password', path:'/admin/change-password', roles:['editor','admin','founder','moderator'], icon:'🔑', rightSide:true, hidden: true },
];

export function filterNavForRole(role: Role) {
  return NAV_ITEMS.filter(i => !i.hidden && i.roles.includes(role));
}

export function leftNav(role: Role) { return filterNavForRole(role).filter(i=> !i.rightSide); }
export function rightNav(role: Role) { return filterNavForRole(role).filter(i=> i.rightSide); }

export function leftNavWithOwnerVisibility(role: Role, visibility: AdminFeatureVisibilityState) {
  return filterNavItemsByOwnerVisibility(leftNav(role), role, visibility);
}

export function rightNavWithOwnerVisibility(role: Role, visibility: AdminFeatureVisibilityState) {
  return filterNavItemsByOwnerVisibility(rightNav(role), role, visibility);
}

export function leftNavWithAccess(user: any, visibility: AdminFeatureVisibilityState) {
  const role = String(user?.role || 'viewer').toLowerCase();
  return NAV_ITEMS.filter((item) => !item.hidden && !item.rightSide).flatMap((item) => {
    if (item.moduleKey) return [{ ...item, locked: !canAccessAdminModule(user, item.moduleKey, visibility) }];
    return item.roles.includes(role) ? [item] : [];
  });
}

export function rightNavWithAccess(user: any, visibility: AdminFeatureVisibilityState) {
  return NAV_ITEMS.filter((item) => !item.hidden && item.rightSide).filter((item) => {
    if (item.moduleKey) return canAccessAdminModule(user, item.moduleKey, visibility);
    return item.roles.includes(String(user?.role || 'viewer').toLowerCase());
  });
}
