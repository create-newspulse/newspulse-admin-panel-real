import React, { useState } from "react";
import { API_BASE_PATH } from '@lib/api';
import { FaRedo, FaDatabase, FaCloudUploadAlt } from "react-icons/fa";

const BackupAndRecovery: React.FC = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runBackup = async () => {
    setStatus("loading");
    setUploadDone(false);
    setErrorMsg(null);
    try {
  const res = await fetch(`${API_BASE_PATH}/system/run-backup`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data?.error || "Backup failed. Check server logs.");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMsg("❌ Backup Trigger Error: " + (err?.message || "Unknown error."));
    }
  };

  const uploadToFirebase = async () => {
    setUploading(true);
    setErrorMsg(null);
    try {
  const res = await fetch(`${API_BASE_PATH}/system/firebase-upload-latest`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadDone(true);
      } else {
        setUploadDone(false);
        setErrorMsg(data?.error || "Upload failed. Check server logs.");
      }
    } catch (err: any) {
      setUploadDone(false);
      setErrorMsg("❌ Firebase Upload Error: " + (err?.message || "Unknown error."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="p-5 md:p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-500/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-2">
        ✅ BackupAndRecovery Loaded
      </p>

      <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
        <FaDatabase /> Backup & Recovery
      </h2>

      <div className="space-y-3 text-sm md:text-base text-gray-800 dark:text-gray-200">
        <ul className="list-disc list-inside ml-3 space-y-1">
          <li>📥 Download full MongoDB backup</li>
          <li>📦 Export system settings & configurations</li>
          <li>🔁 Restore from previous stable backup</li>
          <li>🧬 Rollback AI story engine to last known good state (Beta)</li>
        </ul>

        <button
          onClick={runBackup}
          disabled={status === "loading"}
          className={`mt-3 px-4 py-2 rounded-md font-semibold text-white transition duration-200 flex items-center gap-2 ${
            status === "loading" ? "bg-blue-300 cursor-wait" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <FaRedo />
          {status === "loading" ? "Running Backup..." : "🔁 Run Backup Now"}
        </button>

        {status === "success" && (
          <>
            <a
              href={`${API_BASE_PATH}/backups/latest.zip`}
              download
              className="text-blue-600 underline text-sm block mt-2"
            >
              📦 Download latest backup (.zip)
            </a>

            <button
              onClick={uploadToFirebase}
              disabled={uploading}
              className="mt-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md flex items-center gap-2"
            >
              <FaCloudUploadAlt />
              {uploading ? "Uploading to Firebase..." : "☁️ Upload to Firebase"}
            </button>

            {uploadDone && (
              <p className="text-green-600 text-xs font-mono mt-1">
                ✅ Backup uploaded to Firebase successfully.
              </p>
            )}
          </>
        )}

        {status === "error" && (
          <p className="text-red-600 font-mono text-sm">
            {errorMsg || "❌ Backup failed. Check server logs."}
          </p>
        )}
        {uploadDone === false && errorMsg && status !== "error" && (
          <p className="text-red-600 font-mono text-xs">{errorMsg}</p>
        )}

        <div className="mt-4 text-xs text-blue-600 dark:text-blue-300 font-mono">
          💾 Tip: It’s recommended to download backups before making large updates.
        </div>
      </div>
    </section>
  );
};

export default BackupAndRecovery;
