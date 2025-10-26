// 🧭 EDITORIAL WORKFLOW ENGINE - Enterprise-grade newsroom pipeline
// Multi-stage approvals • PTI compliance • Legal tools • Embargo handling • Red Team review

import React, { useMemo, useState } from 'react';
import {
  CheckCircle, Clock, Calendar, Users, UserCheck,
  Shield, FileText, Gavel, Flag, Ban, MessageSquare,
  Plus, ChevronRight, ChevronDown, Globe, Lock, Search,
  TimerReset
} from 'lucide-react';

// Types
export type WorkflowStage =
  | 'draft'
  | 'copy_edit'
  | 'legal_review'
  | 'editor_approval'
  | 'founder_approval'
  | 'scheduled'
  | 'published';

interface WorkflowItem {
  id: string;
  title: string;
  author: string;
  language: 'EN' | 'HI' | 'GU';
  createdAt: string; // ISO
  updatedAt: string; // ISO
  priority: 'low' | 'medium' | 'high' | 'urgent';
  stage: WorkflowStage;
  embargoAt?: string; // ISO
  redTeamFindings?: number;
  legalFlags?: Array<'defamation' | 'privacy' | 'sub_judice' | 'copyright' | 'sensitive'>;
}

interface ReviewComment {
  id: string;
  itemId: string;
  stage: WorkflowStage;
  author: string;
  role: 'Reporter' | 'Editor' | 'Legal' | 'Founder';
  message: string;
  createdAt: string; // ISO
}

interface ComplianceChecklist {
  ptiAttribution: boolean;
  imageRights: boolean;
  correctionsChecked: boolean;
  sourcesVerified: boolean;
  headlineNonDefamatory: boolean;
  balancedReporting: boolean;
}

const initialItems: WorkflowItem[] = [
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

const priorityColor = (p: WorkflowItem['priority']) =>
  p === 'urgent' ? 'text-red-400' : p === 'high' ? 'text-orange-400' : p === 'medium' ? 'text-yellow-400' : 'text-slate-300';

const stageMeta: Record<WorkflowStage, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-slate-600/30', icon: <FileText className="w-4 h-4" /> },
  copy_edit: { label: 'Copy Edit', color: 'bg-blue-600/20', icon: <Users className="w-4 h-4" /> },
  legal_review: { label: 'Legal Review', color: 'bg-purple-600/20', icon: <Gavel className="w-4 h-4" /> },
  editor_approval: { label: 'Editor Approval', color: 'bg-emerald-600/20', icon: <UserCheck className="w-4 h-4" /> },
  founder_approval: { label: 'Founder Approval', color: 'bg-amber-600/20', icon: <Shield className="w-4 h-4" /> },
  scheduled: { label: 'Scheduled', color: 'bg-indigo-600/20', icon: <Calendar className="w-4 h-4" /> },
  published: { label: 'Published', color: 'bg-green-600/20', icon: <CheckCircle className="w-4 h-4" /> },
};

const stages: WorkflowStage[] = [
  'draft',
  'copy_edit',
  'legal_review',
  'editor_approval',
  'founder_approval',
  'scheduled',
  'published'
];

const EditorialWorkflowEngine: React.FC = () => {
  const [items, setItems] = useState<WorkflowItem[]>(initialItems);
  const [search, setSearch] = useState('');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ComplianceChecklist>({
    ptiAttribution: false,
    imageRights: false,
    correctionsChecked: false,
    sourcesVerified: false,
    headlineNonDefamatory: false,
    balancedReporting: false
  });
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [showCompliance, setShowCompliance] = useState(true);
  const [redTeamMode, setRedTeamMode] = useState(false);

  const activeItem = useMemo(() => items.find(i => i.id === activeItemId) || null, [items, activeItemId]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i => i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
  }, [items, search]);

  const itemsByStage = useMemo(() => {
    const map: Record<WorkflowStage, WorkflowItem[]> = {
      draft: [], copy_edit: [], legal_review: [], editor_approval: [], founder_approval: [], scheduled: [], published: []
    };
    filtered.forEach(i => map[i.stage].push(i));
    return map;
  }, [filtered]);

  const moveToStage = (itemId: string, stage: WorkflowStage) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, stage, updatedAt: new Date().toISOString() } : i));
  };

  const toggleChecklist = (key: keyof ComplianceChecklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addComment = (message: string, stage: WorkflowStage) => {
    if (!activeItem) return;
    const newComment: ReviewComment = {
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

  const schedulable = (item: WorkflowItem) => item.stage === 'founder_approval' || item.stage === 'editor_approval';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border-b border-emerald-700/30">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-600/20 rounded-lg border border-emerald-500/30">
              <Shield className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Editorial Workflow Engine</h1>
              <p className="text-emerald-300">Multi-stage approvals • PTI • Legal • Embargo • Red Team</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, author, ID..."
                className="pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={() => setRedTeamMode(v => !v)}
              className={`px-3 py-2 rounded-lg text-sm border ${redTeamMode ? 'bg-red-600/20 border-red-500/50 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
            >
              {redTeamMode ? 'Red Team: ON' : 'Red Team: OFF'}
            </button>
            <button className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold flex items-center">
              <Plus className="w-4 h-4 mr-2" /> New Story
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pipeline Columns */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          {stages.slice(0, 6).map(stage => (
            <div key={stage} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded ${stageMeta[stage].color} text-slate-200 flex items-center gap-1`}>
                    {stageMeta[stage].icon}
                    <span className="text-xs font-semibold">{stageMeta[stage].label}</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{itemsByStage[stage].length}</span>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {itemsByStage[stage].map(it => (
                  <div key={it.id} className={`p-3 rounded-lg border border-slate-600/30 bg-slate-700/20 hover:border-emerald-500/40 transition-colors ${activeItemId===it.id ? 'ring-2 ring-emerald-500/40' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <button className="text-left" onClick={() => setActiveItemId(it.id)}>
                          <p className="text-white font-semibold leading-tight line-clamp-2">{it.title}</p>
                        </button>
                        <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                          <span>{it.author}</span>
                          <span>•</span>
                          <span className="font-mono">{it.id}</span>
                          <span>•</span>
                          <span className={priorityColor(it.priority)}>{it.priority.toUpperCase()}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Updated {new Date(it.updatedAt).toLocaleTimeString()} • Lang: {it.language}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {it.embargoAt && (
                          <div className="px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-300 text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Embargo {new Date(it.embargoAt).toLocaleTimeString()}
                          </div>
                        )}
                        {it.redTeamFindings ? (
                          <div className="px-2 py-0.5 rounded bg-red-600/20 text-red-300 text-[10px]">RedTeam {it.redTeamFindings}</div>
                        ) : null}
                        {it.legalFlags && it.legalFlags.length > 0 && (
                          <div className="px-2 py-0.5 rounded bg-yellow-600/20 text-yellow-300 text-[10px] flex items-center gap-1">
                            <Gavel className="w-3 h-3" /> {it.legalFlags.length} legal
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {stage !== 'published' && (
                        <button
                          onClick={() => moveToStage(it.id, stages[stages.indexOf(stage)+1])}
                          className="px-2 py-1 bg-emerald-600/20 text-emerald-300 rounded text-xs hover:bg-emerald-600/30"
                        >
                          Move Next
                        </button>
                      )}
                      {stage !== 'draft' && (
                        <button
                          onClick={() => moveToStage(it.id, stages[stages.indexOf(stage)-1])}
                          className="px-2 py-1 bg-slate-600/20 text-slate-300 rounded text-xs hover:bg-slate-600/30"
                        >
                          Move Back
                        </button>
                      )}
                      {schedulable(it) && (
                        <button
                          onClick={() => moveToStage(it.id, 'scheduled')}
                          className="px-2 py-1 bg-indigo-600/20 text-indigo-300 rounded text-xs hover:bg-indigo-600/30"
                        >
                          Schedule
                        </button>
                      )}
                      {stage === 'scheduled' && (
                        <button
                          onClick={() => moveToStage(it.id, 'published')}
                          className="px-2 py-1 bg-green-600/20 text-green-300 rounded text-xs hover:bg-green-600/30"
                        >
                          Publish Now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Inspector / Compliance / Red Team */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Inspector</h3>
              <button
                onClick={() => setShowCompliance(s => !s)}
                className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300"
              >
                {showCompliance ? (
                  <span className="flex items-center"><ChevronDown className="w-3 h-3 mr-1"/>Hide</span>
                ) : (
                  <span className="flex items-center"><ChevronRight className="w-3 h-3 mr-1"/>Show</span>
                )}
              </button>
            </div>
            {!activeItem && (
              <p className="text-slate-400 text-sm mt-3">Select a story card to inspect details, compliance, legal flags, and comments.</p>
            )}
            {activeItem && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-white font-semibold">{activeItem.title}</p>
                  <p className="text-xs text-slate-400">{activeItem.author} • {activeItem.id}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className={`px-2 py-0.5 rounded ${stageMeta[activeItem.stage].color} flex items-center gap-1`}>{stageMeta[activeItem.stage].icon}<span>{stageMeta[activeItem.stage].label}</span></span>
                    {activeItem.embargoAt && (
                      <span className="px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-300 flex items-center gap-1"><Calendar className="w-3 h-3"/>Embargo {new Date(activeItem.embargoAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* PTI / Compliance checklist */}
                {showCompliance && (
                  <div className="bg-slate-700/30 rounded-lg border border-slate-600/30 p-3 space-y-2">
                    <h4 className="text-sm font-semibold mb-1 flex items-center"><Globe className="w-4 h-4 mr-2"/> PTI / Compliance</h4>
                    {(
                      [
                        ['ptiAttribution','PTI attribution and credit lines are correct'],
                        ['imageRights','Image/video rights verified; EXIF scrubbed'],
                        ['correctionsChecked','Corrections/captions validated'],
                        ['sourcesVerified','Sources verified; conflicting viewpoints represented'],
                        ['headlineNonDefamatory','Headline non-defamatory; no insinuations'],
                        ['balancedReporting','Balanced reporting; labels facts vs opinion']
                      ] as [keyof ComplianceChecklist, string][]
                    ).map(([key,label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="accent-emerald-500" checked={checklist[key]} onChange={() => toggleChecklist(key)} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Legal flags */}
                <div className="bg-slate-700/30 rounded-lg border border-slate-600/30 p-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center"><Gavel className="w-4 h-4 mr-2"/> Legal Review</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {(['defamation','privacy','sub_judice','copyright','sensitive'] as const).map(flag => (
                      <span key={flag} className={`px-2 py-1 rounded border ${activeItem.legalFlags?.includes(flag) ? 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>{flag.replace('_',' ')}</span>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="px-3 py-2 rounded bg-emerald-600/20 text-emerald-300 text-xs">Mark Resolved</button>
                    <button className="px-3 py-2 rounded bg-slate-600/20 text-slate-300 text-xs">Request Clarification</button>
                  </div>
                </div>

                {/* Comments */}
                <div className="bg-slate-700/30 rounded-lg border border-slate-600/30 p-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center"><MessageSquare className="w-4 h-4 mr-2"/> Review Comments</h4>
                  <div className="flex gap-2 mb-2">
                    <input
                      placeholder="Add a comment for this stage..."
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) {
                            addComment(v, activeItem.stage);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <button className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm">Send</button>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {comments.filter(c => c.itemId === activeItem.id).map(c => (
                      <div key={c.id} className="p-2 rounded bg-slate-800 border border-slate-700">
                        <div className="text-xs text-slate-400 mb-1">{c.author} • {c.role} • {new Date(c.createdAt).toLocaleString()} • {stageMeta[c.stage].label}</div>
                        <div className="text-sm text-white">{c.message}</div>
                      </div>
                    ))}
                    {comments.filter(c => c.itemId === activeItem.id).length === 0 && (
                      <p className="text-xs text-slate-500">No comments yet.</p>
                    )}
                  </div>
                </div>

                {/* Red Team */}
                {redTeamMode && (
                  <div className="bg-red-900/20 rounded-lg border border-red-700/40 p-3">
                    <h4 className="text-sm font-semibold mb-2 flex items-center text-red-300"><Flag className="w-4 h-4 mr-2"/> Red Team - Challenge Checks</h4>
                    <ul className="list-disc list-inside text-sm text-red-200 space-y-1">
                      {redTeamPrompts.map((p,idx) => <li key={idx}>{p}</li>)}
                    </ul>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="px-3 py-2 rounded bg-red-600/30 text-red-200 text-xs flex items-center justify-center"><TimerReset className="w-4 h-4 mr-2"/>Run Stress Test</button>
                      <button className="px-3 py-2 rounded bg-red-600/30 text-red-200 text-xs">Log Findings</button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Publish / Security Actions */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <h3 className="font-semibold mb-3">Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-2 rounded bg-indigo-600/20 text-indigo-300 text-sm flex items-center justify-center"><Calendar className="w-4 h-4 mr-2"/>Set Embargo</button>
              <button className="px-3 py-2 rounded bg-emerald-600/20 text-emerald-300 text-sm flex items-center justify-center"><CheckCircle className="w-4 h-4 mr-2"/>Approve</button>
              <button className="px-3 py-2 rounded bg-slate-600/20 text-slate-300 text-sm flex items-center justify-center"><Ban className="w-4 h-4 mr-2"/>Reject</button>
              <button className="px-3 py-2 rounded bg-yellow-600/20 text-yellow-300 text-sm flex items-center justify-center"><Lock className="w-4 h-4 mr-2"/>Lock Story</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorialWorkflowEngine;
