import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { PUBLISH_ENABLED } from '@/config/publishing';
import { useAuth } from '@/context/AuthContext';

interface PublishFlagContextValue {
  publishEnabled: boolean;          // effective flag (env default overridden by founder toggle if set)
  override: boolean | null;         // explicit override value, null means none
  setOverride: (value: boolean | null) => void; // founder-only toggle setter
  envDefault: boolean;              // original env default
}

const PublishFlagContext = createContext<PublishFlagContextValue | undefined>(undefined);
const STORAGE_KEY = 'np_publish_enabled_override';

export const PublishFlagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isFounder } = useAuth();
  const envDefault = PUBLISH_ENABLED;
  const [override, setOverrideState] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'true') setOverrideState(true);
      else if (raw === 'false') setOverrideState(false);
    } catch {}
  }, []);

  const setOverride = useCallback((value: boolean | null) => {
    setOverrideState(value);
    try {
      if (value === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch {}
  }, []);

  // Founder can override; others ignore stored override
  const effective = (isFounder && override !== null) ? override : envDefault;

  return (
    <PublishFlagContext.Provider value={{ publishEnabled: effective, override, setOverride, envDefault }}>
      {children}
    </PublishFlagContext.Provider>
  );
};

export function usePublishFlag(): PublishFlagContextValue {
  const ctx = useContext(PublishFlagContext);
  if (!ctx) throw new Error('usePublishFlag must be used within PublishFlagProvider');
  return ctx;
}
