import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaRedo, FaDatabase, FaCloudUploadAlt } from "react-icons/fa";
import { useNotification } from '@context/NotificationContext';
const BackupAndRecovery = () => {
    const notify = useNotification();
    const [status, setStatus] = useState("idle");
    const [uploading, setUploading] = useState(false);
    const [uploadDone, setUploadDone] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const runBackup = async () => {
        setStatus("loading");
        setUploadDone(false);
        setErrorMsg(null);
        try {
            const data = await fetchJson(`${API_BASE_PATH}/system/run-backup`, { method: "POST" });
            if (data.success ?? true) {
                setStatus("success");
                notify.success('💾 Backup completed');
            }
            else {
                setStatus("error");
                setErrorMsg(data?.error || "Backup failed. Check server logs.");
                notify.error(data?.error || '❌ Backup failed');
            }
        }
        catch (err) {
            setStatus("error");
            setErrorMsg("❌ Backup Trigger Error: " + (err?.message || "Unknown error."));
            notify.error('❌ Backup trigger error');
        }
    };
    const uploadToFirebase = async () => {
        setUploading(true);
        setErrorMsg(null);
        try {
            const data = await fetchJson(`${API_BASE_PATH}/system/firebase-upload-latest`, { method: "POST" });
            if (data.success ?? true) {
                setUploadDone(true);
                notify.success('☁️ Backup uploaded to Firebase');
            }
            else {
                setUploadDone(false);
                setErrorMsg(data?.error || "Upload failed. Check server logs.");
                notify.error(data?.error || '❌ Firebase upload failed');
            }
        }
        catch (err) {
            setUploadDone(false);
            setErrorMsg("❌ Firebase Upload Error: " + (err?.message || "Unknown error."));
            notify.error('❌ Firebase upload error');
        }
        finally {
            setUploading(false);
        }
    };
    return (_jsxs("section", { className: "p-5 md:p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-500/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-2", children: "\u2705 BackupAndRecovery Loaded" }), _jsxs("h2", { className: "text-xl font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2", children: [_jsx(FaDatabase, {}), " Backup & Recovery"] }), _jsxs("div", { className: "space-y-3 text-sm md:text-base text-gray-800 dark:text-gray-200", children: [_jsxs("ul", { className: "list-disc list-inside ml-3 space-y-1", children: [_jsx("li", { children: "\uD83D\uDCE5 Download full MongoDB backup" }), _jsx("li", { children: "\uD83D\uDCE6 Export system settings & configurations" }), _jsx("li", { children: "\uD83D\uDD01 Restore from previous stable backup" }), _jsx("li", { children: "\uD83E\uDDEC Rollback AI story engine to last known good state (Beta)" })] }), _jsxs("button", { onClick: runBackup, disabled: status === "loading", className: `mt-3 px-4 py-2 rounded-md font-semibold text-white transition duration-200 flex items-center gap-2 ${status === "loading" ? "bg-blue-300 cursor-wait" : "bg-blue-600 hover:bg-blue-700"}`, children: [_jsx(FaRedo, {}), status === "loading" ? "Running Backup..." : "🔁 Run Backup Now"] }), status === "success" && (_jsxs(_Fragment, { children: [_jsx("a", { href: `${API_BASE_PATH}/backups/latest.zip`, download: true, className: "text-blue-600 underline text-sm block mt-2", children: "\uD83D\uDCE6 Download latest backup (.zip)" }), _jsxs("button", { onClick: uploadToFirebase, disabled: uploading, className: "mt-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md flex items-center gap-2", children: [_jsx(FaCloudUploadAlt, {}), uploading ? "Uploading to Firebase..." : "☁️ Upload to Firebase"] }), uploadDone && (_jsx("p", { className: "text-green-600 text-xs font-mono mt-1", children: "\u2705 Backup uploaded to Firebase successfully." }))] })), status === "error" && (_jsx("p", { className: "text-red-600 font-mono text-sm", children: errorMsg || "❌ Backup failed. Check server logs." })), uploadDone === false && errorMsg && status !== "error" && (_jsx("p", { className: "text-red-600 font-mono text-xs", children: errorMsg })), _jsx("div", { className: "mt-4 text-xs text-blue-600 dark:text-blue-300 font-mono", children: "\uD83D\uDCBE Tip: It\u2019s recommended to download backups before making large updates." })] })] }));
};
export default BackupAndRecovery;
