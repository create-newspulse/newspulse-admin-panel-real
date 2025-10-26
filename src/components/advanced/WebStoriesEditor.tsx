// 📱 AMP Web Stories Editor - Complete with Templates & Preview
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BookOpen, Plus, Edit, Trash2, Eye, Upload, Save, Layout,
  Image as ImageIcon, Type, Play, BarChart
} from 'lucide-react';

const API_BASE = 'http://localhost:3002/api';

type Story = {
  id: string;
  title: string;
  status: 'draft' | 'published';
  template: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  author: string;
  pages: any[];
  metadata: {
    views: number;
    completionRate: number;
    avgTimePerPage: number;
  };
};

type Template = {
  id: string;
  name: string;
  thumbnail: string;
  pages: number;
  style: {
    primaryColor: string;
    secondaryColor: string;
    font: string;
  };
};

export default function WebStoriesEditor() {
  const [stories, setStories] = useState<Story[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor' | 'analytics'>('list');

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
    } catch (error) {
      console.error('Failed to load stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const createStory = async (template: Template) => {
    const title = prompt('Story title:');
    if (!title) return;

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
    } catch (error) {
      console.error('Failed to create story:', error);
    }
  };

  const deleteStory = async (id: string) => {
    if (!confirm('Delete this story?')) return;

    try {
      await axios.delete(`${API_BASE}/web-stories/${id}`);
      setStories(stories.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete story:', error);
    }
  };

  const publishStory = async (id: string) => {
    try {
      const response = await axios.post(`${API_BASE}/web-stories/${id}/publish`);
      setStories(stories.map(s => s.id === id ? response.data.story : s));
      if (selectedStory?.id === id) setSelectedStory(response.data.story);
    } catch (error) {
      console.error('Failed to publish story:', error);
    }
  };

  const viewAnalytics = async (story: Story) => {
    setSelectedStory(story);
    setView('analytics');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
            <BookOpen className="w-10 h-10 text-purple-300" />
            Web Stories Editor
          </h1>
          <p className="text-purple-200">Create engaging AMP Web Stories with visual editor</p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              view === 'list'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-purple-800/50 text-purple-200 hover:bg-purple-700/50'
            }`}
          >
            All Stories
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Story
          </button>
        </div>

        {loading ? (
          <div className="bg-purple-800/30 rounded-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-400 border-t-transparent mx-auto mb-4"></div>
            <p className="text-purple-200">Loading stories...</p>
          </div>
        ) : (
          <>
            {/* Stories List */}
            {view === 'list' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stories.map(story => (
                  <div key={story.id} className="bg-purple-800/30 backdrop-blur-sm rounded-xl p-6 border border-purple-700/50 hover:border-purple-500 transition">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">{story.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          story.status === 'published'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {story.status.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteStory(story.id)}
                        className="text-red-400 hover:text-red-300 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-300">Views:</span>
                        <span className="text-white font-medium">{story.metadata.views.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-300">Completion:</span>
                        <span className="text-white font-medium">{story.metadata.completionRate}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-300">Pages:</span>
                        <span className="text-white font-medium">{story.pages.length}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedStory(story);
                          setView('editor');
                        }}
                        className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => viewAnalytics(story)}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <BarChart className="w-4 h-4" />
                        Analytics
                      </button>
                    </div>

                    {story.status === 'draft' && (
                      <button
                        onClick={() => publishStory(story.id)}
                        className="w-full mt-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Publish Story
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Story Editor */}
            {view === 'editor' && selectedStory && (
              <div className="bg-purple-800/30 backdrop-blur-sm rounded-xl p-6 border border-purple-700/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">{selectedStory.title}</h2>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      onClick={() => setView('list')}
                      className="px-4 py-2 bg-purple-800/50 hover:bg-purple-700/50 text-purple-200 rounded-lg font-medium transition"
                    >
                      Back
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {/* Sidebar - Tools */}
                  <div className="col-span-1 space-y-4">
                    <div className="bg-purple-700/30 rounded-lg p-4">
                      <h3 className="text-white font-semibold mb-3">Add Elements</h3>
                      <div className="space-y-2">
                        <button className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          Add Image
                        </button>
                        <button className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2">
                          <Type className="w-4 h-4" />
                          Add Text
                        </button>
                        <button className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2">
                          <Layout className="w-4 h-4" />
                          Add Page
                        </button>
                        <button className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          Upload Media
                        </button>
                      </div>
                    </div>

                    <div className="bg-purple-700/30 rounded-lg p-4">
                      <h3 className="text-white font-semibold mb-3">Pages</h3>
                      <div className="space-y-2">
                        {selectedStory.pages.length === 0 ? (
                          <p className="text-sm text-purple-300">No pages yet. Add your first page!</p>
                        ) : (
                          selectedStory.pages.map((page: any, i: number) => (
                            <div key={i} className="px-3 py-2 bg-purple-600/50 rounded text-white text-sm">
                              Page {i + 1}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Canvas - Preview */}
                  <div className="col-span-2">
                    <div className="bg-black rounded-lg aspect-[9/16] max-w-sm mx-auto relative overflow-hidden">
                      {selectedStory.pages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Layout className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
                            <p className="text-purple-300 mb-2">Empty Story</p>
                            <p className="text-sm text-purple-400">Add pages to begin</p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center">
                          <p className="text-white text-lg">Story Preview</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics View */}
            {view === 'analytics' && selectedStory && (
              <div className="space-y-6">
                <button
                  onClick={() => setView('list')}
                  className="px-4 py-2 bg-purple-800/50 hover:bg-purple-700/50 text-purple-200 rounded-lg font-medium transition"
                >
                  ← Back to Stories
                </button>

                <div className="bg-purple-800/30 backdrop-blur-sm rounded-xl p-6 border border-purple-700/50">
                  <h2 className="text-2xl font-bold text-white mb-6">{selectedStory.title} - Analytics</h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-purple-700/30 rounded-lg p-4">
                      <p className="text-purple-300 mb-1">Total Views</p>
                      <p className="text-3xl font-bold text-white">{selectedStory.metadata.views.toLocaleString()}</p>
                    </div>
                    <div className="bg-purple-700/30 rounded-lg p-4">
                      <p className="text-purple-300 mb-1">Completion Rate</p>
                      <p className="text-3xl font-bold text-white">{selectedStory.metadata.completionRate}%</p>
                    </div>
                    <div className="bg-purple-700/30 rounded-lg p-4">
                      <p className="text-purple-300 mb-1">Avg Time/Page</p>
                      <p className="text-3xl font-bold text-white">{selectedStory.metadata.avgTimePerPage}s</p>
                    </div>
                  </div>

                  <div className="bg-purple-700/30 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Traffic Sources</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-purple-300">Social Media</span>
                          <span className="text-white">45%</span>
                        </div>
                        <div className="w-full bg-purple-900/50 rounded-full h-2">
                          <div className="bg-purple-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-purple-300">Direct</span>
                          <span className="text-white">35%</span>
                        </div>
                        <div className="w-full bg-purple-900/50 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: '35%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-purple-300">Search</span>
                          <span className="text-white">20%</span>
                        </div>
                        <div className="w-full bg-purple-900/50 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '20%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Template Selection Modal */}
        {showTemplates && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-purple-900 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Choose a Template</h2>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-purple-300 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => createStory(template)}
                    className="bg-purple-800/50 rounded-lg p-4 hover:bg-purple-700/50 transition text-center border border-purple-700 hover:border-purple-500"
                  >
                    <div className="w-full aspect-[9/16] bg-purple-700/30 rounded mb-3 overflow-hidden">
                      <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-white font-medium">{template.name}</p>
                    <p className="text-xs text-purple-300 mt-1">{template.pages} pages</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
