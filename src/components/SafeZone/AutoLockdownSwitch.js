import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from "react";
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaShieldAlt } from "react-icons/fa";
import { useNotification } from '@context/NotificationContext';
const AutoLockdownSwitch = () => {
    const notify = useNotification();
    const [lockPin, setLockPin] = useState("");
    const [unlockPin, setUnlockPin] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState(null);
    // Hide status after 3 seconds on success or error
    React.useEffect(() => {
        if (status === "success" || status === "error") {
            const timer = setTimeout(() => setStatus("idle"), 2500);
            return () => clearTimeout(timer);
        }
        // Explicitly return nothing (undefined)
        return () => { };
    }, [status]);
    const resetStatus = () => {
        setStatus("idle");
        setMessage(null);
    };
    const triggerLockdown = async () => {
        if (!confirmed || !lockPin || status === "locking")
            return;
        setStatus("locking");
        setMessage(null);
        try {
            const data = await fetchJson(`${API_BASE_PATH}/system/emergency-lock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: lockPin }),
            });
            if (data.success ?? true) {
                setStatus("success");
                setMessage("✅ Lockdown activated successfully!");
                setLockPin("");
                setConfirmed(false);
                notify.success('🚨 Lockdown activated');
            }
            else {
                setStatus("error");
                setMessage(data?.error || "❌ Invalid PIN or server error.");
                notify.error(data?.error || '❌ Lockdown activation failed');
            }
        }
        catch (e) {
            setStatus("error");
            setMessage("❌ Server error. Please try again.");
            notify.error('❌ Server error during lockdown');
        }
    };
    const triggerUnlock = async () => {
        if (!unlockPin || status === "unlocking")
            return;
        setStatus("unlocking");
        setMessage(null);
        try {
            const data = await fetchJson(`${API_BASE_PATH}/system/emergency-unlock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: unlockPin }),
            });
            if (data.success ?? true) {
                setStatus("success");
                setMessage("✅ Lockdown deactivated!");
                setUnlockPin("");
                notify.success('🔓 Lockdown deactivated');
            }
            else {
                setStatus("error");
                setMessage(data?.error || "❌ Invalid PIN or server error.");
                notify.error(data?.error || '❌ Unlock failed');
            }
        }
        catch (e) {
            setStatus("error");
            setMessage("❌ Server error. Please try again.");
            notify.error('❌ Server error during unlock');
        }
    };
    return (_jsxs("section", { className: "p-5 md:p-6 bg-red-50 dark:bg-red-900/10 border border-red-500/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-2", children: "\u2705 AutoLockdownSwitch Loaded" }), _jsxs("h2", { className: "text-xl font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2", children: [_jsx(FaShieldAlt, { className: "text-red-500" }), "Auto Lockdown Switch"] }), _jsxs("ul", { className: "list-disc list-inside ml-3 text-sm md:text-base space-y-1 text-gray-800 dark:text-gray-200", children: [_jsx("li", { children: "\uD83C\uDF69 Disables all admin tools, pipelines, and AI triggers" }), _jsx("li", { children: "\uD83D\uDD12 Blocks new logins and freezes access until reset" }), _jsx("li", { children: "\uD83D\uDCE3 Alerts the founder immediately" })] }), _jsx("input", { type: "password", "aria-label": "Lock PIN", placeholder: "Enter Lock PIN", value: lockPin, onChange: (e) => {
                    setLockPin(e.target.value);
                    resetStatus();
                }, className: "mt-4 px-3 py-2 rounded border border-red-400 text-sm w-full dark:bg-red-800/10", autoComplete: "off" }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx("input", { type: "checkbox", id: "confirm", checked: confirmed, onChange: (e) => {
                            setConfirmed(e.target.checked);
                            resetStatus();
                        }, className: "accent-red-600" }), _jsx("label", { htmlFor: "confirm", className: "text-red-700 dark:text-red-300 text-sm", children: "I confirm to initiate full lockdown" })] }), _jsx("button", { onClick: triggerLockdown, disabled: !confirmed || !lockPin || status === "locking", className: `mt-3 px-4 py-2 rounded-md font-semibold text-white transition duration-200 w-full ${confirmed && lockPin
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-red-300 cursor-not-allowed"}`, children: status === "locking" ? "Locking down..." : "🔐 Activate Lockdown" }), _jsx("input", { type: "password", "aria-label": "Unlock PIN", placeholder: "Enter Unlock PIN", value: unlockPin, onChange: (e) => {
                    setUnlockPin(e.target.value);
                    resetStatus();
                }, className: "mt-6 px-3 py-2 rounded border border-green-500 text-sm w-full dark:bg-green-800/10", autoComplete: "off" }), _jsx("button", { onClick: triggerUnlock, disabled: !unlockPin || status === "unlocking", className: `mt-2 px-4 py-2 rounded-md font-semibold text-white transition duration-200 w-full ${unlockPin
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-green-300 cursor-not-allowed"}`, children: status === "unlocking" ? "Unlocking..." : "🔓 Deactivate Lockdown" }), message && (_jsx("p", { className: `font-mono mt-2 ${status === "success"
                    ? "text-green-600"
                    : status === "error"
                        ? "text-red-600"
                        : ""}`, children: message }))] }));
};
export default AutoLockdownSwitch;
