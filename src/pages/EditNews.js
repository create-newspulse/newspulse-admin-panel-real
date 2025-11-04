import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '../components/Editor';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
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
    const [form, setForm] = useState({
        title: '',
        content: '',
        category: '',
        language: '',
        summary: ''
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // Editorial workflow state
    const [workflow, setWorkflow] = useState(null);
    const [wfLoading, setWfLoading] = useState(true);
    const [wfError, setWfError] = useState('');
    const [checklist, setChecklist] = useState({
        ptiCompliance: false,
        rightsCleared: false,
        attributionPresent: false,
        defamationScanOk: false,
    });
    const [scheduleAt, setScheduleAt] = useState('');
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
                }
                else {
                    setError('⚠️ News not found');
                }
            }
            catch (err) {
                console.warn('Direct fetch failed, attempting fallback list lookup…');
                try {
                    const list = await api.get('/news/all');
                    const items = list.data?.articles || list.data?.items || [];
                    const found = items.find((n) => (n._id || n.id) === id);
                    if (found) {
                        setForm({
                            title: found.title || '',
                            content: found.content || '',
                            category: found.category || '',
                            language: found.language || '',
                            summary: found.summary || ''
                        });
                    }
                    else {
                        setError('⚠️ News not found');
                    }
                }
                catch (e) {
                    console.error(e);
                    setError('❌ Failed to load news');
                }
            }
            finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, [id]);
    // Load workflow state
    useEffect(() => {
        const fetchWorkflow = async () => {
            if (!id)
                return;
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
            }
            catch (err) {
                console.warn('Workflow fetch failed:', err?.message || err);
                setWfError('Workflow data unavailable');
            }
            finally {
                setWfLoading(false);
            }
        };
        fetchWorkflow();
    }, [id]);
    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };
    const handleSubmit = async (e) => {
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
            }
            else {
                toast.error('❌ Update failed');
            }
        }
        catch (err) {
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
        }
        catch (err) {
            toast.error(`❌ AI summarizer failed: ${err?.message || 'unknown'}`);
            console.error(err);
        }
    };
    // Checklist handlers
    const toggleChecklist = (key) => {
        setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    const saveChecklist = async () => {
        if (!id)
            return;
        try {
            const res = await api.post(`/news/${id}/checklist`, checklist);
            const w = res.data?.data || res.data?.workflow || res.data;
            if (w) {
                setWorkflow(w);
                toast.success('✅ Checklist saved');
            }
            else {
                toast.success('✅ Checklist updated');
            }
        }
        catch (err) {
            toast.error(`❌ Save failed: ${err?.message || 'unknown'}`);
        }
    };
    const doTransition = async (action) => {
        if (!id)
            return;
        try {
            const payload = { action };
            if (action === 'schedule') {
                if (!scheduleAt) {
                    toast.error('Please select a schedule time');
                    return;
                }
                payload.scheduledAt = scheduleAt;
            }
            const res = await api.post(`/news/${id}/transition`, payload);
            const w = res.data?.data || res.data?.workflow || res.data;
            if (w)
                setWorkflow(w);
            toast.success(`✅ ${action} complete`);
        }
        catch (err) {
            const msg = err?.message || 'transition failed';
            toast.error(`❌ ${msg}`);
        }
    };
    const allChecklistOk = useMemo(() => checklist.ptiCompliance && checklist.rightsCleared && checklist.attributionPresent && checklist.defamationScanOk, [checklist]);
    if (loading)
        return _jsx("p", { className: "p-4", children: "Loading news..." });
    if (error)
        return _jsx("p", { className: "p-4 text-red-500", children: error });
    return (_jsxs("div", { className: "p-6 max-w-2xl mx-auto", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "\u270F\uFE0F Edit News" }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsx("input", { name: "title", value: form.title, onChange: handleChange, placeholder: "\uD83D\uDCF0 News Title", required: true, className: "w-full border px-4 py-2 rounded" }), _jsxs("select", { name: "category", value: form.category, onChange: handleChange, required: true, className: "w-full border px-4 py-2 rounded", children: [_jsx("option", { value: "", children: "Select Category" }), CATEGORY_OPTIONS.map((cat, index) => (_jsx("option", { value: cat, children: cat }, index)))] }), _jsxs("select", { name: "language", value: form.language, onChange: handleChange, required: true, className: "w-full border px-4 py-2 rounded", children: [_jsx("option", { value: "", children: "Select Language" }), LANGUAGE_OPTIONS.map((lang, index) => (_jsx("option", { value: lang, children: lang }, index)))] }), _jsx("button", { type: "button", onClick: handleAISummary, className: "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500", children: "\uD83E\uDDE0 Auto-Summarize" }), _jsx("textarea", { className: "w-full border px-4 py-2 rounded", placeholder: "\uD83D\uDCDD Summary will appear here...", rows: 3, name: "summary", value: form.summary || '', onChange: handleChange }), _jsx(Editor, { content: form.content, onChange: (value) => setForm({ ...form, content: value }) }), _jsx("div", { className: "text-right", children: _jsx("button", { type: "submit", className: "bg-green-700 text-white px-6 py-2 rounded hover:bg-green-600", children: "\uD83D\uDCBE Save Changes" }) })] }), _jsxs("div", { className: "mt-10 p-4 border rounded bg-slate-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-xl font-semibold", children: "\uD83D\uDEE0 Editorial Workflow" }), user?.role && (_jsxs("span", { className: "text-xs px-2 py-1 rounded bg-slate-200", children: ["Role: ", user.role] }))] }), wfLoading ? (_jsx("p", { children: "Loading workflow\u2026" })) : wfError ? (_jsx("p", { className: "text-sm text-red-600", children: wfError })) : workflow ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex gap-2 mb-4 flex-wrap", children: [_jsxs("span", { className: "px-2 py-1 text-xs rounded bg-blue-100 text-blue-800", children: ["Status: ", workflow.status] }), _jsxs("span", { className: "px-2 py-1 text-xs rounded bg-purple-100 text-purple-800", children: ["Stage: ", workflow.stage] }), workflow.scheduledAt ? (_jsxs("span", { className: "px-2 py-1 text-xs rounded bg-amber-100 text-amber-800", children: ["Scheduled: ", new Date(workflow.scheduledAt).toLocaleString()] })) : null] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: checklist.ptiCompliance, onChange: () => toggleChecklist('ptiCompliance') }), _jsx("span", { children: "PTI compliance" })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: checklist.rightsCleared, onChange: () => toggleChecklist('rightsCleared') }), _jsx("span", { children: "Rights cleared" })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: checklist.attributionPresent, onChange: () => toggleChecklist('attributionPresent') }), _jsx("span", { children: "Attribution present" })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: checklist.defamationScanOk, onChange: () => toggleChecklist('defamationScanOk') }), _jsx("span", { children: "Defamation scan OK" })] })] }), _jsxs("div", { className: "mt-3", children: [_jsx("button", { onClick: saveChecklist, className: "px-3 py-2 bg-slate-800 text-white rounded hover:bg-slate-700", children: "\uD83D\uDCBE Save Checklist" }), !allChecklistOk && (_jsx("span", { className: "ml-3 text-xs text-amber-700", children: "Complete all items to enable finalization" }))] }), _jsx("hr", { className: "my-4" }), _jsxs("div", { className: "flex flex-wrap gap-2 items-center", children: [_jsx("button", { onClick: () => doTransition('toReview'), disabled: workflow.stage !== 'draft', className: `px-3 py-2 rounded text-white ${workflow.stage !== 'draft' ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`, children: "\uD83D\uDCE4 Send to Review" }), _jsx("button", { onClick: () => doTransition('toLegal'), disabled: workflow.stage !== 'review', className: `px-3 py-2 rounded text-white ${workflow.stage !== 'review' ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`, children: "\u2696\uFE0F Send to Legal" }), _jsx("button", { onClick: () => doTransition('approve'), disabled: workflow.stage !== 'legal' || !allChecklistOk, className: `px-3 py-2 rounded text-white ${(workflow.stage !== 'legal' || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`, children: "\u2705 Approve" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "datetime-local", value: scheduleAt, onChange: (e) => setScheduleAt(e.target.value), className: "border px-2 py-1 rounded" }), _jsx("button", { onClick: () => doTransition('schedule'), disabled: workflow.stage !== 'approved' || !allChecklistOk, className: `px-3 py-2 rounded text-white ${(workflow.stage !== 'approved' || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500'}`, children: "\uD83D\uDDD3 Schedule" })] }), _jsx("button", { onClick: () => doTransition('publish'), disabled: (workflow.stage !== 'approved' && workflow.stage !== 'scheduled') || !allChecklistOk, className: `px-3 py-2 rounded text-white ${((workflow.stage !== 'approved' && workflow.stage !== 'scheduled') || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'}`, children: "\uD83D\uDE80 Publish Now" })] })] })) : (_jsx("p", { className: "text-sm text-slate-600", children: "No workflow data." }))] })] }));
}
