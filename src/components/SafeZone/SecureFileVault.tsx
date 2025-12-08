import { useState } from 'react';
const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;
import { useNotification } from '@context/NotificationContext';
import {
  FaFileDownload, FaClock, FaUpload, FaTrash
} from 'react-icons/fa';

const SecureFileVault = () => {
  const notify = useNotification();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    setMessage(null);
    setError(null);
    setMessage('🛡️ Vault PDF export feature is coming soon.');
  };

  const handleDownload = () => {
    setMessage(null);
    setError(null);
  window.open(`${API_BASE}/backups/latest.zip`, '_blank');
  };

  const handleUpload = () => {
    setMessage(null);
    setError(null);

    if (!file) {
      setError('⚠️ Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('vault', file);

    fetch(`${API_BASE}/vault/upload`, {
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
          setMessage('✅ Vault file uploaded securely.');
          setFile(null);
          notify.success('🔐 Vault file uploaded');
        } else {
          setError('❌ Upload failed.');
          notify.error('❌ Vault upload failed');
        }
      })
      .catch(err => {
        console.error('Upload error:', err);
        setError('🚫 Upload failed. Please try again.');
        notify.error('🚫 Upload failed. Please try again.');
      });
  };

  const handleDelete = () => {
    setMessage(null);
    setError(null);
    setMessage('🧨 Legacy vault deletion feature is coming soon.');
  };

  return (
    <section className="p-5 md:p-6 bg-yellow-50 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-600 rounded-2xl shadow max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <span className="text-green-600 font-mono text-sm">✅ SecureFileVault Loaded</span>
        <button
          onClick={handleExport}
          className="text-xs text-blue-600 dark:text-blue-300 hover:underline"
        >
          🖨️ Export Vault Report
        </button>
      </div>

      <h2 className="text-xl font-bold text-yellow-700 dark:text-yellow-300 mb-3">
        📦 Secure File Vault
      </h2>

      <p className="text-sm md:text-base text-slate-700 dark:text-slate-200 mb-4">
        This module provides encrypted storage and protected backups for your platform’s
        critical files, configuration data, and internal keys.
      </p>

      {message && <p className="text-green-600 text-sm mb-3">{message}</p>}
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <ul className="list-inside space-y-4 text-sm text-slate-800 dark:text-slate-100">
        <li className="flex items-center gap-2">
          <FaFileDownload className="text-blue-500" />
          <button onClick={handleDownload} className="hover:underline text-left">
            Download protected site configuration archive
          </button>
        </li>

        <li className="flex items-center gap-2">
          <FaClock className="text-purple-500" />
          <span>View recent backup snapshots (coming soon)</span>
        </li>

        <li className="flex items-start gap-3">
          <FaUpload className="text-green-600 mt-1" />
          <div className="flex flex-col md:flex-row gap-2 w-full">
            <input
              type="file"
              accept=".zip,.vault"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs border border-slate-300 dark:border-slate-600 p-1 rounded w-full"
            />
            <button
              onClick={handleUpload}
              className="px-3 py-1 bg-green-200 dark:bg-green-700 text-xs rounded hover:bg-green-300 dark:hover:bg-green-600"
            >
              Upload Vault
            </button>
          </div>
        </li>

        <li className="flex items-center gap-2">
          <FaTrash className="text-red-500" />
          <button
            onClick={handleDelete}
            className="hover:underline text-left text-red-600 dark:text-red-400 text-sm"
          >
            Delete legacy data securely
          </button>
        </li>
      </ul>
    </section>
  );
};

export default SecureFileVault;
