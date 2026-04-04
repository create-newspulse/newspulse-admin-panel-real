import React from 'react';

export type Role = 'founder'|'admin'|'editor'|'moderator'|'viewer';
export type NavItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  path: string;
  roles: Role[];
  rightSide?: boolean;
  hidden?: boolean;
};

// Central navigation definition
export const NAV_ITEMS: NavItem[] = [
  // Hide duplicate Home from the main menu since the Navbar already renders a Home link at the far left.
  { key:'home', label:'Home', path:'/', roles:['viewer','editor','admin','founder','moderator'], icon:'🏠', hidden: true },
  { key:'dashboard', label:'Dashboard', path:'/admin/dashboard', roles:['editor','admin','founder','moderator'], icon:'📊' },
  { key:'add', label:'Add News', path:'/add', roles:['editor','admin','founder'], icon:'📰' },
  // Keep main nav pointing to /admin/articles (alias routes handle others)
  { key:'manage', label:'Manage News', path:'/admin/articles', roles:['editor','admin','founder','moderator'], icon:'📁' },
  { key:'drafts', label:'Draft Desk', path:'/draft-desk', roles:['editor','admin','founder'], icon:'📰' },
  { key:'community-reporter', label:'Community Reporter Queue', path:'/community/reporter', roles:['editor','admin','founder','moderator'], icon:'🧑‍🤝‍🧑' },
  // Founder/Admin oversight for the live reporter workspace
  { key:'reporter-portal', label:'Reporter Portal', path:'/community/portal', roles:['admin','founder'], icon:'👥' },
  { key:'livetv', label:'Live TV', path:'/admin/live', roles:['editor','admin','founder'], icon:'🎥' },
  { key:'ai-engine', label:'AI Engine', path:'/admin/ai-engine', roles:['editor','admin','founder'], icon:'🧠' },
  { key:'aira', label:'AIRA', path:'/admin/aira', roles:['admin','founder'], icon:'🧍‍♀️' },
  { key:'editorial', label:'Editorial', path:'/admin/editorial', roles:['editor','admin','founder'], icon:'✍️' },
  { key:'media', label:'Media', path:'/admin/media-library', roles:['editor','admin','founder'], icon:'📸' },
  { key:'seo', label:'SEO', path:'/admin/seo', roles:['admin','founder'], icon:'🔍' },
  { key:'analytics', label:'Analytics', path:'/admin/analytics', roles:['admin','founder'], icon:'👩‍💻' },
  { key:'ads', label:'Ads Manager', path:'/admin/ads', roles:['editor','admin','founder'], icon:'📣' },
  // Settings entry
  { key:'settings', label:'Settings', path:'/admin/settings', roles:['editor','admin','founder','moderator'], icon:'⚙️' },
  // Founder-only: homepage broadcast controls
  { key:'broadcast-center', label:'Broadcast Center', path:'/admin/broadcast-center', roles:['founder'], icon:'📡' },
  // Owner Control Center (single link; module navigation handled inside the pages)
  { key:'soz', label:'Safe Owner Zone', path:'/admin/safe-owner-zone', roles:['founder','admin'], icon:'🧩' },
  { key:'moderation', label:'Moderation', path:'/admin/moderation', roles:['moderator','admin','founder'], icon:'💬' },
  { key:'youth', label:'Youth Pulse', path:'/admin/youth-pulse', roles:['editor','admin','founder'], icon:'🌐' },
  // Right side utility items
  // Admin global security dashboard (Zero-Trust controls)
  { key:'security', label:'Zero-Trust Security', path:'/admin/security', roles:['admin','founder'], icon:'🧱', rightSide:true, hidden: true },
  { key:'lang', label:'Language', path:'#lang', roles:['viewer','editor','admin','founder','moderator'], icon:'🌐', rightSide:true, hidden: true },
  { key:'dark', label:'Dark', path:'#dark', roles:['viewer','editor','admin','founder','moderator'], icon:'🌙', rightSide:true },
  { key:'logout', label:'Logout', path:'/logout', roles:['viewer','editor','admin','founder','moderator'], icon:'🚪', rightSide:true },
  { key:'change-password', label:'Change Password', path:'/admin/change-password', roles:['editor','admin','founder','moderator'], icon:'🔑', rightSide:true, hidden: true },
];

export function filterNavForRole(role: Role) {
  return NAV_ITEMS.filter(i => !i.hidden && i.roles.includes(role));
}

export function leftNav(role: Role) { return filterNavForRole(role).filter(i=> !i.rightSide); }
export function rightNav(role: Role) { return filterNavForRole(role).filter(i=> i.rightSide); }
