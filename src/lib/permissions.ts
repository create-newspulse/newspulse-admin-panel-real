import type { Role } from '@/store/auth';

export const can = {
  manageSystem: (r: Role) => r === 'founder',
  manageContent: (r: Role) => r === 'founder' || r === 'admin',
  createArticle: (r: Role) => ['founder','admin','employee'].includes(r),
};
