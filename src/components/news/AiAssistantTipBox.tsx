import React from 'react';

// --- small helpers ---
// Multilingual slugify: keep English letters, digits, Hindi (Devanagari) and Gujarati characters.
// For non-English languages we skip stop-word removal (simple heuristic) and just normalize.
const slugify = (s: string) => {
  if (!s) return '';
  const lower = s.toLowerCase().normalize('NFC');
  const isLatin = /[a-z]/.test(lower);
  const stop = new Set(['a','an','the','and','or','of','for','to','in','on','at','by','with','from']);
  // Allow ranges: Devanagari \u0900-\u097F, Gujarati \u0A80-\u0AFF
  const cleaned = lower
    .replace(/[\u2019'"`]/g,'')
    .replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]+/g,' ') // collapse separators to space
    .trim();
  let parts = cleaned.split(/\s+/).filter(Boolean);
  if (isLatin) {
    parts = parts.filter((w,i)=> i===0 || !stop.has(w));
  }
  const slug = parts.join('-')
    .replace(/-{2,}/g,'-')
    .replace(/(^-|-$)/g,'')
    .slice(0,120);
  return slug;
};

const trimTo = (s: string, n: number) =>
  s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…';

const naiveSummary = (text: string, title: string) => {
  // Prefer first sentences, avoid repeating the title, target ~25-40 words
  const t = (title || '').toLowerCase().replace(/\s+/g,' ').trim();
  const candidates = text.replace(/\n+/g, ' ').split(/(?<=[.?!])\s+/).filter(Boolean);
  const filtered = candidates.filter(s => s.trim() && s.toLowerCase() !== t);
  const take = filtered.slice(0, 2).join(' ');
  const words = take.split(/\s+/).filter(Boolean);
  const target = Math.min(Math.max(25, words.length), 45);
  return trimTo(words.slice(0, target).join(' '), 300);
};

// optional: call your backend AI endpoint if available
async function tryAiSuggest(payload: {
  title: string;
  content: string;
  language: 'en' | 'hi' | 'gu';
}) {
  try {
    // Use admin API base; aligns with backend /admin-api/assist/suggest
    const res = await fetch('/admin-api/assist/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('no ai');
    return await res.json(); // {title, slug, summary, tips: string[]}
  } catch {
    return null;
  }
}

type Props = {
  title: string;
  content: string;
  language?: 'en' | 'hi' | 'gu';
  onApplyTitle: (v: string) => void;
  onApplySlug: (v: string) => void;
  onApplySummary: (v: string) => void;
};

function normalizeLocalized(text: string, language: 'en'|'hi'|'gu'): string {
  if (language === 'gu') {
    return text.replace(/ઇસ્રોએ/g,'ઈસરોએ').replace(/ઇસ્રો/g,'ઈસરો');
  }
  return text;
}

export default function AiAssistantTipBox({
  title,
  content,
  language = 'en',
  onApplyTitle,
  onApplySlug,
  onApplySummary,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [suggest, setSuggest] = React.useState<{
    title: string; slug: string; summary: string; tips: string[];
  } | null>(null);

  const generate = async () => {
    setBusy(true);
    const ai = await tryAiSuggest({ title, content, language });
    if (ai) { setSuggest(ai); setBusy(false); return; }

    // Fallback local heuristics
    const baseTitle = title?.trim();
    let bestTitle = baseTitle || (content.split(/\n|\. /)[0] || '').trim();
    bestTitle = bestTitle.replace(/\s+/g, ' ');
    if (bestTitle) bestTitle = bestTitle.charAt(0).toUpperCase() + bestTitle.slice(1);
    bestTitle = trimTo(bestTitle, 70);

    const normalizedTitle = normalizeLocalized(bestTitle, language);
    const slug = slugify(normalizedTitle || title);
    const summary = normalizeLocalized(naiveSummary(content || title, normalizedTitle || title), language);

    const tips: string[] = [];
    if ((bestTitle || '').length > 70) tips.push('Title trimmed near 70 chars for SEO.');
    if (!title) tips.push('Generated headline from first sentence.');
    if ((summary || '').length < 40) tips.push('Try adding a 2-line intro for better CTR.');
    if (!/https?:\/\//.test(content)) tips.push('Consider adding a source link for trust.');
  setSuggest({ title: normalizedTitle, slug, summary, tips });
    setBusy(false);
  };

  return (
    <div className="rounded-xl border bg-white/70 dark:bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">🤖 AI Assistant Tip Box</div>
        <button
          onClick={generate}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-50"
          title="Generate suggestions"
        >
          {busy ? 'Thinking…' : 'Generate'}
        </button>
      </div>

      {!suggest && (
        <p className="text-sm text-slate-500">
          Get headline, slug, and summary suggestions based on your draft. Works offline;
          upgrades to AI when connected.
        </p>
      )}

      {suggest && (
        <div className="space-y-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">Suggested Title</div>
            <div className="rounded-lg border p-2 bg-white dark:bg-slate-900">{suggest.title || '—'}</div>
            <div className="mt-1">
              <button
                className="text-blue-600 underline text-sm"
                onClick={() => onApplyTitle(suggest.title)}
              >Apply Title</button>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Suggested Slug</div>
            <div className="rounded-lg border p-2 bg-white dark:bg-slate-900">{suggest.slug || '—'}</div>
            <div className="mt-1">
              <button
                className="text-blue-600 underline text-sm"
                onClick={() => onApplySlug(suggest.slug)}
              >Apply Slug</button>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">Suggested Summary</div>
            <div className="rounded-lg border p-2 bg-white dark:bg-slate-900 whitespace-pre-wrap">
              {suggest.summary || '—'}
            </div>
            <div className="mt-1">
              <button
                className="text-blue-600 underline text-sm"
                onClick={() => onApplySummary(suggest.summary)}
              >Apply Summary</button>
            </div>
          </div>

          {suggest.tips?.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-sm">
              <div className="font-medium mb-1">Tips</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {suggest.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
