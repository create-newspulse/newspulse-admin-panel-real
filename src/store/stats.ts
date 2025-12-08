import { create } from 'zustand';

export type Stats = {
  totalArticles: number;
  pendingArticles: number;
  activePolls: number;
  traffic24h: number;
  flags: number;
  complianceIssues: number;
};

export const useStats = create<{ stats: Stats; setStats: (s: Partial<Stats>) => void }>((set) => ({
  stats: { totalArticles:0, pendingArticles:0, activePolls:0, traffic24h:0, flags:0, complianceIssues:0 },
  setStats: (s) => set((st)=>({ stats: { ...st.stats, ...s }})),
}));
