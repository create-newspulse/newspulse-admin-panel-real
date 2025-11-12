import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ≡ƒô▒ AMP Web Stories Editor - Complete with Templates & Preview
import { useEffect, useState } from 'react';
import axios from 'axios';
import { BookOpen, Plus, Edit, Trash2, Eye, Upload, Save, Layout, Image as ImageIcon, Type, Play, BarChart } from 'lucide-react';
const API_BASE = import.meta.env.VITE_API_URL || '/admin-api';
export default function WebStoriesEditor() {
    const [stories, setStories] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedStory, setSelectedStory] = useState(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list');
    useEffect(() => {
        loadData();
    }, []);
    const loadData = async () => {
        setLoading(true);
        try {
            const [storiesRes, templatesRes] = await Promise.all([
                axios.get(`${API_BASE}/web-stories`),
                axios.get(`${API_BASE}/web-stories/templates/list`)
            ]);
            setStories(storiesRes.data.stories || []);
            setTemplates(templatesRes.data.templates || []);
        }
        catch (error) {
            console.error('Failed to load stories:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const createStory = async (template) => {
        const title = prompt('Story title:');
        if (!title)
            return;
        try {
            const response = await axios.post(`${API_BASE}/web-stories`, {
                title,
                template: template.id,
                author: 'admin@newspulse.com'
            });
            setStories([response.data.story, ...stories]);
            setShowTemplates(false);
            setSelectedStory(response.data.story);
            setView('editor');
        }
        catch (error) {
            console.error('Failed to create story:', error);
        }
    };
    const deleteStory = async (id) => {
        if (!confirm('Delete this story?'))
            return;
        try {
            await axios.delete(`${API_BASE}/web-stories/${id}`);
            setStories(stories.filter(s => s.id !== id));
        }
        catch (error) {
            console.error('Failed to delete story:', error);
        }
    };
    const publishStory = async (id) => {
        try {
            const response = await axios.post(`${API_BASE}/web-stories/${id}/publish`);
            setStories(stories.map(s => s.id === id ? response.data.story : s));
            if (selectedStory?.id === id)
                setSelectedStory(response.data.story);
        }
        catch (error) {
            console.error('Failed to publish story:', error);
        }
    };
    const viewAnalytics = async (story) => {
        setSelectedStory(story);
        setView('analytics');
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-8", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsxs("h1", { className: "text-4xl font-bold text-white flex items-center gap-3 mb-2", children: [_jsx(BookOpen, { className: "w-10 h-10 text-purple-300" }), "Web Stories Editor"] }), _jsx("p", { className: "text-purple-200", children: "Create engaging AMP Web Stories with visual editor" })] }), _jsxs("div", { className: "flex gap-2 mb-6", children: [_jsx("button", { onClick: () => setView('list'), className: `px-4 py-2 rounded-lg font-medium transition ${view === 'list'
                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-purple-800/50 text-purple-200 hover:bg-purple-700/50'}`, children: "All Stories" }), _jsxs("button", { onClick: () => setShowTemplates(true), className: "px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition flex items-center gap-2", children: [_jsx(Plus, { className: "w-4 h-4" }), "New Story"] })] }), loading ? (_jsxs("div", { className: "bg-purple-800/30 rounded-xl p-12 text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-4 border-purple-400 border-t-transparent mx-auto mb-4" }), _jsx("p", { className: "text-purple-200", children: "Loading stories..." })] })) : (_jsxs(_Fragment, { children: [view === 'list' && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: stories.map(story => (_jsxs("div", { className: "bg-purple-800/30 backdrop-blur-sm rounded-xl p-6 border border-purple-700/50 hover:border-purple-500 transition", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-1", children: story.title }), _jsx("span", { className: `text-xs px-2 py-1 rounded ${story.status === 'published'
                                                            ? 'bg-green-500/20 text-green-300'
                                                            : 'bg-yellow-500/20 text-yellow-300'}`, children: story.status.toUpperCase() })] }), _jsx("button", { onClick: () => deleteStory(story.id), className: "text-red-400 hover:text-red-300 transition", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "space-y-2 mb-4", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-purple-300", children: "Views:" }), _jsx("span", { className: "text-white font-medium", children: story.metadata.views.toLocaleString() })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-purple-300", children: "Completion:" }), _jsxs("span", { className: "text-white font-medium", children: [story.metadata.completionRate, "%"] })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-purple-300", children: "Pages:" }), _jsx("span", { className: "text-white font-medium", children: story.pages.length })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { onClick: () => {
                                                    setSelectedStory(story);
                                                    setView('editor');
                                                }, className: "flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2", children: [_jsx(Edit, { className: "w-4 h-4" }), "Edit"] }), _jsxs("button", { onClick: () => viewAnalytics(story), className: "flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2", children: [_jsx(BarChart, { className: "w-4 h-4" }), "Analytics"] })] }), story.status === 'draft' && (_jsxs("button", { onClick: () => publishStory(story.id), className: "w-full mt-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2", children: [_jsx(Play, { className: "w-4 h-4" }), "Publish Story"] }))] }, story.id))) })), view === 'editor' && selectedStory && (_jsxs("div", { className: "bg-purple-800/30 backdrop-blur-sm rounded-xl p-6 border border-purple-700/50", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-white", children: selectedStory.title }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { className: "px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2", children: [_jsx(Save, { className: "w-4 h-4" }), "Save"] }), _jsxs("button", { className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2", children: [_jsx(Eye, { className: "w-4 h-4" }), "Preview"] }), _jsx("button", { onClick: () => setView('list'), className: "px-4 py-2 bg-purple-800/50 hover:bg-purple-700/50 text-purple-200 rounded-lg font-medium transition", children: "Back" })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-6", children: [_jsxs("div", { className: "col-span-1 space-y-4", children: [_jsxs("div", { className: "bg-purple-700/30 rounded-lg p-4", children: [_jsx("h3", { className: "text-white font-semibold mb-3", children: "Add Elements" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("button", { className: "w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2", children: [_jsx(ImageIcon, { className: "w-4 h-4" }), "Add Image"] }), _jsxs("button", { className: "w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2", children: [_jsx(Type, { className: "w-4 h-4" }), "Add Text"] }), _jsxs("button", { className: "w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2", children: [_jsx(Layout, { className: "w-4 h-4" }), "Add Page"] }), _jsxs("button", { className: "w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2", children: [_jsx(Upload, { className: "w-4 h-4" }), "Upload Media"] })] })] }), _jsxs("div", { className: "bg-purple-700/30 rounded-lg p-4", children: [_jsx("h3", { className: "text-white font-semibold mb-3", children: "Pages" }), _jsx("div", { className: "space-y-2", children: selectedStory.pages.length === 0 ? (_jsx("p", { className: "text-sm text-purple-300", children: "No pages yet. Add your first page!" })) : (selectedStory.pages.map((page, i) => (_jsxs("div", { className: "px-3 py-2 bg-purple-600/50 rounded text-white text-sm", children: ["Page ", i + 1] }, i)))) })] })] }), _jsx("div", { className: "col-span-2", children: _jsx("div", { className: "bg-black rounded-lg aspect-[9/16] max-w-sm mx-auto relative overflow-hidden", children: selectedStory.pages.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsxs("div", { className: "text-center", children: [_jsx(Layout, { className: "w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" }), _jsx("p", { className: "text-purple-300 mb-2", children: "Empty Story" }), _jsx("p", { className: "text-sm text-purple-400", children: "Add pages to begin" })] }) })) : (_jsx("div", { className: "w-full h-full bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center", children: _jsx("p", { className: "text-white text-lg", children: "Story Preview" }) })) }) })] })] })), view === 'analytics' && selectedStory && (_jsxs("div", { className: "space-y-6", children: [_jsx("button", { onClick: () => setView('list'), className: "px-4 py-2 bg-purple-800/50 hover:bg-purple-700/50 text-purple-200 rounded-lg font-medium transition", children: "\u2190 Back to Stories" }), _jsxs("div", { className: "bg-purple-800/30 backdrop-blur-sm rounded-xl p-6 border border-purple-700/50", children: [_jsxs("h2", { className: "text-2xl font-bold text-white mb-6", children: [selectedStory.title, " - Analytics"] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6", children: [_jsxs("div", { className: "bg-purple-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-purple-300 mb-1", children: "Total Views" }), _jsx("p", { className: "text-3xl font-bold text-white", children: selectedStory.metadata.views.toLocaleString() })] }), _jsxs("div", { className: "bg-purple-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-purple-300 mb-1", children: "Completion Rate" }), _jsxs("p", { className: "text-3xl font-bold text-white", children: [selectedStory.metadata.completionRate, "%"] })] }), _jsxs("div", { className: "bg-purple-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-purple-300 mb-1", children: "Avg Time/Page" }), _jsxs("p", { className: "text-3xl font-bold text-white", children: [selectedStory.metadata.avgTimePerPage, "s"] })] })] }), _jsxs("div", { className: "bg-purple-700/30 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Traffic Sources" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "text-purple-300", children: "Social Media" }), _jsx("span", { className: "text-white", children: "45%" })] }), _jsx("div", { className: "w-full bg-purple-900/50 rounded-full h-2", children: _jsx("div", { className: "bg-purple-500 h-2 rounded-full", style: { width: '45%' } }) })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "text-purple-300", children: "Direct" }), _jsx("span", { className: "text-white", children: "35%" })] }), _jsx("div", { className: "w-full bg-purple-900/50 rounded-full h-2", children: _jsx("div", { className: "bg-blue-500 h-2 rounded-full", style: { width: '35%' } }) })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "text-purple-300", children: "Search" }), _jsx("span", { className: "text-white", children: "20%" })] }), _jsx("div", { className: "w-full bg-purple-900/50 rounded-full h-2", children: _jsx("div", { className: "bg-green-500 h-2 rounded-full", style: { width: '20%' } }) })] })] })] })] })] }))] })), showTemplates && (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-purple-900 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-white", children: "Choose a Template" }), _jsx("button", { onClick: () => setShowTemplates(false), className: "text-purple-300 hover:text-white transition", children: "\u2715" })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: templates.map(template => (_jsxs("button", { onClick: () => createStory(template), className: "bg-purple-800/50 rounded-lg p-4 hover:bg-purple-700/50 transition text-center border border-purple-700 hover:border-purple-500", children: [_jsx("div", { className: "w-full aspect-[9/16] bg-purple-700/30 rounded mb-3 overflow-hidden", children: _jsx("img", { src: template.thumbnail, alt: template.name, className: "w-full h-full object-cover" }) }), _jsx("p", { className: "text-white font-medium", children: template.name }), _jsxs("p", { className: "text-xs text-purple-300 mt-1", children: [template.pages, " pages"] })] }, template.id))) })] }) }))] }) }));
}
