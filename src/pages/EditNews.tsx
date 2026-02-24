import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '../components/Editor';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { usePublishFlag } from '../context/PublishFlagContext';
import { guardAction } from '../lib/articleWorkflowGuard';
import { debug } from '../lib/debug';

import type { WorkflowChecklist, WorkflowState } from '@/types/api';
import CoverImageUpload from '@/components/articles/CoverImageUpload';
import { uploadCoverImage } from '@/lib/api/media';
import { normalizeError } from '@/lib/error';

interface NewsForm {
  title: string;
  content: string;
  category: string;
  language: string;
  summary?: string;
}

const CATEGORY_OPTIONS = [
  'Breaking News', 'Regional', 'Politics', 'National', 'International',
  'Business', 'Tech', 'Lifestyle', 'Glamorous', 'Sports',
  'Viral Videos', 'Web Stories', 'Editorial', 'Login'
];

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Gujarati'];

export default function EditNews() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { publishEnabled } = usePublishFlag();

  const [form, setForm] = useState<NewsForm>({
    title: '',
    content: '',
    category: '',
    language: '',
    summary: ''
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cover image
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPublicId, setCoverPublicId] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Editorial workflow state
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [wfLoading, setWfLoading] = useState(true);
  const [wfError, setWfError] = useState('');
  const [checklist, setChecklist] = useState<WorkflowChecklist>({
    ptiCompliance: false,
    rightsCleared: false,
    attributionPresent: false,
    defamationScanOk: false,
  });
  const [scheduleAt, setScheduleAt] = useState<string>('');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await api.get(`/articles/${id}`);
        const data = res.data;
        const article = data?.article || data?.data || data;
        if (article && (article._id || article.id)) {
          const incomingCoverField: any = article?.coverImage;
          const incomingCoverUrl = (() => {
            if (incomingCoverField && typeof incomingCoverField === 'object') {
              return incomingCoverField.url || incomingCoverField.secureUrl || incomingCoverField.secure_url || '';
            }
            return (
              article?.coverImageUrl ||
              article?.imageUrl ||
              (typeof incomingCoverField === 'string' ? incomingCoverField : '') ||
              ''
            );
          })();
          const incomingCoverPid = (() => {
            if (incomingCoverField && typeof incomingCoverField === 'object') {
              return incomingCoverField.publicId || incomingCoverField.public_id || '';
            }
            return '';
          })();

          setForm({
            title: article.title || '',
            content: article.content || '',
            category: article.category || '',
            language: article.language || '',
            summary: article.summary || ''
          });
          setCoverUrl(String(incomingCoverUrl || ''));
          setCoverPublicId(String(incomingCoverPid || ''));
          setCoverFile(null);
        } else {
          setError('⚠️ Article not found');
        }
      } catch (err) {
        console.warn('Direct fetch failed, attempting fallback list lookup…');
        try {
          const list = await api.get('/articles');
          const items = list.data?.articles || list.data?.items || list.data || [];
          const found = items.find((n: any) => (n._id || n.id) === id);
          if (found) {
            setForm({
              title: found.title || '',
              content: found.content || '',
              category: found.category || '',
              language: found.language || '',
              summary: found.summary || ''
            });
          } else {
            setError('⚠️ Article not found');
          }
        } catch (e) {
          console.error(e);
          setError('❌ Failed to load article');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [id]);

  // Load workflow state
  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!id) return;
      setWfLoading(true);
      try {
        const res = await api.get(`/news/${id}/workflow`);
        const w = res.data?.data || res.data?.workflow || res.data;
        if (w) {
          setWorkflow(w);
          const cl = w.checklist || {};
          setChecklist({
            ptiCompliance: !!cl.ptiCompliance,
            rightsCleared: !!cl.rightsCleared,
            attributionPresent: !!cl.attributionPresent,
            defamationScanOk: !!cl.defamationScanOk,
          });
        }
      } catch (err: any) {
        console.warn('Workflow fetch failed:', err?.message || err);
        setWfError('Workflow data unavailable');
      } finally {
        setWfLoading(false);
      }
    };
    fetchWorkflow();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || !form.content || !form.category || !form.language) {
      alert('⚠️ All fields are required');
      return;
    }

    try {
      const trimmedCoverUrl = String(coverUrl || '').trim();
      const trimmedCoverPid = String(coverPublicId || '').trim();
      const payload: any = {
        ...form,
        imageUrl: trimmedCoverUrl || undefined,
        coverImageUrl: trimmedCoverUrl || undefined,
        coverImage: trimmedCoverUrl ? { url: trimmedCoverUrl, publicId: trimmedCoverPid || undefined } : undefined,
      };

      await api.put(`/articles/${id}`, payload);

      toast.success('✅ Article updated');
      navigate('/manage-news');
    } catch (err: any) {
      console.error(err);
      toast.error(`❌ Server error: ${err?.message || 'unknown'}`);
    }
  };

  const uploadSelectedCover = async (file: File) => {
    setIsUploadingCover(true);
    try {
      const res = await uploadCoverImage(file);
      setCoverUrl(res.url);
      setCoverPublicId(res.publicId || '');
      toast.success('✅ Cover image uploaded');
    } catch (err: any) {
      toast.error(normalizeError(err, 'Cover image upload failed').message);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleAISummary = async () => {
    try {
      const response = await api.post(`/ai/summarize`, { content: form.content });
      const data = response.data || {};
      const summary = data.summary || data.data?.summary;
      if (summary) {
        setForm({ ...form, summary });
        toast.success('🧠 Summary updated!');
      }
    } catch (err: any) {
      toast.error(`❌ AI summarizer failed: ${err?.message || 'unknown'}`);
      console.error(err);
    }
  };

  // Checklist handlers
  const toggleChecklist = (key: keyof WorkflowChecklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveChecklist = async () => {
    if (!id) return;
    try {
      const res = await api.post(`/news/${id}/checklist`, checklist);
      const w = res.data?.data || res.data?.workflow || res.data;
      if (w) {
        setWorkflow(w);
        toast.success('✅ Checklist saved');
      } else {
        toast.success('✅ Checklist updated');
      }
    } catch (err: any) {
      toast.error(`❌ Save failed: ${err?.message || 'unknown'}`);
    }
  };

  const doTransition = async (action: 'toReview' | 'toLegal' | 'approve' | 'schedule' | 'publish') => {
    if (!id) return;
    const allChecklistOk = checklist.ptiCompliance && checklist.rightsCleared && checklist.attributionPresent && checklist.defamationScanOk;
    const g = guardAction(action, publishEnabled, { checklistOk: allChecklistOk, stage: workflow?.stage, isFounder: (user?.role || '').toLowerCase() === 'founder' });
    if (!g.allowed) {
      debug('[EditNews] blocked transition', { id, action, publishEnabled });
      toast.error(g.reason || 'Publishing disabled');
      return;
    }
    try {
      const payload: any = { action };
      if (action === 'schedule') {
        if (!scheduleAt) {
          toast.error('Please select a schedule time');
          return;
        }
        payload.scheduledAt = scheduleAt;
      }
      const res = await api.post(`/news/${id}/transition`, payload);
      const w = res.data?.data || res.data?.workflow || res.data;
      if (w) setWorkflow(w);
      toast.success(`✅ ${action} complete`);
    } catch (err: any) {
      const msg = err?.message || 'transition failed';
      toast.error(`❌ ${msg}`);
    }
  };

  const allChecklistOk = useMemo(() =>
    checklist.ptiCompliance && checklist.rightsCleared && checklist.attributionPresent && checklist.defamationScanOk,
  [checklist]);

  if (loading) return <p className="p-4">Loading news...</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">✏️ Edit News</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="📰 News Title"
          required
          className="w-full border px-4 py-2 rounded"
        />

        <div className="rounded border border-slate-200 bg-white p-3">
          <CoverImageUpload
            url={coverUrl}
            file={coverFile}
            onChangeFile={(f) => {
              setCoverFile(f);
              if (f) void uploadSelectedCover(f);
            }}
            onRemove={() => {
              setCoverFile(null);
              setCoverUrl('');
              setCoverPublicId('');
            }}
          />
          {isUploadingCover && <div className="mt-1 text-[11px] text-slate-500">Uploading…</div>}
        </div>

        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          required
          className="w-full border px-4 py-2 rounded"
        >
          <option value="">Select Category</option>
          {CATEGORY_OPTIONS.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          name="language"
          value={form.language}
          onChange={handleChange}
          required
          className="w-full border px-4 py-2 rounded"
        >
          <option value="">Select Language</option>
          {LANGUAGE_OPTIONS.map((lang, index) => (
            <option key={index} value={lang}>{lang}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleAISummary}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
        >
          🧠 Auto-Summarize
        </button>

        <textarea
          className="w-full border px-4 py-2 rounded"
          placeholder="📝 Summary will appear here..."
          rows={3}
          name="summary"
          value={form.summary || ''}
          onChange={handleChange}
        />

        <Editor
          content={form.content}
          onChange={(value) => setForm({ ...form, content: value })}
        />

        <div className="text-right">
          <button
            type="submit"
            className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-600"
          >
            💾 Save Changes
          </button>
        </div>
      </form>

      {/* Editorial Workflow Card */}
      <div className="mt-10 p-4 border rounded bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">🛠 Editorial Workflow</h2>
          {user?.role && (
            <span className="text-xs px-2 py-1 rounded bg-slate-200">Role: {user.role}</span>
          )}
        </div>

        {wfLoading ? (
          <p>Loading workflow…</p>
        ) : wfError ? (
          <p className="text-sm text-red-600">{wfError}</p>
        ) : workflow ? (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">Status: {workflow.status}</span>
              <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">Stage: {workflow.stage}</span>
              {workflow.scheduledAt ? (
                <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-800">Scheduled: {new Date(workflow.scheduledAt).toLocaleString()}</span>
              ) : null}
            </div>

            {workflow.approvals && workflow.approvals.length > 0 && (
              <div className="mb-4 border rounded bg-white overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-100 flex items-center justify-between">
                  <span>Approvals ({workflow.approvals.length})</span>
                </div>
                <div className="divide-y">
                  {workflow.approvals.map((a, idx) => (
                    <div key={idx} className="px-3 py-2 text-[11px] flex flex-wrap gap-3 items-center">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{a.role}</span>
                      {a.userName && <span className="text-slate-700">{a.userName}</span>}
                      <span className="text-slate-500">{new Date(a.at).toLocaleString()}</span>
                      {a.note && <span className="text-slate-600 italic max-w-[320px] truncate" title={a.note}>{a.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checklist.ptiCompliance} onChange={() => toggleChecklist('ptiCompliance')} />
                <span>PTI compliance</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checklist.rightsCleared} onChange={() => toggleChecklist('rightsCleared')} />
                <span>Rights cleared</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checklist.attributionPresent} onChange={() => toggleChecklist('attributionPresent')} />
                <span>Attribution present</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checklist.defamationScanOk} onChange={() => toggleChecklist('defamationScanOk')} />
                <span>Defamation scan OK</span>
              </label>
            </div>
            <div className="mt-3">
              <button onClick={saveChecklist} className="px-3 py-2 bg-slate-800 text-white rounded hover:bg-slate-700">💾 Save Checklist</button>
              {!allChecklistOk && (
                <span className="ml-3 text-xs text-amber-700">Complete all items to enable finalization</span>
              )}
            </div>

            <hr className="my-4" />
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => doTransition('toReview')}
                disabled={workflow.stage !== 'draft'}
                className={`px-3 py-2 rounded text-white ${workflow.stage !== 'draft' ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                📤 Send to Review
              </button>
              <button
                onClick={() => doTransition('toLegal')}
                disabled={workflow.stage !== 'review'}
                className={`px-3 py-2 rounded text-white ${workflow.stage !== 'review' ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}
              >
                ⚖️ Send to Legal
              </button>
              <button
                onClick={() => doTransition('approve')}
                disabled={workflow.stage !== 'legal' || !allChecklistOk}
                className={`px-3 py-2 rounded text-white ${(workflow.stage !== 'legal' || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
              >
                ✅ Approve
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="border px-2 py-1 rounded"
                />
                <button
                  onClick={() => doTransition('schedule')}
                  disabled={workflow.stage !== 'approved' || !allChecklistOk}
                  className={`px-3 py-2 rounded text-white ${(workflow.stage !== 'approved' || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500'}`}
                >
                  🗓 Schedule
                </button>
              </div>
              <button
                onClick={() => doTransition('publish')}
                disabled={(workflow.stage !== 'approved' && workflow.stage !== 'scheduled') || !allChecklistOk}
                className={`px-3 py-2 rounded text-white ${((workflow.stage !== 'approved' && workflow.stage !== 'scheduled') || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'}`}
              >
                🚀 Publish Now
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">No workflow data.</p>
        )}
      </div>
    </div>
  );
}
