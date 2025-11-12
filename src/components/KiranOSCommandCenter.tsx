import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FaMicrophone, FaMicrophoneSlash, FaTimes, FaGripLines, FaPaperPlane, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import apiClient from '@lib/api';
import { sanitizeHtml } from '@lib/sanitize';
import { saveSession, loadSession } from '@lib/idb';

export interface KiranOSCommandCenterProps {
  defaultOpen?: boolean;
  adminMode?: boolean; // founder-only full controls
  hideLauncher?: boolean; // if true, do not render the floating open button
}

type ChatMsg = { role: 'user' | 'assistant' | 'system'; content: string; ts: number };

function detectLang(text: string): 'en' | 'hi' | 'gu' {
  // Simple heuristic by Unicode ranges
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return 'en';
}

export default function KiranOSCommandCenter({ defaultOpen=false, adminMode=false, hideLauncher=false }: KiranOSCommandCenterProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [dragPos, setDragPos] = useState({ x: 40, y: 80 });
  const [size, setSize] = useState({ w: 420, h: 520 });
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  // speaking state removed (single mute control retained)
  const muteKey = 'kiranos:voice-muted';
  const [voiceMuted, setVoiceMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(muteKey) === '1'; } catch { return false; }
  });
  const sessionKey = 'kiranos:last';

  // Load persisted history (last 5 Q&A) on mount
  useEffect(() => {
    (async () => {
      const saved = await loadSession(sessionKey);
      if (saved && Array.isArray(saved.messages)) {
        setMessages(saved.messages.slice(-10));
      }
    })();
  }, []);

  // Listen for global trigger from legacy "Ask KiranOS" button
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-kiranos-hub', handler);
    return () => window.removeEventListener('open-kiranos-hub', handler);
  }, []);

  useEffect(() => {
    // Persist last 10 messages
    saveSession(sessionKey, { messages: messages.slice(-10) }).catch(() => {});
  }, [messages]);

  // Persist mute preference
  useEffect(() => {
    try { localStorage.setItem(muteKey, voiceMuted ? '1' : '0'); } catch {}
  }, [voiceMuted]);

  const startSTT = () => {
    const SpeechCtor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechCtor) return alert('Speech recognition not supported in this browser.');
    const recog = new SpeechCtor();
    recog.lang = 'en-IN';
    recog.continuous = false;
    recog.interimResults = false;
    recog.onstart = () => setListening(true);
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recog.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript || '';
      if (t) setInput(prev => (prev ? prev + ' ' : '') + t);
    };
    recog.start();
  };

  const speakText = (text: string, lang: 'en'|'hi'|'gu') => {
    if (voiceMuted) return; // respect mute
    // Fallback to browser speech synthesis
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'gu' ? 'gu-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
    u.rate = 1.0; u.pitch = 1.0;
  // no speaking state needed – mute toggle is the only voice control
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const lang = detectLang(q);
    const userMsg: ChatMsg = { role: 'user', content: q, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    try {
      // Fast path: lightweight chat-core (skips external data fetch)
      const attempt = async (timeoutMs: number) => apiClient.post('/ai/chat-core', {
        messages: [{ role: 'user', content: q }],
        max_tokens: 180,
        temperature: 0.45,
      }, { timeout: timeoutMs });

      let core;
      try {
        core = await attempt(6000);
      } catch (e1: any) {
        const status = e1?.response?.status;
        const msg = e1?.message?.toLowerCase?.() || '';
        const retryable = status === 429 || status === 503 || msg.includes('timeout') || msg.includes('network');
        if (retryable) {
          await new Promise(r => setTimeout(r, 300));
          core = await attempt(7000);
        } else {
          throw e1;
        }
      }

      const answer = (core.data?.content || core.data?.result || '—').toString();
      const assistant: ChatMsg = { role: 'assistant', content: answer, ts: Date.now() };
      setMessages(prev => [...prev, assistant]);
      speakText(answer, lang);
    } catch (err: any) {
  const status = err?.response?.status;
  const msg = err?.message?.toLowerCase?.() || '';
  // Treat 500 from chat-core as eligible for fallback too (e.g., upstream quota or transient errors)
  const shouldFallback = status === 404 || status === 500 || status === 501 || status === 503 || msg.includes('timeout') || msg.includes('network error');
      if (shouldFallback) {
        // Fallback to full pipeline (adds internal/external context)
        try {
          const full = await apiClient.post('/kiranos/ask', { query: q, userId: 'founder', lang, adminMode }, { headers: { 'X-Admin-Mode': adminMode ? '1' : '0' }, timeout: 10000 });
          const answer = (full.data?.answer || '—').toString();
          const assistant: ChatMsg = { role: 'assistant', content: answer, ts: Date.now() };
          setMessages(prev => [...prev, assistant]);
          speakText(answer, lang);
        } catch (err2: any) {
          try {
            // Final fallback to legacy route
            const legacy = await apiClient.post('/system/ask-kiranos', { prompt: q }, { timeout: 10000 });
            const answer = (legacy.data?.answer || legacy.data?.reply || '—').toString();
            const assistant: ChatMsg = { role: 'assistant', content: answer, ts: Date.now() };
            setMessages(prev => [...prev, assistant]);
            speakText(answer, lang);
          } catch (err3: any) {
            const msg3 = err3?.response?.data?.error || err3.message || 'Request failed';
            setMessages(prev => [...prev, { role: 'system', content: `⚠️ ${msg3}. If you are running locally, make sure the backend is running at http://localhost:5000 (try: set DB_DEGRADED=1 and run npm run dev in admin-backend).`, ts: Date.now() }]);
          }
        }
      } else {
        const msg = err?.response?.data?.error || err.message || 'Request failed';
        const show = /busy|rate|limit|over/i.test(msg) ? '⏳ KiranOS is busy right now. Retrying in a few seconds…' : `⚠️ ${msg}`;
        setMessages(prev => [...prev, { role: 'system', content: show, ts: Date.now() }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const contentHtml = useMemo(() => (text: string) => {
    // Hardened sanitize wrapper (DOMPurify with strict allowlist or safe fallback)
    const clean = sanitizeHtml(String(text || ''));
    return { __html: clean };
  }, []);

  if (!open) {
    if (hideLauncher) return null;
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-purple-600 text-white px-4 py-3 shadow-lg hover:bg-purple-700"
        title="Open KiranOS Command Hub"
      >
        KiranOS
      </button>
    );
  }

  return (
    <motion.div
      className="fixed z-50 bg-white dark:bg-slate-900 border border-purple-500 rounded-lg shadow-2xl"
      style={{ left: dragPos.x, top: dragPos.y, width: size.w, height: size.h }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {/* Header / Drag handle */}
      <div className="cursor-move flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg"
        onMouseDown={(e) => {
          const startX = e.clientX - dragPos.x; const startY = e.clientY - dragPos.y;
          const onMove = (ev: MouseEvent) => setDragPos({ x: Math.max(8, ev.clientX - startX), y: Math.max(8, ev.clientY - startY) });
          const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        }}
      >
        <div className="flex items-center gap-2">
          <FaGripLines />
          <span className="font-semibold">KiranOS Command Hub</span>
          {adminMode ? <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">Founder</span> : <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">Safe</span>}
        </div>
        <button className="hover:bg-white/20 rounded p-1" onClick={() => setOpen(false)} title="Close"><FaTimes /></button>
      </div>

      {/* Body */}
      <div className="flex flex-col h-[calc(100%-88px)]">
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-slate-600 dark:text-slate-300">Ask anything like “Fetch today’s top business headlines” or “Summarize trending topics in Gujarati”.</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div className={`inline-block max-w-[85%] px-3 py-2 rounded-md text-sm ${m.role==='user' ? 'bg-purple-600 text-white' : m.role==='assistant' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100'}`}
                   dangerouslySetInnerHTML={contentHtml(m.content)} />
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <button onClick={() => (listening ? setListening(false) : startSTT())} className={`p-2 rounded ${listening ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'}`} title={listening ? 'Stop mic' : 'Start mic'}>
            {listening ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
          <input
            className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-black dark:text-white"
            placeholder="Type a command..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <button disabled={busy} onClick={send} className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"><FaPaperPlane /></button>
          <button
            onClick={() => {
              setVoiceMuted((prev) => {
                const next = !prev;
                if (next) {
                  try { window.speechSynthesis.cancel(); } catch {}
                }
                return next;
              });
            }}
            className={`px-3 py-2 rounded ${voiceMuted ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-800'}`}
            title={voiceMuted ? 'Voice muted (click to unmute)' : 'Mute voice replies'}
          >
            {voiceMuted ? <FaVolumeMute /> : <FaVolumeUp />}
          </button>
          {/* Replay button removed per request — keep only the mute/unmute control */}
        </div>
      </div>
      {/* Resize handle */}
      <div className="absolute right-0 bottom-0 w-3 h-3 cursor-se-resize" onMouseDown={(e) => {
        const startX = e.clientX; const startY = e.clientY; const startW = size.w; const startH = size.h;
        const onMove = (ev: MouseEvent) => setSize({ w: Math.max(360, startW + (ev.clientX - startX)), h: Math.max(420, startH + (ev.clientY - startY)) });
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      }} />
    </motion.div>
  );
}
