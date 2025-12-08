"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const rid = params.get("rid") || "";
  const token = params.get("token") || "";
  const hasParams = useMemo(() => !!rid && !!token, [rid, token]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<"info"|"error"|"success">("info");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasParams) {
      setVariant("error");
      setMessage("This reset link is missing required parameters. Please request a new password reset.");
    }
  }, [hasParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasParams) return;
    if (password.length < 8) {
      setVariant("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setVariant("error");
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rid, token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setVariant("success");
      setMessage("Password reset successful. Redirecting to sign-in…");
      setTimeout(() => router.push("/auth"), 1200);
    } catch (e: any) {
      setVariant("error");
      setMessage(e.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold mb-4">Reset your password</h1>
        {!hasParams ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
            {message}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium">New password</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
              <p className="text-xs text-slate-500 mt-1">Use at least 8 characters. Add numbers and symbols for better security.</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Confirm new password</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            {message && (
              <div
                className={
                  "text-sm rounded p-2 border " +
                  (variant === "success"
                    ? "text-green-700 bg-green-50 border-green-200"
                    : variant === "error"
                    ? "text-amber-700 bg-amber-50 border-amber-200"
                    : "text-slate-700 bg-slate-50 border-slate-200")
                }
              >
                {message}
              </div>
            )}
            <button
              disabled={busy}
              className={`w-full py-2 rounded text-white ${busy ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {busy ? "Resetting…" : "Reset Password"}
            </button>
            <button
              type="button"
              className="w-full py-2 rounded border mt-1"
              onClick={() => router.push("/auth")}
            >
              Back to sign-in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
