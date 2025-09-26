
const PanelGuide = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-blue-700">📘 Panel Guide</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Welcome to the Safe Owner Panel Guide. This section helps founders understand the tools, access levels,
        and emergency options inside the secure admin environment.
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm space-y-1">
        <li>🛡️ Emergency Lock Controls</li>
        <li>⚙️ AI Manager System (KiranOS)</li>
        <li>🔐 Secure File Vault</li>
        <li>🧠 Auto Publishing Flow</li>
      </ul>
    </div>
  );
};

export default PanelGuide;
