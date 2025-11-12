import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '@lib/api';
// Default context value
const AITrainingInfoContext = createContext({
    info: null,
    loading: true,
    error: null,
});
export function AITrainingInfoProvider({ children }) {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        setLoading(true);
        apiClient.get('/system/ai-training-info')
            .then(res => {
            setInfo(res.data?.data ?? null);
            setError(null);
        })
            .catch(() => setError('Failed to load AI training info.'))
            .finally(() => setLoading(false));
    }, []);
    return (_jsx(AITrainingInfoContext.Provider, { value: { info, loading, error }, children: children }));
}
export function useAITrainingInfo() {
    return useContext(AITrainingInfoContext);
}
