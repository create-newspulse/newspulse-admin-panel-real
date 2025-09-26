
const Settings = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-blue-700">⚙️ Founder Settings</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">This page will contain advanced settings for the Founder role.</p>

      <div className="mt-6 space-y-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
          <h2 className="font-semibold mb-2">🛡️ Security Options</h2>
          <p className="text-sm text-slate-500">Manage PIN, login methods, and emergency access.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
          <h2 className="font-semibold mb-2">🎛️ Panel Preferences</h2>
          <p className="text-sm text-slate-500">Toggle modules and customize dashboard layout.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
