import { create } from 'zustand';

export type Role = 'founder' | 'admin' | 'employee';
export type User = { id: string; name: string; email: string; role: Role; avatarUrl?: string };

type State = {
  user: User | null;
  token: string | null;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  hasRole: (roles: Role | Role[]) => boolean;
};

export const useAuth = create<State>((set, get) => ({
  user: null,
  token: null,
  setUser: (u) => set({ user: u }),
  setToken: (t) => set({ token: t }),
  hasRole: (roles) => {
    const r = get().user?.role;
    if (!r) return false;
    return Array.isArray(roles) ? roles.includes(r) : r === roles;
  },
}));
