import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ≡ƒöì SEO Audit & Optimization Tools
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, Link as LinkIcon, FileText, BarChart3, ExternalLink, Plus, Trash2, Play } from 'lucide-react';
const API_BASE = import.meta.env.VITE_API_URL || '/admin-api';
export default function SEOToolsDashboard() {
    const [activeTab, setActiveTab] = useState('audit');
    const [loading, setLoading] = useState(false);
    const [auditData, setAuditData] = useState(null);
    const [redirects, setRedirects] = useState([]);
    const [sitemapConfig, setSitemapConfig] = useState(null);
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
        }
        catch (error) {
            console.error('Failed to load SEO data:', error);
        }
        finally {
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
        }
        catch (error) {
            console.error('Failed to run audit:', error);
        }
        finally {
            setRunningAudit(false);
        }
    };
    const addRedirect = async () => {
        const from = prompt('From URL:');
        const to = prompt('To URL:');
        if (!from || !to)
            return;
        try {
            await axios.post(`${API_BASE}/seo/redirects`, { from, to, type: '301' });
            loadData();
        }
        catch (error) {
            console.error('Failed to add redirect:', error);
        }
    };
    const deleteRedirect = async (id) => {
        if (!confirm('Delete this redirect?'))
            return;
        try {
            await axios.delete(`${API_BASE}/seo/redirects/${id}`);
            loadData();
        }
        catch (error) {
            console.error('Failed to delete redirect:', error);
        }
    };
    const generateSitemap = async () => {
        try {
            const response = await axios.post(`${API_BASE}/seo/sitemap/generate`);
            setSitemapConfig(response.data.config);
            alert('Sitemap generated successfully!');
        }
        catch (error) {
            console.error('Failed to generate sitemap:', error);
        }
    };
    const tabs = [
        { id: 'audit', label: 'SEO Audit', icon: BarChart3 },
        { id: 'redirects', label: 'Redirects', icon: LinkIcon },
        { id: 'sitemap', label: 'Sitemap', icon: FileText },
        { id: 'meta', label: 'Meta Tags', icon: Search }
    ];
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-900 p-8", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("h1", { className: "text-4xl font-bold text-white flex items-center gap-3 mb-2", children: [_jsx(Search, { className: "w-10 h-10 text-emerald-300" }), "SEO Tools & Audit"] }), _jsx("p", { className: "text-emerald-200 mb-8", children: "Optimize your site for search engines" }), _jsx("div", { className: "flex gap-2 mb-6", children: tabs.map(tab => {
                        const Icon = tab.icon;
                        return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${activeTab === tab.id
                                ? 'bg-emerald-500 text-white shadow-lg'
                                : 'bg-emerald-800/50 text-emerald-200 hover:bg-emerald-700/50'}`, children: [_jsx(Icon, { className: "w-4 h-4" }), tab.label] }, tab.id));
                    }) }), loading && !auditData ? (_jsxs("div", { className: "bg-emerald-800/30 rounded-xl p-12 text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-4 border-emerald-400 border-t-transparent mx-auto mb-4" }), _jsx("p", { className: "text-emerald-200", children: "Loading..." })] })) : (_jsxs(_Fragment, { children: [activeTab === 'audit' && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-white", children: "Latest SEO Audit" }), _jsxs("button", { onClick: runAudit, disabled: runningAudit, className: "px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50", children: [_jsx(Play, { className: "w-4 h-4" }), runningAudit ? 'Running...' : 'Run New Audit'] })] }), auditData ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6", children: [_jsxs("div", { className: "bg-emerald-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-emerald-300 mb-1", children: "SEO Score" }), _jsxs("p", { className: `text-4xl font-bold ${auditData.score >= 80 ? 'text-green-400' :
                                                                    auditData.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`, children: [auditData.score, "/100"] })] }), _jsxs("div", { className: "bg-emerald-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-emerald-300 mb-1", children: "Desktop Speed" }), _jsx("p", { className: "text-3xl font-bold text-white", children: auditData.pageSpeed?.desktop || 0 })] }), _jsxs("div", { className: "bg-emerald-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-emerald-300 mb-1", children: "Mobile Speed" }), _jsx("p", { className: "text-3xl font-bold text-white", children: auditData.pageSpeed?.mobile || 0 })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-3", children: "Issues Found" }), auditData.issues?.map((issue, i) => (_jsxs("div", { className: `p-4 rounded-lg border ${issue.severity === 'error' ? 'bg-red-500/10 border-red-500/30' :
                                                            issue.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                                                                'bg-blue-500/10 border-blue-500/30'}`, children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("div", { children: _jsx("span", { className: `text-xs px-2 py-1 rounded uppercase font-semibold ${issue.severity === 'error' ? 'bg-red-500/20 text-red-300' :
                                                                                issue.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
                                                                                    'bg-blue-500/20 text-blue-300'}`, children: issue.severity }) }), _jsxs("span", { className: "text-white font-semibold", children: [issue.count, " issues"] })] }), _jsx("p", { className: "text-white", children: issue.message }), issue.urls && (_jsxs("div", { className: "mt-2 text-sm text-emerald-300", children: ["Affected pages: ", issue.urls.slice(0, 3).join(', '), issue.urls.length > 3 && ` +${issue.urls.length - 3} more`] }))] }, i)))] })] })) : (_jsxs("div", { className: "text-center py-12", children: [_jsx(BarChart3, { className: "w-16 h-16 text-emerald-600 mx-auto mb-4 opacity-50" }), _jsx("p", { className: "text-emerald-300 mb-2", children: "No audit data available" }), _jsx("p", { className: "text-sm text-emerald-400", children: "Run your first SEO audit to get started" })] }))] }) })), activeTab === 'redirects' && (_jsxs("div", { className: "bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("h2", { className: "text-2xl font-bold text-white", children: ["URL Redirects (", redirects.length, ")"] }), _jsxs("button", { onClick: addRedirect, className: "px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center gap-2", children: [_jsx(Plus, { className: "w-4 h-4" }), "Add Redirect"] })] }), _jsx("div", { className: "space-y-3", children: redirects.map(redirect => (_jsxs("div", { className: "flex items-center justify-between p-4 bg-emerald-700/30 rounded-lg", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-3 mb-1", children: [_jsx("code", { className: "text-sm text-emerald-300", children: redirect.from }), _jsx(ExternalLink, { className: "w-4 h-4 text-emerald-400" }), _jsx("code", { className: "text-sm text-white", children: redirect.to })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs text-emerald-400", children: [_jsx("span", { className: "px-2 py-0.5 bg-emerald-600/30 rounded", children: redirect.type }), _jsxs("span", { children: [redirect.hits, " hits"] }), _jsx("span", { children: new Date(redirect.createdAt).toLocaleDateString() })] })] }), _jsx("button", { onClick: () => deleteRedirect(redirect.id), className: "text-red-400 hover:text-red-300 transition", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, redirect.id))) })] })), activeTab === 'sitemap' && sitemapConfig && (_jsxs("div", { className: "bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-white", children: "XML Sitemap" }), _jsxs("button", { onClick: generateSitemap, className: "px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center gap-2", children: [_jsx(Play, { className: "w-4 h-4" }), "Regenerate"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-6", children: [_jsxs("div", { className: "bg-emerald-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-emerald-300 mb-1", children: "Total URLs" }), _jsx("p", { className: "text-3xl font-bold text-white", children: sitemapConfig.urlCount.toLocaleString() })] }), _jsxs("div", { className: "bg-emerald-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-emerald-300 mb-1", children: "Update Frequency" }), _jsx("p", { className: "text-3xl font-bold text-white capitalize", children: sitemapConfig.frequency })] })] }), _jsxs("div", { className: "bg-emerald-700/30 rounded-lg p-4", children: [_jsx("p", { className: "text-emerald-300 mb-2", children: "Priority Settings" }), _jsx("div", { className: "space-y-2", children: Object.entries(sitemapConfig.priority).map(([key, value]) => (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-white capitalize", children: key }), _jsx("span", { className: "text-emerald-400 font-mono", children: String(value) })] }, key))) })] }), _jsxs("p", { className: "text-xs text-emerald-400 mt-4", children: ["Last generated: ", new Date(sitemapConfig.lastGenerated).toLocaleString()] })] })), activeTab === 'meta' && (_jsxs("div", { className: "bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50", children: [_jsx("h2", { className: "text-2xl font-bold text-white mb-6", children: "Meta Tags Analyzer" }), _jsxs("div", { className: "text-center py-12", children: [_jsx(Search, { className: "w-16 h-16 text-emerald-600 mx-auto mb-4 opacity-50" }), _jsx("p", { className: "text-emerald-300 mb-2", children: "Meta tag analysis coming soon" }), _jsx("p", { className: "text-sm text-emerald-400", children: "Analyze title tags, descriptions, and Open Graph data" })] })] }))] }))] }) }));
}
