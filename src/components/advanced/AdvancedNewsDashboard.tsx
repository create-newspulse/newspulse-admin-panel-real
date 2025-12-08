// 📊 Advanced News Dashboard - Enterprise Grade
// Built with 50 years of newsroom experience

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Eye, DollarSign, Clock, 
  Zap, Activity, Bell, CheckCircle, XCircle,
  BarChart3, Settings, 
  Megaphone, Edit3, FileText, Camera
} from 'lucide-react';

interface DashboardStats {
  liveViews: number;
  todayRevenue: number;
  storiesPublished: number;
  pendingApprovals: number;
  breakingNews: number;
  adRevenue: number;
  socialShares: number;
  subscriberGrowth: number;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface PublishingQueueItem {
  id: string;
  title: string;
  author: string;
  category: string;
  scheduledAt: Date;
  status: 'scheduled' | 'processing' | 'published' | 'failed';
  priority: 'breaking' | 'high' | 'normal' | 'low';
}

const AdvancedNewsDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    liveViews: 12847,
    todayRevenue: 2450.75,
    storiesPublished: 23,
    pendingApprovals: 7,
    breakingNews: 2,
    adRevenue: 1876.30,
    socialShares: 8934,
    subscriberGrowth: 5.2
  });

  const [alerts, setAlerts] = useState<Alert[]>([
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

  const [publishingQueue] = useState<PublishingQueueItem[]>([
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

  const resolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'breaking': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'normal': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'processing': return <Activity className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'published': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                📰 News Pulse Command Center
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Real-time newsroom intelligence & publishing control
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Live</span>
              </div>
              <button className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Live Readers</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.liveViews.toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">+12% from yesterday</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Today's Revenue</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  ${stats.todayRevenue.toFixed(2)}
                </p>
                <p className="text-xs text-green-600 mt-1">+8.3% vs target</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Stories Published</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.storiesPublished}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Today</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Approvals</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pendingApprovals}</p>
                <p className="text-xs text-orange-600 mt-1">Requires attention</p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Publishing Queue */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    📅 Publishing Queue
                  </h3>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Next 3 hours
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {publishingQueue.map((item, index) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border-2 ${getPriorityColor(item.priority)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {getStatusIcon(item.status)}
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(item.priority)}`}>
                              {item.priority.toUpperCase()}
                            </span>
                          </div>
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                            {item.title}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                            <span>by {item.author}</span>
                            <span>•</span>
                            <span>{item.category}</span>
                            <span>•</span>
                            <span>{item.scheduledAt.toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button className="p-2 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-slate-600 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400">
                            <Zap className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Alerts & System Status */}
          <div className="space-y-6">
            {/* Real-time Alerts */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  🚨 Live Alerts
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {alerts.filter(alert => !alert.resolved).map((alert, index) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        alert.type === 'critical' ? 'bg-red-50 border-red-500 dark:bg-red-900/20' :
                        alert.type === 'warning' ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-900/20' :
                        'bg-blue-50 border-blue-500 dark:bg-blue-900/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                            {alert.title}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {alert.message}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                            {alert.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="p-1 text-slate-600 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Traffic Pulse */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  📈 Traffic Pulse
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Current Visitors</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{stats.liveViews.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Page Views/min</span>
                    <span className="font-semibold text-slate-900 dark:text-white">1,247</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Bounce Rate</span>
                    <span className="font-semibold text-green-600">23.4%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Avg. Session</span>
                    <span className="font-semibold text-slate-900 dark:text-white">4m 32s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  ⚡ Quick Actions
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3">
                  <button className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                    <Megaphone className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-medium">Breaking</span>
                  </button>
                  <button className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                    <Edit3 className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-medium">New Story</span>
                  </button>
                  <button className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                    <Camera className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-medium">Media</span>
                  </button>
                  <button className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                    <BarChart3 className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-medium">Analytics</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedNewsDashboard;