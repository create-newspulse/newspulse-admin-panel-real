import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createArticle, updateArticle, getArticle, type Article } from '@/lib/api/articles';
import toast from 'react-hot-toast';
import { verifyLanguage, readability } from '@/lib/api/language';
import { ptiCheck } from '@/lib/api/compliance';
import TagInput from '@/components/ui/TagInput';
import { uniqueSlug } from '@/lib/slug';
import { readingTimeSec } from '@/lib/readtime';
import { ARTICLE_CATEGORIES, isValidCategory, canonicalizeCategory } from '@/lib/categories';
import AiAssistantTipBox from '@/components/news/AiAssistantTipBox';
import { assistSuggestV2, type AssistSuggestV2Response } from '@/lib/api/assist';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { normalizeError } from '@/lib/error';

interface ArticleFormProps {
  mode: 'create' | 'edit';
  id?: string | null; // edit id (preferred)
  articleId?: string; // legacy prop alias
  initialValues?: Partial<Article>; // pre-fetched data (edit)
  onSubmit?: (payload: Record<string, any>) => Promise<any>; // override create/update
  onDone?: () => void;
  userRole?: 'writer'|'editor'|'admin'|'founder';
}

export const ArticleForm: React.FC<ArticleFormProps> = ({
  id,
  articleId,
  mode,
  initialValues,
  onSubmit,
  onDone = ()=>{},
  userRole='writer'
}) => {
  // resolve edit id
  const editId = id || articleId || null;
  const computedMode: 'create'|'edit' = mode || (editId ? 'edit' : 'create');
  const qc = useQueryClient();
  // Skip internal fetch if caller provided initialValues
  const { data } = useQuery({
    queryKey: ['articles','one',editId],
    queryFn: ()=> editId ? getArticle(editId) : Promise.resolve(null),
    enabled: !!editId && !initialValues,
  });
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [summary, setSummary] = useState('');
  const [autoSummary, setAutoSummary] = useState(true);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>(ARTICLE_CATEGORIES[0]);
  const [language, setLanguage] = useState<'en'|'hi'|'gu'>('en');
  const [status, setStatus] = useState<'draft'|'scheduled'|'published'>('draft');
  // Keep original status to ensure Save Draft never downgrades/changes live states
  const originalStatusRef = useRef<'draft'|'scheduled'|'published'|'unknown'>('unknown');
  const [tags, setTags] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [ptiStatus, setPtiStatus] = useState<'pending'|'compliant'|'needs_review'>('pending');
  const [ptiReasons, setPtiReasons] = useState<string[]>([]);
  const [langIssues, setLangIssues] = useState<Record<string, any[]>>({});
  const [readabilityGrade, setReadabilityGrade] = useState<number|undefined>();
  const [readingSeconds, setReadingSeconds] = useState<number|undefined>();
  const [founderOverride, setFounderOverride] = useState(false);
  const autoSaveRef = useRef<number | null>(null);
  const [suggestions, setSuggestions] = useState<AssistSuggestV2Response | null>(null);
  const [useLatinSlug, setUseLatinSlug] = useState(true);
  const [tone, setTone] = useState<'neutral'|'impact'|'analytical'>('neutral');
  const [checks, setChecks] = useState<{ seo: any; compliance: any; duplicate: any }>({ seo: null, compliance: null, duplicate: null });
  const suggestCacheRef = useRef<Map<string, AssistSuggestV2Response>>(new Map());
  const { publishEnabled } = usePublishFlag();

  // populate from initialValues first (edit mode)
  useEffect(()=> {
    const src = (computedMode === 'edit') ? (initialValues || data) : null;
    if (src) {
      setTitle(src.title || '');
      setSlug(src.slug || '');
      setSummary((src as any).summary || '');
      setContent((src as any).content ?? (src as any).body ?? '');
      const incomingCat = typeof (src as any).category === 'string' ? (src as any).category as string : undefined;
      const canon = incomingCat ? (isValidCategory(incomingCat) ? incomingCat : canonicalizeCategory(incomingCat)) : ARTICLE_CATEGORIES[0];
      setCategory(canon);
      setLanguage(((src as any).language as any) || 'en');
      const incomingStatus = (((src as any).status as any) || 'draft') as 'draft'|'scheduled'|'published';
      setStatus(incomingStatus);
      originalStatusRef.current = incomingStatus;
      setTags(Array.isArray((src as any).tags) ? (src as any).tags : []);
      setScheduledAt((src as any).scheduledAt ? new Date((src as any).scheduledAt).toISOString().slice(0,16) : '');
    }
  }, [initialValues, data, computedMode]);

  const existingSlugs = useMemo(()=> new Set<string>([]), []);
  useEffect(()=> { if (autoSlug) { uniqueSlug(title, existingSlugs).then(setSlug); } }, [title, autoSlug, existingSlugs]);
  useEffect(()=> { setReadingSeconds(readingTimeSec(content)); }, [content]);

  function generateSummary(titleText: string, contentText: string): string {
    const t = (titleText || '').trim();
    const c = (contentText || '').trim();
    // If there's no content yet, synthesize a 2–3 line summary from the title in chosen language
    if (!c && t) {
      const base = t.replace(/\s+/g, ' ');
      if (language === 'gu') {
        // Gujarati localized template
        const s1 = `આ લેખ ${base} વિષયને આવરી લે છે.`;
        const s2 = `તેમાં મુખ્ય તથ્યો, પરિસ્થિતિ અને આગળ શું ધ્યાનમાં રાખવું તે જણાવે છે.`;
        const s3 = `આનો અર્થ અને મહત્વ સમજવા માટે આગળ વાંચો.`;
        const combinedGu = `${s1} ${s2} ${s3}`;
        return combinedGu.length > 300 ? combinedGu.slice(0, 297) + '…' : combinedGu;
      } else if (language === 'hi') {
        // Hindi template (simple neutral tone)
        const s1 = `यह लेख ${base} विषय को कवर करता है.`;
        const s2 = `इसमें मुख्य तथ्य, संदर्भ और आगे क्या देखना है बताया गया है.`;
        const s3 = `इसके अर्थ और महत्व को समझने के लिए आगे पढ़ें.`;
        const combinedHi = `${s1} ${s2} ${s3}`;
        return combinedHi.length > 300 ? combinedHi.slice(0, 297) + '…' : combinedHi;
      } else {
        const s1 = `This story covers ${base}.`;
        const s2 = `It outlines key facts, context, and what to look for next.`;
        const s3 = `Read on to understand what it means and why it matters.`;
        const combined = `${s1} ${s2} ${s3}`;
        return combined.length > 300 ? combined.slice(0, 297) + '…' : combined;
      }
    }
    const tLow = t.toLowerCase();
    const sentences = (c || t).replace(/\n+/g,' ').split(/(?<=[.?!])\s+/).filter(Boolean);
    const filtered = sentences.filter(s => s.toLowerCase().trim() !== tLow);
    const take = filtered.slice(0,2).join(' ');
    const words = take.split(/\s+/).filter(Boolean);
    const targetCount = Math.min(Math.max(25, words.length), 45);
    const summary = words.slice(0,targetCount).join(' ');
    return summary.length > 300 ? summary.slice(0,297) + '…' : summary;
  }

  useEffect(()=> {
    if (autoSummary) setSummary(generateSummary(title, content));
  }, [title, content, autoSummary]);

  // Debounced v2 suggestions based on title/content/language
  useEffect(()=>{
    if (!title.trim()) return;
    const key = JSON.stringify({ t: title.slice(0, 160), l: language });
    const timer = window.setTimeout(async ()=>{
      const cached = suggestCacheRef.current.get(key);
      if (cached) {
        setSuggestions(cached);
        setChecks({ seo: cached.seo, compliance: cached.compliance, duplicate: cached.duplicate });
        if (autoSlug && !slug) setSlug(useLatinSlug ? cached.slug.latin : cached.slug.native);
        if (autoSummary && !summary.trim()) setSummary(cached.summary.neutral);
        return;
      }
      try {
        const res = await assistSuggestV2({ title, content: content.slice(0,4000), language });
        suggestCacheRef.current.set(key, res);
        setSuggestions(res);
        setChecks({ seo: res.seo, compliance: res.compliance, duplicate: res.duplicate });
        if (autoSlug && !slug) setSlug(useLatinSlug ? res.slug.latin : res.slug.native);
        if (autoSummary && !summary.trim()) setSummary(res.summary.neutral);
      } catch {}
    }, 500);
    return ()=> window.clearTimeout(timer);
  }, [title, content, language, autoSlug, autoSummary, useLatinSlug, slug, summary]);

  function addAttribution(){
    setSummary(s => (/\b(as per|according to|officials|police|sources|report|pti|agency)\b/i.test(s) ? s : s.replace(/\.*$/, '') + '. As per officials, details are being verified.'));
  }
  function trimSummaryTo160(){ setSummary(s => (s.length <= 160 ? s : s.slice(0,160).replace(/\s+\S*$/, '') + '…')); }

  const publishBlocked = !founderOverride && ((checks.compliance?.ptiFlags?.length ?? 0) > 0 || (checks.duplicate?.score ?? 0) >= 0.78);

  const mutation = useMutation({
    // desiredStatusOverride lets callers force a specific status (e.g., Publish)
    mutationFn: async (desiredStatusOverride?: 'draft'|'scheduled'|'published') => {
      // Compute safe status to send:
      // - New/draft items => draft
      // - Live items (published/scheduled) => keep original live state
      // - If override provided (e.g., publish), use it explicitly
      let statusToSend: 'draft'|'scheduled'|'published';
      if (desiredStatusOverride) {
        statusToSend = desiredStatusOverride;
      } else if (computedMode === 'create') {
        statusToSend = 'draft';
      } else {
        const orig = originalStatusRef.current === 'unknown' ? (status || 'draft') : originalStatusRef.current;
        statusToSend = (orig === 'published' || orig === 'scheduled') ? orig : 'draft';
      }

      const body = { title, slug, summary, content, category, tags, status: statusToSend, language, scheduledAt: scheduledAt || undefined, ptiCompliance: ptiStatus === 'needs_review' ? 'pending' : ptiStatus };
      if (!title.trim()) throw new Error('Title required');
      if (onSubmit) return onSubmit(body);
      if (computedMode === 'create') return createArticle(body as any);
      return updateArticle(editId!, body as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success(computedMode === 'edit' ? 'Article updated successfully' : 'Article created successfully');
      onDone();
    },
    onError: (err: any) => {
      const n = normalizeError(err, 'Save failed');
      console.error('[ArticleForm] mutation error', n.status, n.raw?.response?.data || n.message);
      toast.error(n.message);
    }
  });

  function saveDraft(){
    if (!mutation.isPending) {
      // No override here. This ensures drafts stay drafts; live stays live.
      mutation.mutate();
    }
  }
  function handlePublish(){
    if (!publishEnabled) {
      console.warn('Publish is disabled in this environment');
      toast.error('Publishing temporarily disabled');
      return;
    }
    if (!mutation.isPending) {
      // Publish is the only place that sets status: 'published'.
      mutation.mutate('published');
    }
  }
  useEffect(()=> {
    if (autoSaveRef.current !== null) clearInterval(autoSaveRef.current);
    autoSaveRef.current = window.setInterval(()=> { if (title.trim()) saveDraft(); }, 30000);
    return ()=> { if (autoSaveRef.current !== null) clearInterval(autoSaveRef.current); };
  }, [title, slug, summary, content, category, language, status, tags, scheduledAt, ptiStatus]);

  async function runLanguageCheck(l: 'en'|'hi'|'gu') { try { const res = await verifyLanguage(content || title, l); setLangIssues(prev => ({ ...prev, [l]: res.issues })); } catch {} }
  async function runPti(){ try { const res = await ptiCheck({ title, content }); setPtiStatus(res.status === 'compliant' ? 'compliant' : 'needs_review'); setPtiReasons(res.reasons); } catch {} }
  async function runReadability(){ try { const res = await readability(content || title, language); setReadabilityGrade(res.grade); setReadingSeconds(res.readingTimeSec); } catch {} }

  const canPublish = (userRole === 'admin' || userRole === 'founder') && (ptiStatus === 'compliant' || founderOverride) && ['en','hi','gu'].every(l => (langIssues[l]||[]).length === 0 || founderOverride);

  return (
    <form onSubmit={e=> { e.preventDefault(); handlePublish(); }} className="space-y-6">
      <div className="card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input value={title} onChange={e=> setTitle(e.target.value)} className="w-full border px-2 py-2 rounded" required />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Slug</label>
            <label className="text-xs flex items-center gap-1 select-none">
              <input type="checkbox" checked={autoSlug} onChange={e=> setAutoSlug(e.target.checked)} /> Auto
            </label>
          </div>
          <input value={slug} onChange={e=> { setSlug(e.target.value); }} className="w-full border px-2 py-2 rounded" />
          {suggestions && (
            <label className="mt-2 inline-flex items-center gap-2 text-[11px]">
              <input type="checkbox" checked={useLatinSlug} onChange={e=> { setUseLatinSlug(e.target.checked); if (autoSlug && suggestions) setSlug(e.target.checked ? suggestions.slug.latin : suggestions.slug.native); }} />
              Use Latin SEO slug
            </label>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Summary</label>
            <label className="text-xs flex items-center gap-1 select-none">
              <input type="checkbox" checked={autoSummary} onChange={e=> setAutoSummary(e.target.checked)} /> Auto
            </label>
          </div>
          <textarea value={summary} onChange={e=> setSummary(e.target.value)} rows={3} className="w-full border px-2 py-2 rounded" />
          {suggestions && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {(['neutral','impact','analytical'] as const).map(t => (
                <button type="button" key={t} onClick={()=> { setTone(t); setSummary(suggestions.summary[t]); setAutoSummary(false); }}
                  className={`px-2 py-1 rounded text-xs border ${tone===t? 'bg-black text-white':'bg-white'}`}>{t}</button>
              ))}
              <span className={`text-[11px] ${summary.length>=120 && summary.length<=180 ? 'text-green-600' : 'text-amber-600'}`}>{summary.length} chars (aim 120–180)</span>
            </div>
          )}
          {checks.compliance?.ptiFlags?.length > 0 && (
            <div className="mt-2 text-xs text-red-600">PTI flags: {checks.compliance.ptiFlags.join(' · ')} <button type="button" className="underline" onClick={addAttribution}>Add attribution</button></div>
          )}
          {checks.duplicate && checks.duplicate.score >= 0.78 && (
            <div className="mt-1 text-xs text-amber-700">Similar headline ({Math.round(checks.duplicate.score*100)}%). {checks.duplicate.closestId && <a className="underline" href={`/admin/articles/${checks.duplicate.closestId}`} target="_blank">View closest</a>}</div>
          )}
          {checks.seo && (
            <div className="mt-1 text-[11px] text-gray-600">Hook score: {checks.seo.titleHookScore} · Keywords: {checks.seo.keywords.join(', ')}</div>
          )}
          <div className="mt-2 flex gap-2 flex-wrap">
            {summary.length > 200 && <button type="button" onClick={trimSummaryTo160} className="btn-secondary text-[11px] px-2 py-1">Trim to ~160</button>}
            {(checks.compliance?.ptiFlags?.length ?? 0) > 0 && <button type="button" onClick={addAttribution} className="btn-secondary text-[11px] px-2 py-1">Add attribution</button>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Content</label>
          <textarea value={content} onChange={e=> setContent(e.target.value)} rows={10} className="w-full border px-2 py-2 rounded font-mono" placeholder="Write article content..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Category</label>
            <select value={category} onChange={e=> setCategory(e.target.value)} className="w-full border px-2 py-2 rounded">
              {ARTICLE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Language</label>
            <select value={language} onChange={e=> setLanguage(e.target.value as any)} className="w-full border px-2 py-2 rounded">
              <option value='en'>English</option>
              <option value='hi'>Hindi</option>
              <option value='gu'>Gujarati</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Status</label>
            <select value={status} onChange={e=> setStatus(e.target.value as any)} disabled={userRole==='writer'} className="w-full border px-2 py-2 rounded">
              <option value='draft'>Draft</option>
              <option value='scheduled'>Scheduled</option>
              {(userRole==='admin'||userRole==='founder') && <option value='published'>Published</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Schedule (UTC)</label>
            <input type="datetime-local" value={scheduledAt} onChange={e=> setScheduledAt(e.target.value)} className="w-full border px-2 py-2 rounded" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tags</label>
          <TagInput value={tags} onChange={setTags} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-4 md:col-span-2">
          <div className="card p-4">
            <h3 className="font-semibold mb-2">Language Guard</h3>
            <div className="flex gap-2 mb-3">
              {['en','hi','gu'].map(l => (
                <button type="button" key={l} onClick={()=>runLanguageCheck(l as any)} className="btn-secondary text-xs">Check {l.toUpperCase()}</button>
              ))}
            </div>
            <div className="space-y-2">
              {['en','hi','gu'].map(l => (
                <div key={l} className="text-xs">
                  <strong>{l.toUpperCase()}:</strong> {(langIssues[l]||[]).length === 0 ? 'No issues ✅' : `${(langIssues[l]||[]).length} issues`}
                  {(langIssues[l]||[]).map((iss,i)=>(<div key={i} className="text-red-600">• {iss.message}</div>))}
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold mb-2">PTI Compliance</h3>
            <button type="button" onClick={runPti} className="btn-secondary mb-2">Run PTI Check</button>
            <div className="text-sm">Status: {ptiStatus === 'compliant' ? '✅ Compliant' : '⚠️ Needs Review'}</div>
            {ptiReasons.map(r=> <div key={r} className="text-xs text-red-600">• {r}</div>)}
          </div>
        </div>
        <div className="space-y-4">
          <AiAssistantTipBox
            title={title}
            content={content}
            language={language}
            onApplyTitle={(v)=> { setTitle(v); /* autoSlug will regenerate slug if still on */ }}
            onApplySlug={(v)=> { setSlug(v); setAutoSlug(false); }}
            onApplySummary={(v)=> { setSummary(v); setAutoSummary(false); }}
          />
          <div className="card p-4">
            <h3 className="font-semibold mb-2">SEO</h3>
            <div className="text-xs">Title Tag Preview: {title || 'Untitled'} | News Pulse</div>
            <div className="text-xs">Meta Description: {(summary||'').slice(0,140)}</div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold mb-2">Readability</h3>
            <button type="button" onClick={runReadability} className="btn-secondary mb-2">Analyze</button>
            <div className="text-xs">Grade: {readabilityGrade ?? '—'}</div>
            <div className="text-xs">Reading Time: {readingSeconds ? `${readingSeconds}s` : '—'}</div>
          </div>
          {(userRole==='founder') && (
            <div className="card p-4">
              <h3 className="font-semibold mb-2">Founder Override</h3>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={founderOverride} onChange={e=> setFounderOverride(e.target.checked)} /> Enable Force Publish
              </label>
              {founderOverride && <div className="text-xs text-red-600 mt-1">Publishing will ignore PTI & language issues.</div>}
            </div>
          )}
        </div>
      </div>

      {/* Optional helpful banner on missing backend route */}
      {mutation.isError && (mutation.error as any)?.response?.status === 404 && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
          Backend route missing (articles). Check backend deployment.
        </div>
      )}

      <div className="sticky bottom-0 bg-white border-t border-slate-200 py-3 flex gap-3 justify-end">
        <button type="button" onClick={saveDraft} className="btn-secondary" disabled={!title}>Save Draft</button>
        <button type="submit" className="btn" disabled={!publishEnabled || !canPublish || publishBlocked || mutation.isPending} title={!publishEnabled ? 'Publishing temporarily disabled' : undefined}>{mutation.isPending ? 'Saving…' : (publishBlocked ? 'Resolve Issues' : (publishEnabled ? 'Publish' : 'Publish (disabled)'))}</button>
        {mutation.isError && (
          <div className="text-xs text-red-600 flex items-center">{(mutation.error as any)?.response?.data?.message || (mutation.error as any)?.message || 'Save failed'}</div>
        )}
      </div>
    </form>
  );
};
