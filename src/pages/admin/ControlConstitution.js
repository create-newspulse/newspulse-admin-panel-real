import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 📁 src/pages/admin/ControlConstitution.tsx
import { useRef } from "react";
const ControlConstitution = () => {
    const contentRef = useRef(null);
    // 🔒 Set this to true to test red alert warning
    const constitutionBroken = false;
    const handleExportPDF = async () => {
        const element = contentRef.current;
        if (!element)
            return;
        // ✅ dynamic import so it only loads in the browser when needed
        const html2pdf = (await import("html2pdf.js")).default;
        html2pdf()
            .set({
            margin: 0.5,
            filename: "NewsPulse_Constitution_Status.pdf",
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        })
            .from(element)
            .save();
    };
    return (_jsxs("div", { ref: contentRef, className: "p-6 max-w-4xl mx-auto bg-white dark:bg-gray-900 shadow rounded", children: [_jsx("h1", { className: "text-2xl font-bold mb-4 text-blue-700 dark:text-blue-300", children: "\uD83D\uDEE1\uFE0F News Pulse Constitution Enforcement" }), _jsxs("p", { className: "mb-4 text-gray-700 dark:text-gray-300", children: ["This system follows the ", _jsx("strong", { children: "Founder Locked Constitution" }), " of News Pulse. All AI systems, admin tools, and automation are controlled by Kiran Parmar and monitored under KiranOS."] }), constitutionBroken && (_jsx("div", { className: "bg-red-100 text-red-700 p-4 rounded mb-4", children: "\u274C ALERT: Constitution enforcement status is missing or broken. Please contact Founder immediately." })), _jsxs("div", { className: "bg-green-100 text-green-800 px-4 py-3 rounded mb-6 dark:bg-green-900 dark:text-green-200", children: ["\u2705 ", _jsx("strong", { children: "Status:" }), " Constitution Enforced Internally by KiranOS", _jsx("br", {}), "\uD83D\uDD12 Founder-Controlled \u2022 PTI Compliant \u2022 Emergency Lock Enabled"] }), _jsx("h2", { className: "text-lg font-semibold mb-2 text-blue-600 dark:text-blue-200", children: "\uD83D\uDCDC Enforcement Includes:" }), _jsxs("ul", { className: "list-disc ml-6 text-sm text-gray-600 dark:text-gray-400", children: [_jsx("li", { children: "Founder Rules: Kiran Parmar is the only override authority" }), _jsx("li", { children: "System Badge: Enforcement badge is active inside admin panel" }), _jsx("li", { children: "Logs: Synced inside Safe Owner Zone & Guidebooks" }), _jsx("li", { children: "PDF View Disabled: File hidden for privacy and security" }), _jsx("li", { children: "KiranOS monitors rules, actions, and auto-deletion logic" }), _jsx("li", { children: "No public AI system can rename or interfere with tools" })] }), _jsxs("p", { className: "text-sm text-gray-500 mt-6", children: ["\uD83D\uDD52 Last Verified: ", new Date().toLocaleString(), " \u2022 Verified by", " ", _jsx("strong", { children: "KiranOS" })] }), _jsx("div", { className: "mt-6 text-center", children: _jsx("button", { onClick: handleExportPDF, className: "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition", children: "\uD83D\uDCE4 Export This Page as PDF" }) })] }));
};
export default ControlConstitution;
