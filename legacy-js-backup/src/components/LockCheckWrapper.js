import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@lib/api';
import SignatureUnlock from './SafeZone/SignatureUnlock';
export default function LockCheckWrapper({ children }) {
    const [loading, setLoading] = useState(true);
    const [bypass, setBypass] = useState(false);
    const [locked, setLocked] = useState(false);
    useEffect(() => {
        apiClient.get('/settings/load')
            .then((res) => {
            const settings = res?.data ?? res ?? {};
            if (settings.lockdown) {
                setLocked(true);
                toast.error('≡ƒöÆ Lockdown Mode is active. Signature required.');
            }
        })
            .catch(() => {
            toast.error('ΓÜá∩╕Å Could not verify lockdown status.');
        })
            .finally(() => setLoading(false));
    }, []);
    const handleUnlockSuccess = async () => {
        try {
            await apiClient.post('/unlock-log', {
                time: new Date().toISOString(),
                method: 'signature',
                status: 'verified',
            });
        }
        catch (err) {
            console.warn('Unlock log failed:', err);
        }
        finally {
            setBypass(true);
        }
    };
    if (loading) {
        return _jsx("div", { className: "text-center py-10 text-gray-500", children: "\u23F3 Checking lockdown..." });
    }
    if (locked && !bypass) {
        return _jsx(SignatureUnlock, { onSuccess: handleUnlockSuccess });
    }
    return _jsx(_Fragment, { children: children });
}
