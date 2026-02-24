import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createArticle, updateArticle, getArticle } from '../../lib/api/articles';
import { verifyLanguage, readability } from '../../lib/api/language';
import { ptiCheck } from '../../lib/api/compliance';
import { uploadCoverImage } from '../../lib/api/media';
import TagInput from '../ui/TagInput';
import AiAssistantTipBox from './AiAssistantTipBox';
import { uniqueSlug } from '../../lib/slug';
import { readingTimeSec } from '../../lib/readtime';

interface ArticleFormProps { mode: 'create'|'edit'; articleId?: string; userRole?: 'writer'|'editor'|'admin'|'founder'; }

export function ArticleForm({ mode, articleId, userRole='writer' }: ArticleFormProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [summary, setSummary] = useState('');
  const [autoSummary, setAutoSummary] = useState(true);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [coverImagePublicId, setCoverImagePublicId] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string>('');
  const [category, setCategory] = useState('General');
  const [language, setLanguage] = useState<'en'|'hi'|'gu'>('en');
  const [status, setStatus] = useState<'draft'|'scheduled'|'published'>('draft');
  const [tags, setTags] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [ptiStatus, setPtiStatus] = useState<'pending'|'compliant'|'needs_review'>('pending');
  const [ptiReasons, setPtiReasons] = useState<string[]>([]);
  const [langIssues, setLangIssues] = useState<Record<string, any[]>>({});
  const [readabilityGrade, setReadabilityGrade] = useState<number|undefined>();
  const [readingSeconds, setReadingSeconds] = useState<number|undefined>();
  const [founderOverride, setFounderOverride] = useState(false);
  const autoSaveRef = useRef<number | null>(null);

  const existingSlugs = useMemo(()=> new Set<string>([]), []); // could be populated if listing all

  // Load existing article when in edit mode
  useEffect(()=>{
    let ignore = false;
    async function load(){
      if (mode !== 'edit' || !articleId) return;
      try {
        const res = await getArticle(articleId);
        const art = (res?.data?.article) || res?.article || res;
        if (!art || ignore) return;
        setTitle(art.title || '');
        setSlug(art.slug || '');
        setSummary(art.summary || '');
        setContent(art.content || art.body || '');
        const coverUrl = (art.coverImage && typeof art.coverImage === 'object' ? art.coverImage.url : '') || art.coverImageUrl || art.imageUrl || '';
        setImageUrl(coverUrl || '');
        const pid = (art.coverImage && typeof art.coverImage === 'object' ? (art.coverImage.publicId || art.coverImage.public_id) : '') || '';
        setCoverImagePublicId(pid || '');
        setCategory(art.category || 'General');
        setLanguage((art.language || 'en') as any);
        setStatus((art.status || 'draft') as any);
        setTags(Array.isArray(art.tags) ? art.tags : []);
        setScheduledAt(art.scheduledAt || '');
        const pti = art.ptiCompliance || art.ptiStatus;
        if (pti) setPtiStatus(pti);
      } catch (err) {
        console.error('[ADMIN][EDIT_NEWS] Load error', err);
      }
    }
    load();
    return ()=>{ ignore = true; };
  }, [mode, articleId]);

  // Auto slug
  useEffect(()=> {
    if (autoSlug) {
      uniqueSlug(title, existingSlugs).then(setSlug);
    }
  }, [title, autoSlug, existingSlugs]);
  function generateSummary(titleText: string, contentText: string): string {
    const baseline = (contentText && contentText.trim()) ? contentText : titleText;
    if (!baseline) return '';
    const tLow = (titleText || '').toLowerCase().trim();
    const sentences = baseline.replace(/\n+/g,' ').split(/(?<=[.?!])\s+/).filter(Boolean);
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

  // Readability local fallback
  useEffect(()=> {
    const rt = readingTimeSec(content);
    setReadingSeconds(rt);
  }, [content]);

  // Auto-save every 30s
  useEffect(()=> {
    if (autoSaveRef.current !== null) {
      clearInterval(autoSaveRef.current);
    }
    autoSaveRef.current = window.setInterval(()=> {
      if (title.trim()) {
        saveDraft();
      }
    }, 30000);
    return ()=> {
      if (autoSaveRef.current !== null) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [title, slug, summary, content, category, language, status, tags, scheduledAt, ptiStatus]);

  const mutation = useMutation({
    mutationFn: async () => {
      const coverUrl = (imageUrl || '').trim();
      const coverPid = (coverImagePublicId || '').trim();
      const body: any = {
        title,
        slug,
        summary,
        content,
        category,
        tags,
        status,
        language,
        scheduledAt: scheduledAt || undefined,
        ptiCompliance: ptiStatus === 'needs_review' ? 'pending' : ptiStatus,
        imageUrl: coverUrl || undefined,
        coverImageUrl: coverUrl || undefined,
        coverImage: coverUrl ? { url: coverUrl, publicId: coverPid || undefined } : undefined,
      };
      if (mode === 'create') return createArticle(body as any);
      else return updateArticle(articleId!, body as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
    }
  });

  function saveDraft(){
    if (mutation.isPending) return;
    mutation.mutate();
  }

  async function runLanguageCheck(l: 'en'|'hi'|'gu') {
    const res = await verifyLanguage(content || title, l);
    setLangIssues(prev => ({ ...prev, [l]: res.issues }));
  }

  async function runPti(){
    const res = await ptiCheck({ title, content });
    setPtiStatus(res.status === 'compliant' ? 'compliant' : 'needs_review');
    setPtiReasons(res.reasons);
  }

  async function runReadability(){
    const res = await readability(content || title, language);
    setReadabilityGrade(res.grade);
    setReadingSeconds(res.readingTimeSec);
  }

  const canPublish = (userRole === 'admin' || userRole === 'founder') && (ptiStatus === 'compliant' || founderOverride) && ['en','hi','gu'].every(l => (langIssues[l]||[]).length === 0 || founderOverride);

  async function onPickCoverFile(file: File | null) {
    setCoverUploadError('');
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const res = await uploadCoverImage(file);
      setImageUrl(res.url);
      setCoverImagePublicId(res.publicId || '');
    } catch (err: any) {
      console.error('[ADMIN][COVER_UPLOAD] Failed', err);
      setCoverUploadError(err?.message || 'Upload failed');
    } finally {
      setIsUploadingCover(false);
    }
  }

  return (
    <form onSubmit={e=> { e.preventDefault(); mutation.mutate(); }} className="space-y-6">
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
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Summary</label>
            <label className="text-xs flex items-center gap-1 select-none">
              <input type="checkbox" checked={autoSummary} onChange={e=> setAutoSummary(e.target.checked)} /> Auto
            </label>
          </div>
          <textarea value={summary} onChange={e=> setSummary(e.target.value)} rows={3} className="w-full border px-2 py-2 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Cover Image</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0] || null;
                await onPickCoverFile(f);
                e.currentTarget.value = '';
              }}
              disabled={isUploadingCover}
              className="text-sm"
            />
            {isUploadingCover && <div className="text-xs text-slate-600">Uploading…</div>}
          </div>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full border px-2 py-2 rounded mt-2"
            placeholder="https://… (optional)"
          />
          {coverUploadError && <div className="text-xs text-red-600 mt-1">{coverUploadError}</div>}
          {imageUrl && (
            <div className="mt-2">
              <img
                src={imageUrl}
                alt="cover preview"
                className="w-full max-w-md rounded border"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium">Content</label>
          <textarea value={content} onChange={e=> setContent(e.target.value)} rows={10} className="w-full border px-2 py-2 rounded font-mono" placeholder="Write article content..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Category</label>
            <input value={category} onChange={e=> setCategory(e.target.value)} className="w-full border px-2 py-2 rounded" />
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

      {/* Sidebar like section */}
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
            onApplyTitle={(v)=> { setTitle(v); }}
            onApplySlug={(v)=> { setSlug(v); setAutoSlug(false); }}
            onApplySummary={(v)=> { setSummary(v); setAutoSummary(false); }}
          />
          <div className="card p-4">
            <h3 className="font-semibold mb-2">SEO</h3>
            <div className="text-xs">Title Tag Preview: {title || 'Untitled'} | NewsPulse</div>
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

      <div className="sticky bottom-0 bg-white border-t border-slate-200 py-3 flex gap-3 justify-end">
        <button type="button" onClick={saveDraft} className="btn-secondary" disabled={!title}>Save Draft</button>
        <button type="submit" className="btn" disabled={!canPublish}>Publish</button>
      </div>
    </form>
  );
}

export default ArticleForm;
