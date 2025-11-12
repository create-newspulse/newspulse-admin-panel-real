import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@lib/api';
export default function SignatureUnlock({ onSuccess }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post('/founder/verify-pin', { pin });
            const data = response?.data ?? response;
            if (data.success) {
                toast.success('Γ£à Signature verified. Lockdown bypassed.');
                await apiClient.post('/unlock-log', {
                    time: new Date().toISOString(),
                    method: 'signature',
                    status: 'verified',
                });
                onSuccess();
            }
            else {
                setError('Incorrect PIN. Please try again.');
                toast.error('Γ¥î Invalid Signature.');
                await apiClient.post('/unlock-log', {
                    time: new Date().toISOString(),
                    method: 'signature',
                    status: 'failed',
                    attempt: pin,
                });
            }
        }
        catch {
            setError('ΓÜá∩╕Å Unlock request failed.');
            toast.error('Server error. Please try again later.');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-xl shadow border border-gray-300 dark:border-gray-700 max-w-md mx-auto mt-20 text-center animate-fade-in", children: [_jsx("h2", { className: "text-xl font-bold mb-3 text-red-600 dark:text-red-400", children: "\uD83D\uDD10 Lockdown Active" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-300 mb-4", children: "Founder Signature required to continue." }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsx("input", { type: "password", placeholder: "Enter Founder PIN", value: pin, onChange: (e) => setPin(e.target.value), className: "w-full px-4 py-2 rounded border border-gray-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-black dark:text-white focus:outline-none focus:ring", disabled: loading }), error && _jsx("p", { className: "text-sm text-red-500", children: error }), _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition disabled:opacity-50", children: loading ? '≡ƒöä Verifying...' : 'Γ£à Unlock Access' })] }), _jsx("p", { className: "text-xs text-gray-400 dark:text-slate-400 mt-4", children: "Founder-only override. All attempts are securely logged." })] }));
}
