import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import { API_BASE_PATH } from '@lib/api';

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

  useEffect(() => {
    setLoading(true);
  axios.get(`${API_BASE_PATH}/system/ai-training-info`, { withCredentials: true })
      .then(res => {
        setInfo(res.data?.data ?? null);
        setError(null);
      })
      .catch(() => setError('Failed to load AI training info.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AITrainingInfoContext.Provider value={{ info, loading, error }}>
      {children}
    </AITrainingInfoContext.Provider>
  );
}

export function useAITrainingInfo() {
  return useContext(AITrainingInfoContext);
}
