import React, { useMemo, useRef, useState } from "react";
import { streamChat, runCommand } from "@lib/kiranosClient";

type Msg = { role: "user" | "assistant"; content: string };

const API_BASE = import.meta.env.VITE_KIRANOS_API_BASE as string; // e.g. http://localhost:5050
const FOUNDER_KEY = import.meta.env.VITE_FOUNDER_API_KEY as string; // keep server-side via proxy in prod

export default function KiranOSChat() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! 👋 I’m KiranOS v5. How can I help you in the admin panel?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);

  const history = useMemo(() => messages.map((m) => ({ role: m.role, content: m.content })), [messages]);

  async function send() {
    if (!input.trim() || busy) return;
    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const stream = await streamChat({ apiBase: API_BASE, founderKey: FOUNDER_KEY, message: userText, history });

      for await (const evt of stream.tokens()) {
        if (evt.type === "token") {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            last.content += evt.delta;
            return copy;
          });
          viewRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
        } else if (evt.type === "error") {
          setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${evt.message}` }]);
        }
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${e.message || "Failed to reach KiranOS."}` }]);
    } finally {
      setBusy(false);
    }
  }

  // minimal “tool call” extractor (if model suggests a tool in JSON)
  async function tryRunSuggestedTool(text: string) {
    try {
      const m = text.match(/\{\"tool\".*\}/);
      if (!m) return;
      const { tool, args } = JSON.parse(m[0]);
      const result = await runCommand({ apiBase: API_BASE, founderKey: FOUNDER_KEY, tool, args });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `🛠️ ${tool}: ${result.ok ? "done ✅" : "failed ❌"}\n\n${JSON.stringify(result, null, 2)}`,
        },
      ]);
    } catch {
      /* ignore */
    }
  }

  // auto-check last assistant message for tool-call JSON
  React.useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") tryRunSuggestedTool(last.content);
  }, [messages]);

  return (
    <div className="w-full max-w-3xl mx-auto rounded-xl border p-3 bg-white/70 shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">
          KiranOS Command Hub · <span className="text-green-600">GPT-5+</span>
        </div>
        <div className="text-xs">Status: {busy ? "Thinking…" : "Ready"}</div>
      </div>

      <div ref={viewRef} className="h-[420px] overflow-y-auto space-y-3 p-2 bg-gray-50 rounded">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded-md whitespace-pre-wrap text-sm ${
              m.role === "user" ? "bg-indigo-100 self-end" : "bg-white border"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 border rounded-md px-3 py-2"
          placeholder="Ask anything… or issue a command (e.g., Deploy frontend)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={busy}
        />
        <button
          onClick={send}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Tip: Try “Check health”, “Deploy frontend”, “Summarize today’s traffic”, “Write a 2-line headline for …”
      </p>
    </div>
  );
}
