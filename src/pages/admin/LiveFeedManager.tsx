import React, { useEffect, useState } from 'react';
import apiClient from '@lib/api';

interface FeedSchedule {
  day: string;
  start: string;
  end: string;
  feed: string;
}

interface FeedConfig {
  activeFeed: string;
  customEvent: {
    enabled: boolean;
    title: string;
    url: string;
  };
  schedule: FeedSchedule[];
  autoSwitch: boolean;
  isFeedOn?: boolean;
}

const LiveFeedManager: React.FC = () => {
  const [config, setConfig] = useState<FeedConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const [feedRes, toggleRes] = await Promise.all([
          apiClient.get('/live-feed-config'),
          apiClient.get('/live-session'),
        ]);

        const feed = (feedRes as any)?.data ?? feedRes;
        const toggle = (toggleRes as any)?.data ?? toggleRes;
        setConfig({
          ...(feed || {}),
          isFeedOn: toggle?.isFeedOn ?? true,
        });
      } catch (error) {
        console.error('❌ Failed to load feed config:', error);
        alert('Failed to load feed configuration.');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await Promise.all([
        apiClient.post('/save-live-feed', config),
        apiClient.post('/live-session', {
          isFeedOn: config.isFeedOn,
          activeFeed: config.activeFeed,
        }),
      ]);
      alert('✅ Configuration saved successfully!');
    } catch (error) {
      console.error('❌ Save failed:', error);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">⏳ Loading Live Feed Manager...</p>;
  }

  if (!config) {
    return <p className="text-sm text-red-600">❌ Failed to load configuration.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">📡 Live Feed Manager</h1>

      {/* Live Feed Toggle */}
      <div className="mb-6">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={config.isFeedOn}
            onChange={(e) =>
              setConfig({ ...config, isFeedOn: e.target.checked })
            }
            className="mr-2"
          />
          🔘 Turn Live Feed {config.isFeedOn ? 'On' : 'Off'}
        </label>
      </div>

      {/* Active Feed Dropdown */}
      <div className="mb-6">
        <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-200">
          Currently Active Feed
        </label>
        <select
          value={config.activeFeed}
          onChange={(e) => setConfig({ ...config, activeFeed: e.target.value })}
          className="border rounded p-2 w-full dark:bg-slate-800 dark:border-slate-600"
        >
          <option value="sansad_tv">📺 Sansad TV</option>
          <option value="dd_news">📡 DD News</option>
          <option value="event">🎯 Custom Event</option>
        </select>
      </div>

      {/* Custom Event Fields */}
      <div className="mb-6">
        <h2 className="font-semibold text-lg mb-2">🎯 Custom Event Configuration</h2>
        <label className="block mb-1">Event Title:</label>
        <input
          type="text"
          value={config.customEvent.title}
          onChange={(e) =>
            setConfig({
              ...config,
              customEvent: { ...config.customEvent, title: e.target.value },
            })
          }
          className="border rounded p-2 w-full mb-2 dark:bg-slate-800 dark:border-slate-600"
        />
        <label className="block mb-1">Event URL:</label>
        <input
          type="text"
          value={config.customEvent.url}
          onChange={(e) =>
            setConfig({
              ...config,
              customEvent: { ...config.customEvent, url: e.target.value },
            })
          }
          className="border rounded p-2 w-full mb-2 dark:bg-slate-800 dark:border-slate-600"
        />
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={config.customEvent.enabled}
            onChange={(e) =>
              setConfig({
                ...config,
                customEvent: { ...config.customEvent, enabled: e.target.checked },
              })
            }
            className="mr-2"
          />
          Enable Custom Event
        </label>
      </div>

      {/* Auto Switch */}
      <div className="mb-6">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={config.autoSwitch}
            onChange={(e) => setConfig({ ...config, autoSwitch: e.target.checked })}
            className="mr-2"
          />
          🔁 Enable Auto Feed Switching (based on schedule)
        </label>
      </div>

      {/* Feed Schedule */}
      <div className="mb-6">
        <h2 className="font-semibold text-lg mb-2">🗓️ Feed Schedule Preview</h2>
        <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4 text-sm">
          {config.schedule.length > 0 ? (
            config.schedule.map((item, idx) => (
              <div key={idx} className="mb-2">
                <span className="font-medium">{item.day}:</span> {item.start} – {item.end} →{' '}
                <span className="text-blue-600">{item.feed}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic">No schedule found.</p>
          )}
          <p className="text-gray-500 text-xs mt-2 italic">* Edit support coming soon</p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${
          saving ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        💾 {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
};

export default LiveFeedManager;
