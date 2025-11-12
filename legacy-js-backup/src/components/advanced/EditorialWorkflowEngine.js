import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒº¡ EDITORIAL WORKFLOW ENGINE - Enterprise-grade newsroom pipeline
// Multi-stage approvals ΓÇó PTI compliance ΓÇó Legal tools ΓÇó Embargo handling ΓÇó Red Team review
import { useMemo, useState } from 'react';
import { CheckCircle, Clock, Calendar, Users, UserCheck, Shield, FileText, Gavel, Flag, Ban, MessageSquare, Plus, ChevronRight, ChevronDown, Globe, Lock, Search, TimerReset } from 'lucide-react';
const initialItems = [
    {
        id: 'WF-1001',
        title: 'Indian GDP growth outlook improves; RBI hints calibrated easing',
        author: 'Anita Sharma',
        language: 'EN',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        priority: 'high',
        stage: 'copy_edit',
        legalFlags: ['copyright'],
        redTeamFindings: 1
    },
    {
        id: 'WF-1002',
        title: 'Mumbai local upgrades: New AC rakes, safety push announced',
        author: 'Rahul Verma',
        language: 'HI',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
        priority: 'medium',
        stage: 'legal_review',
        legalFlags: ['privacy']
    },
    {
        id: 'WF-1003',
        title: 'Gujarat MSMEs rally on export incentives; job creation rises',
        author: 'Meera Patel',
        language: 'GU',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        priority: 'urgent',
        stage: 'editor_approval',
        embargoAt: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    }
];
const priorityColor = (p) => p === 'urgent' ? 'text-red-400' : p === 'high' ? 'text-orange-400' : p === 'medium' ? 'text-yellow-400' : 'text-slate-300';
const stageMeta = {
    draft: { label: 'Draft', color: 'bg-slate-600/30', icon: _jsx(FileText, { className: "w-4 h-4" }) },
    copy_edit: { label: 'Copy Edit', color: 'bg-blue-600/20', icon: _jsx(Users, { className: "w-4 h-4" }) },
    legal_review: { label: 'Legal Review', color: 'bg-purple-600/20', icon: _jsx(Gavel, { className: "w-4 h-4" }) },
    editor_approval: { label: 'Editor Approval', color: 'bg-emerald-600/20', icon: _jsx(UserCheck, { className: "w-4 h-4" }) },
    founder_approval: { label: 'Founder Approval', color: 'bg-amber-600/20', icon: _jsx(Shield, { className: "w-4 h-4" }) },
    scheduled: { label: 'Scheduled', color: 'bg-indigo-600/20', icon: _jsx(Calendar, { className: "w-4 h-4" }) },
    published: { label: 'Published', color: 'bg-green-600/20', icon: _jsx(CheckCircle, { className: "w-4 h-4" }) },
};
const stages = [
    'draft',
    'copy_edit',
    'legal_review',
    'editor_approval',
    'founder_approval',
    'scheduled',
    'published'
];
const EditorialWorkflowEngine = () => {
    const [items, setItems] = useState(initialItems);
    const [search, setSearch] = useState('');
    const [activeItemId, setActiveItemId] = useState(null);
    const [checklist, setChecklist] = useState({
        ptiAttribution: false,
        imageRights: false,
        correctionsChecked: false,
        sourcesVerified: false,
        headlineNonDefamatory: false,
        balancedReporting: false
    });
    const [comments, setComments] = useState([]);
    const [showCompliance, setShowCompliance] = useState(true);
    const [redTeamMode, setRedTeamMode] = useState(false);
    const activeItem = useMemo(() => items.find(i => i.id === activeItemId) || null, [items, activeItemId]);
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return items.filter(i => i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }, [items, search]);
    const itemsByStage = useMemo(() => {
        const map = {
            draft: [], copy_edit: [], legal_review: [], editor_approval: [], founder_approval: [], scheduled: [], published: []
        };
        filtered.forEach(i => map[i.stage].push(i));
        return map;
    }, [filtered]);
    const moveToStage = (itemId, stage) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, stage, updatedAt: new Date().toISOString() } : i));
    };
    const toggleChecklist = (key) => {
        setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    };
    const addComment = (message, stage) => {
        if (!activeItem)
            return;
        const newComment = {
            id: 'C-' + Math.random().toString(36).slice(2, 8),
            itemId: activeItem.id,
            stage,
            author: 'You',
            role: 'Editor',
            message,
            createdAt: new Date().toISOString()
        };
        setComments(prev => [newComment, ...prev]);
    };
    const redTeamPrompts = [
        'If this story was false, how would we know? Find 2 disconfirming sources.',
        'List parties that may claim defamation. Are their viewpoints included?',
        'Could this content interfere with an ongoing trial (sub judice)?',
        'Does any quote lack explicit attribution? Mark and request proof.',
        'Identify any private individual data. Is consent documented?'
    ];
    const schedulable = (item) => item.stage === 'founder_approval' || item.stage === 'editor_approval';
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white", children: [_jsx("div", { className: "bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border-b border-emerald-700/30", children: _jsxs("div", { className: "px-6 py-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "p-3 bg-emerald-600/20 rounded-lg border border-emerald-500/30", children: _jsx(Shield, { className: "w-8 h-8 text-emerald-400" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Editorial Workflow Engine" }), _jsx("p", { className: "text-emerald-300", children: "Multi-stage approvals \u2022 PTI \u2022 Legal \u2022 Embargo \u2022 Red Team" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" }), _jsx("input", { value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search by title, author, ID...", className: "pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm" })] }), _jsx("button", { onClick: () => setRedTeamMode(v => !v), className: `px-3 py-2 rounded-lg text-sm border ${redTeamMode ? 'bg-red-600/20 border-red-500/50 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`, children: redTeamMode ? 'Red Team: ON' : 'Red Team: OFF' }), _jsxs("button", { className: "px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold flex items-center", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), " New Story"] })] })] }) }), _jsxs("div", { className: "p-6 grid grid-cols-1 xl:grid-cols-3 gap-6", children: [_jsx("div", { className: "xl:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4", children: stages.slice(0, 6).map(stage => (_jsxs("div", { className: "bg-slate-800/50 rounded-xl border border-slate-700/50 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("div", { className: "flex items-center gap-2", children: _jsxs("div", { className: `px-2 py-1 rounded ${stageMeta[stage].color} text-slate-200 flex items-center gap-1`, children: [stageMeta[stage].icon, _jsx("span", { className: "text-xs font-semibold", children: stageMeta[stage].label })] }) }), _jsx("span", { className: "text-xs text-slate-400", children: itemsByStage[stage].length })] }), _jsx("div", { className: "space-y-3 max-h-[60vh] overflow-y-auto pr-1", children: itemsByStage[stage].map(it => (_jsxs("div", { className: `p-3 rounded-lg border border-slate-600/30 bg-slate-700/20 hover:border-emerald-500/40 transition-colors ${activeItemId === it.id ? 'ring-2 ring-emerald-500/40' : ''}`, children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("button", { className: "text-left", onClick: () => setActiveItemId(it.id), children: _jsx("p", { className: "text-white font-semibold leading-tight line-clamp-2", children: it.title }) }), _jsxs("div", { className: "mt-1 text-xs text-slate-400 flex items-center gap-2", children: [_jsx("span", { children: it.author }), _jsx("span", { children: "\u2022" }), _jsx("span", { className: "font-mono", children: it.id }), _jsx("span", { children: "\u2022" }), _jsx("span", { className: priorityColor(it.priority), children: it.priority.toUpperCase() })] }), _jsxs("div", { className: "mt-1 text-[11px] text-slate-500", children: ["Updated ", new Date(it.updatedAt).toLocaleTimeString(), " \u2022 Lang: ", it.language] })] }), _jsxs("div", { className: "flex flex-col items-end gap-2", children: [it.embargoAt && (_jsxs("div", { className: "px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-300 text-[10px] flex items-center gap-1", children: [_jsx(Clock, { className: "w-3 h-3" }), " Embargo ", new Date(it.embargoAt).toLocaleTimeString()] })), it.redTeamFindings ? (_jsxs("div", { className: "px-2 py-0.5 rounded bg-red-600/20 text-red-300 text-[10px]", children: ["RedTeam ", it.redTeamFindings] })) : null, it.legalFlags && it.legalFlags.length > 0 && (_jsxs("div", { className: "px-2 py-0.5 rounded bg-yellow-600/20 text-yellow-300 text-[10px] flex items-center gap-1", children: [_jsx(Gavel, { className: "w-3 h-3" }), " ", it.legalFlags.length, " legal"] }))] })] }), _jsxs("div", { className: "mt-3 grid grid-cols-2 gap-2", children: [stage !== 'published' && (_jsx("button", { onClick: () => moveToStage(it.id, stages[stages.indexOf(stage) + 1]), className: "px-2 py-1 bg-emerald-600/20 text-emerald-300 rounded text-xs hover:bg-emerald-600/30", children: "Move Next" })), stage !== 'draft' && (_jsx("button", { onClick: () => moveToStage(it.id, stages[stages.indexOf(stage) - 1]), className: "px-2 py-1 bg-slate-600/20 text-slate-300 rounded text-xs hover:bg-slate-600/30", children: "Move Back" })), schedulable(it) && (_jsx("button", { onClick: () => moveToStage(it.id, 'scheduled'), className: "px-2 py-1 bg-indigo-600/20 text-indigo-300 rounded text-xs hover:bg-indigo-600/30", children: "Schedule" })), stage === 'scheduled' && (_jsx("button", { onClick: () => moveToStage(it.id, 'published'), className: "px-2 py-1 bg-green-600/20 text-green-300 rounded text-xs hover:bg-green-600/30", children: "Publish Now" }))] })] }, it.id))) })] }, stage))) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-slate-800/50 rounded-xl border border-slate-700/50 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-semibold", children: "Inspector" }), _jsx("button", { onClick: () => setShowCompliance(s => !s), className: "text-xs px-2 py-1 rounded border border-slate-600 text-slate-300", children: showCompliance ? (_jsxs("span", { className: "flex items-center", children: [_jsx(ChevronDown, { className: "w-3 h-3 mr-1" }), "Hide"] })) : (_jsxs("span", { className: "flex items-center", children: [_jsx(ChevronRight, { className: "w-3 h-3 mr-1" }), "Show"] })) })] }), !activeItem && (_jsx("p", { className: "text-slate-400 text-sm mt-3", children: "Select a story card to inspect details, compliance, legal flags, and comments." })), activeItem && (_jsxs("div", { className: "mt-3 space-y-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-white font-semibold", children: activeItem.title }), _jsxs("p", { className: "text-xs text-slate-400", children: [activeItem.author, " \u2022 ", activeItem.id] }), _jsxs("div", { className: "mt-2 flex items-center gap-2 text-[11px] text-slate-400", children: [_jsxs("span", { className: `px-2 py-0.5 rounded ${stageMeta[activeItem.stage].color} flex items-center gap-1`, children: [stageMeta[activeItem.stage].icon, _jsx("span", { children: stageMeta[activeItem.stage].label })] }), activeItem.embargoAt && (_jsxs("span", { className: "px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-300 flex items-center gap-1", children: [_jsx(Calendar, { className: "w-3 h-3" }), "Embargo ", new Date(activeItem.embargoAt).toLocaleString()] }))] })] }), showCompliance && (_jsxs("div", { className: "bg-slate-700/30 rounded-lg border border-slate-600/30 p-3 space-y-2", children: [_jsxs("h4", { className: "text-sm font-semibold mb-1 flex items-center", children: [_jsx(Globe, { className: "w-4 h-4 mr-2" }), " PTI / Compliance"] }), [
                                                        ['ptiAttribution', 'PTI attribution and credit lines are correct'],
                                                        ['imageRights', 'Image/video rights verified; EXIF scrubbed'],
                                                        ['correctionsChecked', 'Corrections/captions validated'],
                                                        ['sourcesVerified', 'Sources verified; conflicting viewpoints represented'],
                                                        ['headlineNonDefamatory', 'Headline non-defamatory; no insinuations'],
                                                        ['balancedReporting', 'Balanced reporting; labels facts vs opinion']
                                                    ].map(([key, label]) => (_jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", className: "accent-emerald-500", checked: checklist[key], onChange: () => toggleChecklist(key) }), _jsx("span", { children: label })] }, key)))] })), _jsxs("div", { className: "bg-slate-700/30 rounded-lg border border-slate-600/30 p-3", children: [_jsxs("h4", { className: "text-sm font-semibold mb-2 flex items-center", children: [_jsx(Gavel, { className: "w-4 h-4 mr-2" }), " Legal Review"] }), _jsx("div", { className: "flex flex-wrap gap-2 text-xs", children: ['defamation', 'privacy', 'sub_judice', 'copyright', 'sensitive'].map(flag => (_jsx("span", { className: `px-2 py-1 rounded border ${activeItem.legalFlags?.includes(flag) ? 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300' : 'bg-slate-800 border-slate-600 text-slate-300'}`, children: flag.replace('_', ' ') }, flag))) }), _jsxs("div", { className: "mt-3 grid grid-cols-2 gap-2", children: [_jsx("button", { className: "px-3 py-2 rounded bg-emerald-600/20 text-emerald-300 text-xs", children: "Mark Resolved" }), _jsx("button", { className: "px-3 py-2 rounded bg-slate-600/20 text-slate-300 text-xs", children: "Request Clarification" })] })] }), _jsxs("div", { className: "bg-slate-700/30 rounded-lg border border-slate-600/30 p-3", children: [_jsxs("h4", { className: "text-sm font-semibold mb-2 flex items-center", children: [_jsx(MessageSquare, { className: "w-4 h-4 mr-2" }), " Review Comments"] }), _jsxs("div", { className: "flex gap-2 mb-2", children: [_jsx("input", { placeholder: "Add a comment for this stage...", className: "flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm", onKeyDown: (e) => {
                                                                    if (e.key === 'Enter') {
                                                                        const v = e.target.value.trim();
                                                                        if (v) {
                                                                            addComment(v, activeItem.stage);
                                                                            e.target.value = '';
                                                                        }
                                                                    }
                                                                } }), _jsx("button", { className: "px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm", children: "Send" })] }), _jsxs("div", { className: "space-y-2 max-h-44 overflow-y-auto pr-1", children: [comments.filter(c => c.itemId === activeItem.id).map(c => (_jsxs("div", { className: "p-2 rounded bg-slate-800 border border-slate-700", children: [_jsxs("div", { className: "text-xs text-slate-400 mb-1", children: [c.author, " \u2022 ", c.role, " \u2022 ", new Date(c.createdAt).toLocaleString(), " \u2022 ", stageMeta[c.stage].label] }), _jsx("div", { className: "text-sm text-white", children: c.message })] }, c.id))), comments.filter(c => c.itemId === activeItem.id).length === 0 && (_jsx("p", { className: "text-xs text-slate-500", children: "No comments yet." }))] })] }), redTeamMode && (_jsxs("div", { className: "bg-red-900/20 rounded-lg border border-red-700/40 p-3", children: [_jsxs("h4", { className: "text-sm font-semibold mb-2 flex items-center text-red-300", children: [_jsx(Flag, { className: "w-4 h-4 mr-2" }), " Red Team - Challenge Checks"] }), _jsx("ul", { className: "list-disc list-inside text-sm text-red-200 space-y-1", children: redTeamPrompts.map((p, idx) => _jsx("li", { children: p }, idx)) }), _jsxs("div", { className: "mt-3 grid grid-cols-2 gap-2", children: [_jsxs("button", { className: "px-3 py-2 rounded bg-red-600/30 text-red-200 text-xs flex items-center justify-center", children: [_jsx(TimerReset, { className: "w-4 h-4 mr-2" }), "Run Stress Test"] }), _jsx("button", { className: "px-3 py-2 rounded bg-red-600/30 text-red-200 text-xs", children: "Log Findings" })] })] }))] }))] }), _jsxs("div", { className: "bg-slate-800/50 rounded-xl border border-slate-700/50 p-4", children: [_jsx("h3", { className: "font-semibold mb-3", children: "Actions" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("button", { className: "px-3 py-2 rounded bg-indigo-600/20 text-indigo-300 text-sm flex items-center justify-center", children: [_jsx(Calendar, { className: "w-4 h-4 mr-2" }), "Set Embargo"] }), _jsxs("button", { className: "px-3 py-2 rounded bg-emerald-600/20 text-emerald-300 text-sm flex items-center justify-center", children: [_jsx(CheckCircle, { className: "w-4 h-4 mr-2" }), "Approve"] }), _jsxs("button", { className: "px-3 py-2 rounded bg-slate-600/20 text-slate-300 text-sm flex items-center justify-center", children: [_jsx(Ban, { className: "w-4 h-4 mr-2" }), "Reject"] }), _jsxs("button", { className: "px-3 py-2 rounded bg-yellow-600/20 text-yellow-300 text-sm flex items-center justify-center", children: [_jsx(Lock, { className: "w-4 h-4 mr-2" }), "Lock Story"] })] })] })] })] })] }));
};
export default EditorialWorkflowEngine;
