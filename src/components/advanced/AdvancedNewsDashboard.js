import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 📊 Advanced News Dashboard - Enterprise Grade
// Built with 50 years of newsroom experience
import { useState, useEffect } from 'react';
import { AlertTriangle, Eye, DollarSign, Clock, Zap, Activity, Bell, CheckCircle, XCircle, BarChart3, Settings, Megaphone, Edit3, FileText, Camera } from 'lucide-react';
const AdvancedNewsDashboard = () => {
    const [stats, setStats] = useState({
        liveViews: 12847,
        todayRevenue: 2450.75,
        storiesPublished: 23,
        pendingApprovals: 7,
        breakingNews: 2,
        adRevenue: 1876.30,
        socialShares: 8934,
        subscriberGrowth: 5.2
    });
    const [alerts, setAlerts] = useState([
        {
            id: '1',
            type: 'critical',
            title: 'High Traffic Surge',
            message: 'Breaking news story causing 300% traffic spike. CDN auto-scaling activated.',
            timestamp: new Date(Date.now() - 300000),
            resolved: false
        },
        {
            id: '2',
            type: 'warning',
            title: 'Pending Legal Review',
            message: '3 stories require legal compliance check before publication.',
            timestamp: new Date(Date.now() - 1800000),
            resolved: false
        },
        {
            id: '3',
            type: 'info',
            title: 'AI Fact Check Complete',
            message: 'Daily fact-checking sweep completed. 2 flags resolved.',
            timestamp: new Date(Date.now() - 3600000),
            resolved: true
        }
    ]);
    const [publishingQueue] = useState([
        {
            id: '1',
            title: 'Election Results: Final Vote Count Underway',
            author: 'Rajesh Kumar',
            category: 'Politics',
            scheduledAt: new Date(Date.now() + 900000),
            status: 'scheduled',
            priority: 'breaking'
        },
        {
            id: '2',
            title: 'Cricket World Cup: India vs Australia Preview',
            author: 'Priya Sharma',
            category: 'Sports',
            scheduledAt: new Date(Date.now() + 1800000),
            status: 'processing',
            priority: 'high'
        },
        {
            id: '3',
            title: 'Market Watch: Sensex Hits New High',
            author: 'Amit Gupta',
            category: 'Business',
            scheduledAt: new Date(Date.now() + 3600000),
            status: 'scheduled',
            priority: 'normal'
        }
    ]);
    // Real-time updates simulation
    useEffect(() => {
        const interval = setInterval(() => {
            setStats(prev => ({
                ...prev,
                liveViews: prev.liveViews + Math.floor(Math.random() * 50),
                todayRevenue: prev.todayRevenue + (Math.random() * 10)
            }));
        }, 5000);
        return () => clearInterval(interval);
    }, []);
    const resolveAlert = (alertId) => {
        setAlerts(prev => prev.map(alert => alert.id === alertId ? { ...alert, resolved: true } : alert));
    };
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'breaking': return 'text-red-600 bg-red-50 border-red-200';
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'normal': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'scheduled': return _jsx(Clock, { className: "w-4 h-4 text-blue-500" });
            case 'processing': return _jsx(Activity, { className: "w-4 h-4 text-yellow-500 animate-spin" });
            case 'published': return _jsx(CheckCircle, { className: "w-4 h-4 text-green-500" });
            case 'failed': return _jsx(XCircle, { className: "w-4 h-4 text-red-500" });
            default: return _jsx(Clock, { className: "w-4 h-4 text-gray-500" });
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800", children: [_jsx("div", { className: "bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700", children: _jsx("div", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-slate-900 dark:text-white", children: "\uD83D\uDCF0 News Pulse Command Center" }), _jsx("p", { className: "text-slate-600 dark:text-slate-400 mt-1", children: "Real-time newsroom intelligence & publishing control" })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-3 h-3 bg-green-500 rounded-full animate-pulse" }), _jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Live" })] }), _jsx("button", { className: "p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white", children: _jsx(Bell, { className: "w-5 h-5" }) }), _jsx("button", { className: "p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white", children: _jsx(Settings, { className: "w-5 h-5" }) })] })] }) }) }), _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: [_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-600 dark:text-slate-400", children: "Live Readers" }), _jsx("p", { className: "text-2xl font-bold text-slate-900 dark:text-white", children: stats.liveViews.toLocaleString() }), _jsx("p", { className: "text-xs text-green-600 mt-1", children: "+12% from yesterday" })] }), _jsx("div", { className: "p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg", children: _jsx(Eye, { className: "w-6 h-6 text-blue-600 dark:text-blue-400" }) })] }) }), _jsx("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-600 dark:text-slate-400", children: "Today's Revenue" }), _jsxs("p", { className: "text-2xl font-bold text-slate-900 dark:text-white", children: ["$", stats.todayRevenue.toFixed(2)] }), _jsx("p", { className: "text-xs text-green-600 mt-1", children: "+8.3% vs target" })] }), _jsx("div", { className: "p-3 bg-green-50 dark:bg-green-900/20 rounded-lg", children: _jsx(DollarSign, { className: "w-6 h-6 text-green-600 dark:text-green-400" }) })] }) }), _jsx("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-600 dark:text-slate-400", children: "Stories Published" }), _jsx("p", { className: "text-2xl font-bold text-slate-900 dark:text-white", children: stats.storiesPublished }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400 mt-1", children: "Today" })] }), _jsx("div", { className: "p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg", children: _jsx(FileText, { className: "w-6 h-6 text-purple-600 dark:text-purple-400" }) })] }) }), _jsx("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-600 dark:text-slate-400", children: "Pending Approvals" }), _jsx("p", { className: "text-2xl font-bold text-slate-900 dark:text-white", children: stats.pendingApprovals }), _jsx("p", { className: "text-xs text-orange-600 mt-1", children: "Requires attention" })] }), _jsx("div", { className: "p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg", children: _jsx(AlertTriangle, { className: "w-6 h-6 text-orange-600 dark:text-orange-400" }) })] }) })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [_jsx("div", { className: "lg:col-span-2", children: _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "p-6 border-b border-slate-200 dark:border-slate-700", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: "\uD83D\uDCC5 Publishing Queue" }), _jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Next 3 hours" })] }) }), _jsx("div", { className: "p-6", children: _jsx("div", { className: "space-y-4", children: publishingQueue.map((item, index) => (_jsx("div", { className: `p-4 rounded-lg border-2 ${getPriorityColor(item.priority)}`, children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [getStatusIcon(item.status), _jsx("span", { className: `text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(item.priority)}`, children: item.priority.toUpperCase() })] }), _jsx("h4", { className: "font-semibold text-slate-900 dark:text-white mb-1", children: item.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400", children: [_jsxs("span", { children: ["by ", item.author] }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: item.category }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: item.scheduledAt.toLocaleTimeString() })] })] }), _jsxs("div", { className: "flex space-x-2 ml-4", children: [_jsx("button", { className: "p-2 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400", children: _jsx(Edit3, { className: "w-4 h-4" }) }), _jsx("button", { className: "p-2 text-slate-600 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400", children: _jsx(Zap, { className: "w-4 h-4" }) })] })] }) }, item.id))) }) })] }) }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "p-6 border-b border-slate-200 dark:border-slate-700", children: _jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: "\uD83D\uDEA8 Live Alerts" }) }), _jsx("div", { className: "p-6", children: _jsx("div", { className: "space-y-3", children: alerts.filter(alert => !alert.resolved).map((alert, index) => (_jsx("div", { className: `p-4 rounded-lg border-l-4 ${alert.type === 'critical' ? 'bg-red-50 border-red-500 dark:bg-red-900/20' :
                                                            alert.type === 'warning' ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-900/20' :
                                                                'bg-blue-50 border-blue-500 dark:bg-blue-900/20'}`, children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-semibold text-slate-900 dark:text-white text-sm", children: alert.title }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400 mt-1", children: alert.message }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-500 mt-2", children: alert.timestamp.toLocaleTimeString() })] }), _jsx("button", { onClick: () => resolveAlert(alert.id), className: "p-1 text-slate-600 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400", children: _jsx(CheckCircle, { className: "w-4 h-4" }) })] }) }, alert.id))) }) })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "p-6 border-b border-slate-200 dark:border-slate-700", children: _jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: "\uD83D\uDCC8 Traffic Pulse" }) }), _jsx("div", { className: "p-6", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Current Visitors" }), _jsx("span", { className: "font-semibold text-slate-900 dark:text-white", children: stats.liveViews.toLocaleString() })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Page Views/min" }), _jsx("span", { className: "font-semibold text-slate-900 dark:text-white", children: "1,247" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Bounce Rate" }), _jsx("span", { className: "font-semibold text-green-600", children: "23.4%" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Avg. Session" }), _jsx("span", { className: "font-semibold text-slate-900 dark:text-white", children: "4m 32s" })] })] }) })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "p-6 border-b border-slate-200 dark:border-slate-700", children: _jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: "\u26A1 Quick Actions" }) }), _jsx("div", { className: "p-6", children: _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("button", { className: "p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors", children: [_jsx(Megaphone, { className: "w-5 h-5 mx-auto mb-1" }), _jsx("span", { className: "text-xs font-medium", children: "Breaking" })] }), _jsxs("button", { className: "p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors", children: [_jsx(Edit3, { className: "w-5 h-5 mx-auto mb-1" }), _jsx("span", { className: "text-xs font-medium", children: "New Story" })] }), _jsxs("button", { className: "p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors", children: [_jsx(Camera, { className: "w-5 h-5 mx-auto mb-1" }), _jsx("span", { className: "text-xs font-medium", children: "Media" })] }), _jsxs("button", { className: "p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors", children: [_jsx(BarChart3, { className: "w-5 h-5 mx-auto mb-1" }), _jsx("span", { className: "text-xs font-medium", children: "Analytics" })] })] }) })] })] })] })] })] }));
};
export default AdvancedNewsDashboard;
