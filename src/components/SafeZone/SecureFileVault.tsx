import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { useAuth } from '@context/AuthContext';
import { useNotification } from '@context/NotificationContext';
import {
  FaFileDownload, FaClock, FaUpload, FaTrash
} from 'react-icons/fa';

type VaultItem = {
  id?: string;
  filename?: string;
  name?: string;
  url?: string;
  downloadUrl?: string;
  createdAt?: string;
  size?: number;
};

const SecureFileVault = () => {
  const notify = useNotification();
  const { isAuthenticated, isFounder, isReady } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUseVault = isReady && isAuthenticated && isFounder;

  const baseForDownloads = useMemo(() => {
    const base = (apiClient.defaults.baseURL || '').toString().replace(/\/+$/, '');
    return base;
  }, []);

  const vaultListQuery = useQuery({
    queryKey: ['vault', 'list'],
    enabled: canUseVault,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get('/vault/list', {
        // @ts-expect-error custom flag consumed by api.ts interceptor
        skipErrorLog: true,
      });
      const data = (res as any)?.data;
      const items = data?.items ?? data?.data?.items ?? data ?? [];
      return Array.isArray(items) ? (items as VaultItem[]) : ([] as VaultItem[]);
    },
  });

  const handleExport = () => {
    setMessage(null);
    setError(null);
    setMessage('🛡️ Vault PDF export feature is coming soon.');
  };

  const handleDownload = () => {
    setMessage(null);
    setError(null);
    if (!baseForDownloads) {
      setError('Download unavailable (missing API base).');
      return;
    }
    window.open(`${baseForDownloads}/backups/latest.zip`, '_blank');
  };

  const handleUpload = () => {
    setMessage(null);
    setError(null);

    if (!canUseVault) {
      setError('Founder access required.');
      return;
    }

    if (!file) {
      setError('⚠️ Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('vault', file);
    apiClient
      .post('/vault/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // @ts-expect-error custom flag consumed by api.ts interceptor
        skipErrorLog: true,
      })
      .then((res) => {
        const data = (res as any)?.data ?? {};
        if (data.success || data.ok) {
          setMessage('✅ Vault file uploaded securely.');
          setFile(null);
          notify.success('🔐 Vault file uploaded');
          vaultListQuery.refetch();
        } else {
          setError('❌ Upload failed.');
          notify.error('❌ Vault upload failed');
        }
      })
      .catch((err: any) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          setError('Founder access required.');
          return;
        }
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

      {isReady && (!isAuthenticated || !isFounder) ? (
        <div className="mb-4 text-sm text-slate-700 dark:text-slate-200">
          Founder access required
        </div>
      ) : null}

      {message && <p className="text-green-600 text-sm mb-3">{message}</p>}
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {canUseVault ? (
        <div className="mb-4">
          <div className="text-sm font-semibold mb-2">Vault files</div>
          {vaultListQuery.isLoading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : vaultListQuery.isError ? (
            <div className="text-sm text-slate-600">
              {(() => {
                const st = (vaultListQuery.error as any)?.response?.status;
                if (st === 401 || st === 403) return 'Founder access required';
                return 'Could not load vault files';
              })()}
            </div>
          ) : (vaultListQuery.data?.length || 0) === 0 ? (
            <div className="text-sm text-slate-600">No vault files yet.</div>
          ) : (
            <div className="space-y-1">
              {vaultListQuery.data!.map((it, idx) => {
                const label = String(it.filename || it.name || it.url || it.downloadUrl || `File ${idx + 1}`);
                return (
                  <div key={it.id || it.filename || it.name || it.url || String(idx)} className="text-xs text-slate-700 dark:text-slate-200">
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

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
              disabled={!canUseVault}
            />
            <button
              onClick={handleUpload}
              className="px-3 py-1 bg-green-200 dark:bg-green-700 text-xs rounded hover:bg-green-300 dark:hover:bg-green-600"
              disabled={!canUseVault}
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
