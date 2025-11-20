// 🔍 SEO Audit & Optimization Tools
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, Link as LinkIcon, FileText, BarChart3, ExternalLink, Plus, Trash2, Play } from 'lucide-react';

const HOST_BASE = (import.meta.env.VITE_ADMIN_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${HOST_BASE}/api`;

type Tab = 'audit' | 'redirects' | 'sitemap' | 'meta';

export default function SEOToolsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('audit');
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [redirects, setRedirects] = useState<any[]>([]);
  const [sitemapConfig, setSitemapConfig] = useState<any>(null);
  const [runningAudit, setRunningAudit] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'audit':
          const auditHistoryRes = await axios.get(`${API_BASE}/seo/audit/history?limit=1`);
          if (auditHistoryRes.data.audits?.length > 0) {
            setAuditData(auditHistoryRes.data.audits[0]);
          }
          break;
        case 'redirects':
          const redirectsRes = await axios.get(`${API_BASE}/seo/redirects`);
          setRedirects(redirectsRes.data.redirects || []);
          break;
        case 'sitemap':
          const sitemapRes = await axios.get(`${API_BASE}/seo/sitemap`);
          setSitemapConfig(sitemapRes.data.config || null);
          break;
      }
    } catch (error) {
      console.error('Failed to load SEO data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    setRunningAudit(true);
    try {
      const response = await axios.post(`${API_BASE}/seo/audit`, {
        url: 'https://newspulse.com',
        deep: false
      });
      setAuditData(response.data.audit);
    } catch (error) {
      console.error('Failed to run audit:', error);
    } finally {
      setRunningAudit(false);
    }
  };

  const addRedirect = async () => {
    const from = prompt('From URL:');
    const to = prompt('To URL:');
    if (!from || !to) return;

    try {
      await axios.post(`${API_BASE}/seo/redirects`, { from, to, type: '301' });
      loadData();
    } catch (error) {
      console.error('Failed to add redirect:', error);
    }
  };

  const deleteRedirect = async (id: string) => {
    if (!confirm('Delete this redirect?')) return;
    try {
      await axios.delete(`${API_BASE}/seo/redirects/${id}`);
      loadData();
    } catch (error) {
      console.error('Failed to delete redirect:', error);
    }
  };

  const generateSitemap = async () => {
    try {
      const response = await axios.post(`${API_BASE}/seo/sitemap/generate`);
      setSitemapConfig(response.data.config);
      alert('Sitemap generated successfully!');
    } catch (error) {
      console.error('Failed to generate sitemap:', error);
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'audit', label: 'SEO Audit', icon: BarChart3 },
    { id: 'redirects', label: 'Redirects', icon: LinkIcon },
    { id: 'sitemap', label: 'Sitemap', icon: FileText },
    { id: 'meta', label: 'Meta Tags', icon: Search }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
          <Search className="w-10 h-10 text-emerald-300" />
          SEO Tools & Audit
        </h1>
        <p className="text-emerald-200 mb-8">Optimize your site for search engines</p>

        <div className="flex gap-2 mb-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-emerald-800/50 text-emerald-200 hover:bg-emerald-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading && !auditData ? (
          <div className="bg-emerald-800/30 rounded-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-400 border-t-transparent mx-auto mb-4"></div>
            <p className="text-emerald-200">Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Latest SEO Audit</h2>
                    <button
                      onClick={runAudit}
                      disabled={runningAudit}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      {runningAudit ? 'Running...' : 'Run New Audit'}
                    </button>
                  </div>

                  {auditData ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-emerald-700/30 rounded-lg p-4">
                          <p className="text-emerald-300 mb-1">SEO Score</p>
                          <p className={`text-4xl font-bold ${
                            auditData.score >= 80 ? 'text-green-400' :
                            auditData.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                          }`}>{auditData.score}/100</p>
                        </div>
                        <div className="bg-emerald-700/30 rounded-lg p-4">
                          <p className="text-emerald-300 mb-1">Desktop Speed</p>
                          <p className="text-3xl font-bold text-white">{auditData.pageSpeed?.desktop || 0}</p>
                        </div>
                        <div className="bg-emerald-700/30 rounded-lg p-4">
                          <p className="text-emerald-300 mb-1">Mobile Speed</p>
                          <p className="text-3xl font-bold text-white">{auditData.pageSpeed?.mobile || 0}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-white mb-3">Issues Found</h3>
                        {auditData.issues?.map((issue: any, i: number) => (
                          <div key={i} className={`p-4 rounded-lg border ${
                            issue.severity === 'error' ? 'bg-red-500/10 border-red-500/30' :
                            issue.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                            'bg-blue-500/10 border-blue-500/30'
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <span className={`text-xs px-2 py-1 rounded uppercase font-semibold ${
                                  issue.severity === 'error' ? 'bg-red-500/20 text-red-300' :
                                  issue.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-blue-500/20 text-blue-300'
                                }`}>
                                  {issue.severity}
                                </span>
                              </div>
                              <span className="text-white font-semibold">{issue.count} issues</span>
                            </div>
                            <p className="text-white">{issue.message}</p>
                            {issue.urls && (
                              <div className="mt-2 text-sm text-emerald-300">
                                Affected pages: {issue.urls.slice(0, 3).join(', ')}
                                {issue.urls.length > 3 && ` +${issue.urls.length - 3} more`}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <BarChart3 className="w-16 h-16 text-emerald-600 mx-auto mb-4 opacity-50" />
                      <p className="text-emerald-300 mb-2">No audit data available</p>
                      <p className="text-sm text-emerald-400">Run your first SEO audit to get started</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'redirects' && (
              <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">URL Redirects ({redirects.length})</h2>
                  <button
                    onClick={addRedirect}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Redirect
                  </button>
                </div>

                <div className="space-y-3">
                  {redirects.map(redirect => (
                    <div key={redirect.id} className="flex items-center justify-between p-4 bg-emerald-700/30 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <code className="text-sm text-emerald-300">{redirect.from}</code>
                          <ExternalLink className="w-4 h-4 text-emerald-400" />
                          <code className="text-sm text-white">{redirect.to}</code>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-emerald-400">
                          <span className="px-2 py-0.5 bg-emerald-600/30 rounded">{redirect.type}</span>
                          <span>{redirect.hits} hits</span>
                          <span>{new Date(redirect.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteRedirect(redirect.id)}
                        className="text-red-400 hover:text-red-300 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'sitemap' && sitemapConfig && (
              <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">XML Sitemap</h2>
                  <button
                    onClick={generateSitemap}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Regenerate
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-emerald-700/30 rounded-lg p-4">
                    <p className="text-emerald-300 mb-1">Total URLs</p>
                    <p className="text-3xl font-bold text-white">{sitemapConfig.urlCount.toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-700/30 rounded-lg p-4">
                    <p className="text-emerald-300 mb-1">Update Frequency</p>
                    <p className="text-3xl font-bold text-white capitalize">{sitemapConfig.frequency}</p>
                  </div>
                </div>

                <div className="bg-emerald-700/30 rounded-lg p-4">
                  <p className="text-emerald-300 mb-2">Priority Settings</p>
                  <div className="space-y-2">
                    {Object.entries(sitemapConfig.priority).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-white capitalize">{key}</span>
                        <span className="text-emerald-400 font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-emerald-400 mt-4">
                  Last generated: {new Date(sitemapConfig.lastGenerated).toLocaleString()}
                </p>
              </div>
            )}

            {activeTab === 'meta' && (
              <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50">
                <h2 className="text-2xl font-bold text-white mb-6">Meta Tags Analyzer</h2>
                <div className="text-center py-12">
                  <Search className="w-16 h-16 text-emerald-600 mx-auto mb-4 opacity-50" />
                  <p className="text-emerald-300 mb-2">Meta tag analysis coming soon</p>
                  <p className="text-sm text-emerald-400">Analyze title tags, descriptions, and Open Graph data</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
