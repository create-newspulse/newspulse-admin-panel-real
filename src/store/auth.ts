import { create } from 'zustand';

export type Role = 'founder' | 'admin' | 'editor' | 'copyeditor' | 'reporter' | 'intern' | 'employee';
export type User = { id: string; name: string; email: string; role: Role; avatarUrl?: string; avatar?: string; bio?: string; _id?: string };

type State = {
  user: User | null;
  token: string | null;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  hasRole: (roles: Role | Role[]) => boolean;
};

export const useAuthZ = create<State>((set, get) => ({
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

// Unified login store (spec-compliant) – kept separate to avoid conflicts with legacy context
type UnifiedState = {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clear: () => void;
};

export const useAuth = create<UnifiedState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token }),
  clear: () => set({ user: null, token: null }),
}));
