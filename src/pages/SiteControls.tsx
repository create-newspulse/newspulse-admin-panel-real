import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type SiteSettings = {
  showCategoryStrip: boolean;
  showTrendingStrip: boolean;
  showExploreCategories: boolean;
  showLiveTvCard: boolean;
  showQuickTools: boolean;
  showSnapshots: boolean;
  showAppPromo: boolean;
  showFooter: boolean;

  liveTickerOn: boolean;
  breakingMode: "auto" | "on" | "off";
  showBreakingWhenEmpty: boolean;
  liveSpeedSec: number;
  breakingSpeedSec: number;

  catFlow: "ltr" | "rtl";

  liveTvOn: boolean;
  liveTvEmbedUrl: string;
};

const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 12, border: "1px solid #e5e7eb", borderRadius: 16 }}>
    <div style={{ fontWeight: 800 }}>{label}</div>
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: value ? "#2563eb" : "#f3f4f6",
        position: "relative",
        cursor: "pointer",
      }}
      aria-label={`Toggle ${label}`}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: value ? 26 : 4,
          width: 24,
          height: 24,
          borderRadius: 999,
          background: "#fff",
          transition: "left 180ms ease",
        }}
      />
    </button>
  </div>
);

export default function SiteControls() {
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem("token") || "" : ""), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}` as any;
      const res = await fetch(apiUrl('/api/site-settings/admin'), {
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Load failed");
      setSettings(data.settings);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMsg("");
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) (headers as any).Authorization = `Bearer ${token}`;
      const res = await fetch(apiUrl('/api/site-settings/admin'), {
        method: "PUT",
        headers,
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Save failed");
      setSettings(data.settings);
      setMsg("Saved ✅");
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 900 }}>Founder Site Controls</h2>
      <p style={{ opacity: 0.8 }}>Turn homepage modules ON/OFF (affects all users).</p>

      {msg ? <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "#f3f4f6" }}>{msg}</div> : null}

      {!settings ? (
        <button onClick={load} style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          Retry
        </button>
      ) : (
        <>
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <Toggle label="Category strip" value={settings.showCategoryStrip} onChange={(v) => setSettings({ ...settings, showCategoryStrip: v })} />
            <Toggle label="Trending strip" value={settings.showTrendingStrip} onChange={(v) => setSettings({ ...settings, showTrendingStrip: v })} />
            <Toggle label="Explore Categories" value={settings.showExploreCategories} onChange={(v) => setSettings({ ...settings, showExploreCategories: v })} />
            <Toggle label="Live TV card" value={settings.showLiveTvCard} onChange={(v) => setSettings({ ...settings, showLiveTvCard: v })} />
            <Toggle label="Quick tools" value={settings.showQuickTools} onChange={(v) => setSettings({ ...settings, showQuickTools: v })} />
            <Toggle label="Snapshots" value={settings.showSnapshots} onChange={(v) => setSettings({ ...settings, showSnapshots: v })} />
            <Toggle label="App promo section" value={settings.showAppPromo} onChange={(v) => setSettings({ ...settings, showAppPromo: v })} />
            <Toggle label="Footer" value={settings.showFooter} onChange={(v) => setSettings({ ...settings, showFooter: v })} />
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 800,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>

            <button onClick={load} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              Reload
            </button>
          </div>
        </>
      )}
    </div>
  );
}
