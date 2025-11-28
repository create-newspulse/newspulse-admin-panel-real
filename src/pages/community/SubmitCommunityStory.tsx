import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createCommunityArticle, type Article } from '@/lib/api/articles';
import { ARTICLE_CATEGORIES } from '@/lib/categories';

interface SubmitStoryFormValues {
  title: string;
  language: 'en' | 'hi' | 'gu';
  category: string;
  summary?: string;
  body: string;
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactMethod?: '' | 'email' | 'phone' | 'whatsapp' | 'other';
  contactOk: boolean;
  futureContactOk: boolean;
}

export default function SubmitCommunityStory() {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'en'|'hi'|'gu'>('en');
  const [category, setCategory] = useState<string>(ARTICLE_CATEGORIES[0]);
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('India');
  const [district, setDistrict] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMethod, setContactMethod] = useState<SubmitStoryFormValues['contactMethod']>('');
  const [contactOk, setContactOk] = useState(false);
  const [futureContactOk, setFutureContactOk] = useState(false);
  const [confirmGuidelines, setConfirmGuidelines] = useState(false);

  const mutation = useMutation({
    mutationFn: async (status: Article['status']) => {
      const payload: Partial<Article & {
        city?: string; location?: string; state?: string; country?: string; district?: string;
        contactName?: string; contactEmail?: string; contactPhone?: string; contactMethod?: string;
        contactOk?: boolean; futureContactOk?: boolean;
      }> = {
        title,
        language,
        category,
        summary: summary || undefined,
        content: body,
        status: status,
        city: city || undefined,
        location: city || undefined,
        state: stateName || undefined,
        country: country || undefined,
        district: district || undefined,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        contactMethod: contactMethod || undefined,
        contactOk,
        futureContactOk,
      };
      return await createCommunityArticle(payload);
    },
    onSuccess: () => {
      toast.success('Story saved successfully');
      // Option A: clear form to allow new submission
      setTitle(''); setLanguage('en'); setCategory(ARTICLE_CATEGORIES[0]); setCity(''); setStateName(''); setCountry('India'); setDistrict('');
      setSummary(''); setBody(''); setContactName(''); setContactEmail(''); setContactPhone(''); setContactMethod(''); setContactOk(false); setFutureContactOk(false); setConfirmGuidelines(false);
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
    if (contactEmail.trim()) {
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(contactEmail.trim())) return 'Please enter a valid email address.';
    }
    if (contactPhone.trim()) {
      const phoneRegex = /^[+0-9][0-9\s\-()+]{5,}$/;
      if (!phoneRegex.test(contactPhone.trim())) return 'Please enter a valid phone number.';
    }
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

          {/* Location & Contact */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Location & Contact</h2>
              <p className="text-xs text-slate-500 mt-1">This information is only visible to the NewsPulse editorial team. It will not appear on the public website.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium">City / Town</label>
                <input value={city} onChange={e=> setCity(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="City" />
              </div>
              <div>
                <label className="block text-sm font-medium">State / Region</label>
                <input value={stateName} onChange={e=> setStateName(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="State" />
              </div>
              <div>
                <label className="block text-sm font-medium">Country</label>
                <input value={country} onChange={e=> setCountry(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="Country" />
              </div>
              <div>
                <label className="block text-sm font-medium">District / Area (optional)</label>
                <input value={district} onChange={e=> setDistrict(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="District" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium">Your name</label>
                <input value={contactName} onChange={e=> setContactName(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="Name" />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input type="email" value={contactEmail} onChange={e=> setContactEmail(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="you@example.com" />
                {contactEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim()) && (
                  <p className="text-xs text-red-600 mt-1">Invalid email format.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Phone / WhatsApp</label>
                <input type="tel" value={contactPhone} onChange={e=> setContactPhone(e.target.value)} className="w-full border px-2 py-2 rounded" placeholder="+91 ..." />
                {contactPhone.trim() && !/^[+0-9][0-9\s\-()+]{5,}$/.test(contactPhone.trim()) && (
                  <p className="text-xs text-red-600 mt-1">Invalid phone format.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Preferred Contact Method</label>
                <select value={contactMethod} onChange={e=> setContactMethod(e.target.value as any)} className="w-full border px-2 py-2 rounded">
                  <option value="">No preference</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={contactOk} onChange={e=> setContactOk(e.target.checked)} />
                <span>You may contact me about this story if editors need more details or verification.</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={futureContactOk} onChange={e=> setFutureContactOk(e.target.checked)} />
                <span>You may contact me in the future for important stories from my city/region.</span>
              </label>
            </div>
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
