import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OwnerMode = 'NORMAL' | 'READONLY' | 'LOCKDOWN';

type OwnerKeyState = {
  mode: OwnerMode;
  unlockedUntilMs: number | null;

  setMode: (mode: OwnerMode) => void;
  unlockForMs: (ttlMs: number) => void;
  lock: () => void;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function getOwnerKeyRemainingMs(unlockedUntilMs: number | null, now = Date.now()) {
  if (!unlockedUntilMs) return 0;
  return Math.max(0, unlockedUntilMs - now);
}

export function isOwnerKeyUnlocked(unlockedUntilMs: number | null, now = Date.now()) {
  return getOwnerKeyRemainingMs(unlockedUntilMs, now) > 0;
}

export const useOwnerKeyStore = create<OwnerKeyState>()(
  persist(
    (set, get) => ({
      mode: 'NORMAL',
      unlockedUntilMs: null,

      setMode: (mode) => set({ mode }),
      unlockForMs: (ttlMs) => {
        const ms = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
        set({ unlockedUntilMs: Date.now() + ms });
      },
      lock: () => set({ unlockedUntilMs: null }),
    }),
    {
      name: 'np_owner_key_v1',
      partialize: (s) => ({ unlockedUntilMs: s.unlockedUntilMs }),
    }
  )
);
