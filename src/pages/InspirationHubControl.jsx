import { useEffect, useMemo, useState } from "react";
import apiClient from "@lib/api";

export default function InspirationHubControl() {
  const [mode, setMode] = useState("inspiration");
  const [embedCode, setEmbedCode] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const res = await apiClient.get('/live-content');
        const data = res?.data ?? res;
        setMode(data?.mode || "inspiration");
        setEmbedCode(data?.embedCode || "");
        setUpdatedAt(data?.updatedAt || "");
      } catch (e) {
        console.warn("Failed to load live-content", e);
      }
    };
    run();
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const res = await apiClient.post('/live-content/update', { mode, embedCode });
      const data = res?.data ?? res;
      setUpdatedAt(data?.updatedAt);
      setMsg("Saved ✅");
    } catch (e) {
      setMsg("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(() => ({ __html: embedCode }), [embedCode]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Inspiration Hub Control</h1>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border border-slate-200 dark:border-slate-700">
        <label className="font-semibold block mb-2">Mode</label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="inspiration" checked={mode==="inspiration"} onChange={e=>setMode(e.target.value)} />
            <span>🌟 Inspiration Hub</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="live" checked={mode==="live"} onChange={e=>setMode(e.target.value)} />
            <span>📡 Live TV</span>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border border-slate-200 dark:border-slate-700">
        <label className="font-semibold block mb-2">Embed Code</label>
        <textarea className="w-full min-h-[160px] border rounded-lg p-3"
          placeholder="Paste YouTube/Twitter/Facebook embed code"
          value={embedCode} onChange={e=>setEmbedCode(e.target.value)} />
        <p className="text-xs text-gray-500 mt-2">Only trusted domains allowed; sanitized server-side.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Preview</h2>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50" disabled={saving}>
            {saving ? "Saving..." : "Save & Go Live"}
          </button>
        </div>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
        {updatedAt && <p className="text-xs text-gray-500">Last updated: {new Date(updatedAt).toLocaleString()}</p>}
        <div className="mt-4 aspect-video border rounded-lg overflow-hidden">
          <div className="[&_iframe]:w-full [&_iframe]:h-full h-full" dangerouslySetInnerHTML={preview} />
        </div>
      </div>
    </div>
  );
}
