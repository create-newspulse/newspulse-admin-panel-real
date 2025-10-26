import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '../components/Editor';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface NewsForm {
  title: string;
  content: string;
  category: string;
  language: string;
  summary?: string;
}

type WorkflowChecklist = {
  ptiCompliance: boolean;
  rightsCleared: boolean;
  attributionPresent: boolean;
  defamationScanOk: boolean;
};

type WorkflowState = {
  status: string;
  stage: string;
  checklist: WorkflowChecklist;
  approvals?: Array<any>;
  scheduledAt?: string | null;
};

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

  const [form, setForm] = useState<NewsForm>({
    title: '',
    content: '',
    category: '',
    language: '',
    summary: ''
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const res = await api.get(`/news/${id}`);
        const data = res.data;
        if ((data.success && data.data) || data?.title) {
          setForm({
            title: data.data?.title ?? data.title,
            content: data.data?.content ?? data.content,
            category: data.data?.category ?? data.category,
            language: data.data?.language ?? data.language,
            summary: data.data?.summary ?? data.summary ?? ''
          });
        } else {
          setError('⚠️ News not found');
        }
      } catch (err) {
        console.warn('Direct fetch failed, attempting fallback list lookup…');
        try {
          const list = await api.get('/news/all');
          const items = list.data?.articles || list.data?.items || [];
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
            setError('⚠️ News not found');
          }
        } catch (e) {
          console.error(e);
          setError('❌ Failed to load news');
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
      const res = await api.put(`/edit-news/${id}`, form);
      const result = res.data || {};

      if (result.success) {
        toast.success('✅ News updated');
        navigate('/manage-news');
      } else {
        toast.error('❌ Update failed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`❌ Server error: ${err?.message || 'unknown'}`);
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
