import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@lib/api';
export default function UpdateFounderPIN() {
    const [newPin, setNewPin] = useState('');
    const [loading, setLoading] = useState(false);
    const handleUpdate = async () => {
        if (!newPin) {
            toast.error('PIN cannot be empty');
            return;
        }
        setLoading(true);
        try {
            await apiClient.post('/founder/update-pin', { pin: newPin });
            toast.success('✅ Founder PIN updated!');
            setNewPin('');
        }
        catch (err) {
            toast.error('❌ Failed to update PIN');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "max-w-md mx-auto mt-10 p-6 bg-white dark:bg-slate-800 rounded-xl shadow", children: [_jsx("h2", { className: "text-xl font-bold mb-4 text-slate-800 dark:text-white", children: "\uD83D\uDD01 Update Founder PIN" }), _jsx("input", { type: "password", value: newPin, onChange: (e) => setNewPin(e.target.value), placeholder: "Enter new PIN", className: "w-full px-4 py-2 mb-4 border rounded bg-gray-100 dark:bg-slate-700 text-black dark:text-white" }), _jsx("button", { onClick: handleUpdate, disabled: loading, className: "bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700 disabled:opacity-50", children: loading ? 'Saving...' : 'Update PIN' })] }));
}
