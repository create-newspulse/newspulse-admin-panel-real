import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { useNotification } from '@context/NotificationContext';
import { FaFileDownload, FaClock, FaUpload, FaTrash } from 'react-icons/fa';
const SecureFileVault = () => {
    const notify = useNotification();
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const handleExport = () => {
        setMessage(null);
        setError(null);
        setMessage('≡ƒ¢í∩╕Å Vault PDF export feature is coming soon.');
    };
    const handleDownload = () => {
        setMessage(null);
        setError(null);
        window.open(`${API_BASE_PATH}/backups/latest.zip`, '_blank');
    };
    const handleUpload = () => {
        setMessage(null);
        setError(null);
        if (!file) {
            setError('ΓÜá∩╕Å Please select a file first.');
            return;
        }
        const formData = new FormData();
        formData.append('vault', file);
        fetch(`${API_BASE_PATH}/vault/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        })
            .then(async (res) => {
            const ct = res.headers.get('content-type') || '';
            if (!/application\/json/i.test(ct)) {
                const txt = await res.text().catch(() => '');
                throw new Error(`Unexpected content-type: ${ct}. Preview: ${txt.slice(0, 200)}`);
            }
            return res.json();
        })
            .then(data => {
            if (data.success) {
                setMessage('Γ£à Vault file uploaded securely.');
                setFile(null);
                notify.success('≡ƒöÉ Vault file uploaded');
            }
            else {
                setError('Γ¥î Upload failed.');
                notify.error('Γ¥î Vault upload failed');
            }
        })
            .catch(err => {
            console.error('Upload error:', err);
            setError('≡ƒÜ½ Upload failed. Please try again.');
            notify.error('≡ƒÜ½ Upload failed. Please try again.');
        });
    };
    const handleDelete = () => {
        setMessage(null);
        setError(null);
        setMessage('≡ƒº¿ Legacy vault deletion feature is coming soon.');
    };
    return (_jsxs("section", { className: "p-5 md:p-6 bg-yellow-50 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-600 rounded-2xl shadow max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("span", { className: "text-green-600 font-mono text-sm", children: "\u2705 SecureFileVault Loaded" }), _jsx("button", { onClick: handleExport, className: "text-xs text-blue-600 dark:text-blue-300 hover:underline", children: "\uD83D\uDDA8\uFE0F Export Vault Report" })] }), _jsx("h2", { className: "text-xl font-bold text-yellow-700 dark:text-yellow-300 mb-3", children: "\uD83D\uDCE6 Secure File Vault" }), _jsx("p", { className: "text-sm md:text-base text-slate-700 dark:text-slate-200 mb-4", children: "This module provides encrypted storage and protected backups for your platform\u2019s critical files, configuration data, and internal keys." }), message && _jsx("p", { className: "text-green-600 text-sm mb-3", children: message }), error && _jsx("p", { className: "text-red-500 text-sm mb-3", children: error }), _jsxs("ul", { className: "list-inside space-y-4 text-sm text-slate-800 dark:text-slate-100", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaFileDownload, { className: "text-blue-500" }), _jsx("button", { onClick: handleDownload, className: "hover:underline text-left", children: "Download protected site configuration archive" })] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaClock, { className: "text-purple-500" }), _jsx("span", { children: "View recent backup snapshots (coming soon)" })] }), _jsxs("li", { className: "flex items-start gap-3", children: [_jsx(FaUpload, { className: "text-green-600 mt-1" }), _jsxs("div", { className: "flex flex-col md:flex-row gap-2 w-full", children: [_jsx("input", { type: "file", accept: ".zip,.vault", onChange: (e) => setFile(e.target.files?.[0] || null), className: "text-xs border border-slate-300 dark:border-slate-600 p-1 rounded w-full" }), _jsx("button", { onClick: handleUpload, className: "px-3 py-1 bg-green-200 dark:bg-green-700 text-xs rounded hover:bg-green-300 dark:hover:bg-green-600", children: "Upload Vault" })] })] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaTrash, { className: "text-red-500" }), _jsx("button", { onClick: handleDelete, className: "hover:underline text-left text-red-600 dark:text-red-400 text-sm", children: "Delete legacy data securely" })] })] })] }));
};
export default SecureFileVault;
