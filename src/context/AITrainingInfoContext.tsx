import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { adminApiClient } from '@/lib/adminApiClient';
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
  const location = useLocation();
  const isAuthPage = ['/login', '/admin/login', '/employee/login'].some((p) => {
    const current = location.pathname || '';
    return current === p || current.startsWith(`${p}/`);
  });

  useEffect(() => {
    // Wait until auth hydration completes; avoid auto-401 on first paint.
    if (!isReady) return;
    // Don't make protected calls from public login routes.
    if (isAuthPage) {
      setLoading(false);
      setError(null);
      return;
    }
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await adminApiClient.get('/api/admin/system/ai-training-info');
        const json = res.data as { data?: AITrainingInfo };
        if (cancelled) return;
        setInfo(json?.data ?? null);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        const status = e?.response?.status ?? e?.status;
        // 401/403 is normal when not logged in (or session expired).
        if (status === 401 || status === 403) {
          setError(null);
          setInfo(null);
          return;
        }
        setError('Failed to load AI training info.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, token, isAuthPage]);

  return (
    <AITrainingInfoContext.Provider value={{ info, loading, error }}>
      {children}
    </AITrainingInfoContext.Provider>
  );
}

export function useAITrainingInfo() {
  return useContext(AITrainingInfoContext);
}
