import { useEffect } from 'react';
import { FaClock, FaMapMarkerAlt, FaFolderOpen, FaShieldAlt } from 'react-icons/fa';

const LoginRecordTracker = () => {
  useEffect(() => {
    console.log("🔐 LoginRecordTracker active – monitoring login history...");
  }, []);

  return (
    <section className="p-5 md:p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-300/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <div className="mb-3">
        <p className="text-green-500 font-mono text-sm">
          ✅ LoginRecordTracker Loaded
        </p>
      </div>

      <h2 className="text-xl font-bold text-purple-800 dark:text-purple-300 mb-2">
        🔐 Login Record Tracker
      </h2>

      <p className="text-sm md:text-base text-slate-700 dark:text-slate-200 mb-3">
        This panel monitors admin login history, device fingerprints, and geographic access points to enhance account security and detect intrusions.
      </p>

      <ul className="ml-3 space-y-2 text-sm md:text-base text-slate-800 dark:text-slate-100">
        <li className="flex items-center gap-2">
          <FaClock className="text-purple-600 dark:text-purple-400" /> Track login timestamps and origin IP addresses
        </li>
        <li className="flex items-center gap-2">
          <FaMapMarkerAlt className="text-pink-500 dark:text-pink-400" /> Monitor location anomalies or unusual login behavior
        </li>
        <li className="flex items-center gap-2">
          <FaFolderOpen className="text-yellow-600 dark:text-yellow-400" /> Export access logs for internal or legal audits
        </li>
        <li className="flex items-center gap-2">
          <FaShieldAlt className="text-blue-600 dark:text-blue-400" /> Syncs with Guardian & Compliance Audit Panels
        </li>
      </ul>

      <p className="mt-5 text-xs italic text-purple-500 dark:text-purple-300">
        📌 Real-time login detection and alerting system coming soon...
      </p>
    </section>
  );
};

export default LoginRecordTracker;
