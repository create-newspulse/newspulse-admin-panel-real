import { Link } from 'react-router-dom';

export default function SettingsHome() {
  const apiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  const missingApi = !apiUrl;

  return (
    <div className="space-y-4">
      <p className="text-slate-700">Configure NewsPulse admin settings. Use the sidebar to navigate.</p>
      {missingApi && (
        <div className="p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-800">
          Warning: VITE_API_URL is not set. Settings API calls will be disabled.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded border border-slate-200 bg-white">
          <h2 className="text-lg font-semibold mb-2">Frontend UI</h2>
          <p className="text-sm text-slate-600 mb-3">Toggle visibility of UI elements such as strips and tickers.</p>
          <Link to="/admin/settings/frontend-ui" className="inline-block px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-500">Open Frontend UI Settings</Link>
        </div>
      </div>
    </div>
  );
}
// removed duplicate legacy placeholders to ensure a single default export
