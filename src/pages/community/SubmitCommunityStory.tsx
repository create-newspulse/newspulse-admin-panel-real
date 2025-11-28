import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createCommunityArticle, type Article } from '@/lib/api/articles';
import { ARTICLE_CATEGORIES } from '@/lib/categories';

export default function SubmitCommunityStory() {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'en'|'hi'|'gu'>('en');
  const [category, setCategory] = useState<string>(ARTICLE_CATEGORIES[0]);
  const [city, setCity] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [confirmGuidelines, setConfirmGuidelines] = useState(false);

  const mutation = useMutation({
    mutationFn: async (status: Article['status']) => {
      const payload: Partial<Article & { city?: string; location?: string }> = {
        title,
        language,
        category,
        summary: summary || undefined,
        content: body,
        status: status,
        // optional location fields (Draft Desk reads city/location)
        city: city || undefined,
        // keep location identical to city for simplicity if only one field present
        // (other parts of UI tolerate either)
        location: city || undefined,
      };
      return await createCommunityArticle(payload);
    },
    onSuccess: () => {
      toast.success('Story saved successfully');
      // Option A: clear form to allow new submission
      setTitle(''); setLanguage('en'); setCategory(ARTICLE_CATEGORIES[0]); setCity(''); setSummary(''); setBody(''); setConfirmGuidelines(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Something went wrong while saving your story.';
      toast.error(msg);
    }
  });

  function validateCommon(): string | null {
    if (!title.trim()) return 'Headline is required';
    if (!language) return 'Language is required';
    if (!category) return 'Category is required';
    if (!body.trim()) return 'Story body is required';
    return null;
  }

  function handleSaveDraft() {
    const v = validateCommon();
    if (v) { toast.error(v); return; }
    if (!mutation.isPending) mutation.mutate('draft');
  }

  function handleSubmitForReview() {
    const v = validateCommon();
    if (v) { toast.error(v); return; }
    if (!confirmGuidelines) { toast.error('Please confirm the guidelines before submitting.'); return; }
    // Current ArticleStatus union has no explicit "submitted"; reuse draft with community origin
    if (!mutation.isPending) mutation.mutate('draft');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Submit Story – Community Reporter</h1>
        <p className="text-sm text-slate-600">Write your story here. You can save as a draft or submit it to the NewsPulse editorial team for review.</p>
      </div>

      <div className="card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium">Headline</label>
          <input value={title} onChange={e=> setTitle(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="Enter headline" required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Language</label>
            <select value={language} onChange={e=> setLanguage(e.target.value as any)} className="w-full border px-2 py-2 rounded">
              <option value='en'>English</option>
              <option value='hi'>Hindi</option>
              <option value='gu'>Gujarati</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Category</label>
            <select value={category} onChange={e=> setCategory(e.target.value)} className="w-full border px-2 py-2 rounded">
              {ARTICLE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Location / City (optional)</label>
            <input value={city} onChange={e=> setCity(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="City or locality" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Summary (optional)</label>
          <textarea value={summary} onChange={e=> setSummary(e.target.value)} rows={3} className="w-full border px-2 py-2 rounded" placeholder="2–3 lines" />
        </div>

        <div>
          <label className="block text-sm font-medium">Story</label>
          <textarea value={body} onChange={e=> setBody(e.target.value)} rows={10} className="w-full border px-2 py-2 rounded font-mono" placeholder="Write your story..." />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirmGuidelines} onChange={e=> setConfirmGuidelines(e.target.checked)} />
          I confirm this story is accurate and follows the NewsPulse guidelines.
        </label>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-slate-200 py-3 flex gap-3 justify-end">
        <button type="button" onClick={handleSaveDraft} className="btn-secondary" disabled={mutation.isPending}>Save as Draft</button>
        <button type="button" onClick={handleSubmitForReview} className="btn" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Submit for Review'}</button>
      </div>
    </div>
  );
}
