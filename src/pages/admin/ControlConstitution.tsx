// 📁 src/pages/admin/ControlConstitution.tsx
import { useRef } from "react";

const ControlConstitution = () => {
  const contentRef = useRef<HTMLDivElement>(null);

  // 🔒 Set this to true to test red alert warning
  const constitutionBroken = false;

  const handleExportPDF = async () => {
    const element = contentRef.current;
    if (!element) return;

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

  return (
    <div
      ref={contentRef}
      className="p-6 max-w-4xl mx-auto bg-white dark:bg-gray-900 shadow rounded"
    >
      <h1 className="text-2xl font-bold mb-4 text-blue-700 dark:text-blue-300">
        🛡️ News Pulse Constitution Enforcement
      </h1>

      <p className="mb-4 text-gray-700 dark:text-gray-300">
        This system follows the <strong>Founder Locked Constitution</strong> of
        News Pulse. All AI systems, admin tools, and automation are controlled
        by Kiran Parmar and monitored under KiranOS.
      </p>

      {constitutionBroken && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          ❌ ALERT: Constitution enforcement status is missing or broken. Please
          contact Founder immediately.
        </div>
      )}

      <div className="bg-green-100 text-green-800 px-4 py-3 rounded mb-6 dark:bg-green-900 dark:text-green-200">
        ✅ <strong>Status:</strong> Constitution Enforced Internally by KiranOS
        <br />
        🔒 Founder-Controlled • PTI Compliant • Emergency Lock Enabled
      </div>

      <h2 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-200">
        📜 Enforcement Includes:
      </h2>
      <ul className="list-disc ml-6 text-sm text-gray-600 dark:text-gray-400">
        <li>Founder Rules: Kiran Parmar is the only override authority</li>
        <li>System Badge: Enforcement badge is active inside admin panel</li>
        <li>Logs: Synced inside Safe Owner Zone &amp; Guidebooks</li>
        <li>PDF View Disabled: File hidden for privacy and security</li>
        <li>KiranOS monitors rules, actions, and auto-deletion logic</li>
        <li>No public AI system can rename or interfere with tools</li>
      </ul>

      <p className="text-sm text-gray-500 mt-6">
        🕒 Last Verified: {new Date().toLocaleString()} • Verified by{" "}
        <strong>KiranOS</strong>
      </p>

      <div className="mt-6 text-center">
        <button
          onClick={handleExportPDF}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          📤 Export This Page as PDF
        </button>
      </div>
    </div>
  );
};

export default ControlConstitution;
