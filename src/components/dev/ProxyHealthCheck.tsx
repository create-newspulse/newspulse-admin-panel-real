// DEV-only component to test proxy connectivity
import { useState } from 'react';

export function ProxyHealthCheck() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testHealth = async () => {
    setLoading(true);
    setResult('Testing...');
    try {
      const res = await fetch('/admin-api/system/health', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      setResult(`✅ ${res.status} - ${JSON.stringify(data, null, 2)}`);
    } catch (e: any) {
      setResult(`❌ Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testSettingsNoAuth = async () => {
    setLoading(true);
    setResult('Testing settings without auth...');
    try {
      const res = await fetch('/admin-api/admin/settings/public', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401) {
        setResult('✅ 401 Unauthorized (endpoint exists, needs auth)');
      } else if (res.status === 404) {
        setResult('❌ 404 Not Found (endpoint missing on backend)');
      } else {
        const data = await res.json();
        setResult(`✅ ${res.status} - ${JSON.stringify(data, null, 2)}`);
      }
    } catch (e: any) {
      setResult(`❌ Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testSettingsWithAuth = async () => {
    setLoading(true);
    setResult('Testing settings with auth...');
    try {
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        setResult('❌ No token found in localStorage. Login first.');
        setLoading(false);
        return;
      }

      const res = await fetch('/admin-api/admin/settings/public', {
        method: 'GET',
        headers: { 
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
      });
      
      if (res.status === 401) {
        setResult('❌ 401 Unauthorized (token invalid/expired)');
      } else if (res.status === 404) {
        setResult('❌ 404 Not Found (endpoint missing on backend)');
      } else if (res.ok) {
        const data = await res.json();
        setResult(`✅ ${res.status} - Settings loaded successfully\n${JSON.stringify(data, null, 2).substring(0, 500)}...`);
      } else {
        setResult(`⚠️ ${res.status} ${res.statusText}`);
      }
    } catch (e: any) {
      setResult(`❌ Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 max-w-md z-50">
      <h3 className="font-bold text-sm mb-2">🔧 Proxy Health Check (DEV)</h3>
      <div className="flex flex-col gap-2">
        <button
          onClick={testHealth}
          disabled={loading}
          className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test /system/health
        </button>
        <button
          onClick={testSettingsNoAuth}
          disabled={loading}
          className="px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 disabled:opacity-50"
        >
          Test /settings/public (no auth)
        </button>
        <button
          onClick={testSettingsWithAuth}
          disabled={loading}
          className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test /settings/public (with token)
        </button>
        {result && (
          <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto max-h-40">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
