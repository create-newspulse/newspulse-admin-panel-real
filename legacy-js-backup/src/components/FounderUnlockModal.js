import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const FounderUnlockModal = ({ isOpen, onClose, onSubmit, }) => {
    const [code, setCode] = useState('');
    // Γî¿∩╕Å Close on ESC key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape')
                onClose();
            if (e.key === 'Enter' && code.trim())
                onSubmit(code);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [code, onClose, onSubmit]);
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center", children: _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4", children: [_jsx("h2", { className: "text-xl font-bold text-slate-800 dark:text-white", children: "\uD83D\uDD10 Founder Reactivation" }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-300", children: "Enter your Founder Reactivation Code to unlock system access." }), _jsx("input", { type: "password", className: "w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-black dark:text-white", value: code, onChange: (e) => setCode(e.target.value), placeholder: "Enter secret code", autoFocus: true }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { className: "px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md", onClick: () => {
                                setCode('');
                                onClose();
                            }, children: "Cancel" }), _jsx("button", { className: "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-50", onClick: () => {
                                if (code.trim()) {
                                    onSubmit(code.trim());
                                    setCode('');
                                }
                            }, disabled: !code.trim(), children: "Unlock" })] })] }) }));
};
export default FounderUnlockModal;
