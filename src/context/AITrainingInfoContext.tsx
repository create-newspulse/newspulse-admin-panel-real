import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { adminJson } from '@/lib/adminApiClient';
import { useAuth } from '@context/AuthContext';

// Define the type for the training info (customize as per your real data)
interface AITrainingInfo {
  lastTraining: string | null;
  nextTraining: string | null;
  articlesAnalyzed: number;
  keywords: number;
  patternFocus: string;
  modulesTrained: string[];
  lockedByFounder: boolean;
  version: string;
}

// Define the context type
interface AITrainingInfoContextType {
  info: AITrainingInfo | null;
  loading: boolean;
  error: string | null;
}

// Default context value
const AITrainingInfoContext = createContext<AITrainingInfoContextType>({
  info: null,
  loading: true,
  error: null,
});

// Props interface for the provider
interface ProviderProps {
  children: ReactNode;
}

export function AITrainingInfoProvider({ children }: ProviderProps) {
  const [info, setInfo] = useState<AITrainingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isReady } = useAuth();

  useEffect(() => {
    // Wait until auth hydration completes; avoid auto-401 on first paint.
    if (!isReady) return;
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const json = await adminJson<{ data: AITrainingInfo }>('api/admin/system/ai-training-info');
        if (cancelled) return;
        setInfo(json?.data ?? null);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError('Failed to load AI training info.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, token]);

  return (
    <AITrainingInfoContext.Provider value={{ info, loading, error }}>
      {children}
    </AITrainingInfoContext.Provider>
  );
}

export function useAITrainingInfo() {
  return useContext(AITrainingInfoContext);
}
