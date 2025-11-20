import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;

export interface AnchorSource {
  title: string;
  content?: string;
  category?: string;
  language?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  source: AnchorSource | null;
}

// Simple Web Speech API wrapper with queue-safety
function useSpeech() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!synth) return;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener('voiceschanged', load);
    return () => synth.removeEventListener('voiceschanged', load);
  }, [synth]);

  const speak = useCallback((text: string, voice?: SpeechSynthesisVoice, rate = 1.0) => {
    if (!synth) return;
    // Stop any current speech
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onstart = () => { setSpeaking(true); setPaused(false); };
    u.onend = () => { setSpeaking(false); setPaused(false); utterRef.current = null; };
    u.onerror = () => { setSpeaking(false); setPaused(false); utterRef.current = null; };
    utterRef.current = u;
    synth.speak(u);
  }, [synth]);

  const pause = useCallback(() => { if (synth && synth.speaking && !synth.paused) { synth.pause(); setPaused(true); } }, [synth]);
  const resume = useCallback(() => { if (synth && synth.paused) { synth.resume(); setPaused(false); } }, [synth]);
  const stop = useCallback(() => { if (synth) { synth.cancel(); setSpeaking(false); setPaused(false); } }, [synth]);

  return { voices, speaking, paused, speak, pause, resume, stop };
}

export const AiAnchorPlayer: React.FC<Props> = ({ open, onClose, source }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState<number>(1.0);
  const { voices, speaking, paused, speak, pause, resume, stop } = useSpeech();

  const voiceObj = useMemo(() => voices.find(v => v.name === selectedVoice), [voices, selectedVoice]);

  useEffect(() => {
    if (!open) { stop(); return; }
    setError(null);
    if (!source) return;
    // Auto-fetch a voice script when opened
    const run = async () => {
      try {
        setLoading(true);
        const payload = {
          title: source.title,
          content: source.content || '',
          category: source.category || '',
          language: source.language || 'en',
        };
        const r = await fetch(`${API_BASE}/ai/tools/voice-script`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const s = (data && (data.script || data.content || data.result)) || '';
        setScript(s || `Here is a brief update on: ${source.title}.`);
      } catch (e: any) {
        setError(e?.message || 'Failed to generate voice script');
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source?.title]);

  const onPlay = () => { if (script) speak(script, voiceObj ?? undefined, rate); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 w-full max-w-xl p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">AI Anchor — Voice Reader</h3>
          <button className="px-3 py-1 bg-gray-600 text-white rounded" onClick={() => { stop(); onClose(); }}>Close</button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-gray-600">Voice</span>
            <select className="mt-1 w-full border rounded px-2 py-1" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
              <option value="">System default</option>
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name} {v.lang ? `(${v.lang})` : ''}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Speed: {rate.toFixed(1)}x</span>
            <input type="range" min={0.6} max={1.4} step={0.1} value={rate} onChange={e => setRate(parseFloat(e.target.value))} className="w-full" />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Script</span>
            <textarea className="mt-1 w-full border rounded px-2 py-1 min-h-[120px]" value={script} onChange={e => setScript(e.target.value)} />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-gray-500">Generating script…</p>}

          <div className="flex gap-2">
            <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={onPlay} disabled={!script}>Play</button>
            {!paused && speaking && (
              <button className="bg-yellow-600 text-white px-3 py-1 rounded" onClick={pause}>Pause</button>
            )}
            {paused && (
              <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={resume}>Resume</button>
            )}
            <button className="bg-gray-700 text-white px-3 py-1 rounded" onClick={stop}>Stop</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiAnchorPlayer;
