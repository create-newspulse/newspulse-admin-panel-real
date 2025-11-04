import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import apiClient from '@lib/api';
const LiveFeedManager = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const [feedRes, toggleRes] = await Promise.all([
                    apiClient.get('/live-feed-config'),
                    apiClient.get('/live-session'),
                ]);
                const feed = feedRes?.data ?? feedRes;
                const toggle = toggleRes?.data ?? toggleRes;
                setConfig({
                    ...(feed || {}),
                    isFeedOn: toggle?.isFeedOn ?? true,
                });
            }
            catch (error) {
                console.error('❌ Failed to load feed config:', error);
                alert('Failed to load feed configuration.');
            }
            finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);
    const handleSave = async () => {
        if (!config)
            return;
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
        }
        catch (error) {
            console.error('❌ Save failed:', error);
            alert('Failed to save settings.');
        }
        finally {
            setSaving(false);
        }
    };
    if (loading) {
        return _jsx("p", { className: "text-sm text-slate-500", children: "\u23F3 Loading Live Feed Manager..." });
    }
    if (!config) {
        return _jsx("p", { className: "text-sm text-red-600", children: "\u274C Failed to load configuration." });
    }
    return (_jsxs("div", { className: "max-w-3xl mx-auto py-10", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "\uD83D\uDCE1 Live Feed Manager" }), _jsx("div", { className: "mb-6", children: _jsxs("label", { className: "inline-flex items-center", children: [_jsx("input", { type: "checkbox", checked: config.isFeedOn, onChange: (e) => setConfig({ ...config, isFeedOn: e.target.checked }), className: "mr-2" }), "\uD83D\uDD18 Turn Live Feed ", config.isFeedOn ? 'On' : 'Off'] }) }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block font-semibold mb-1 text-gray-700 dark:text-gray-200", children: "Currently Active Feed" }), _jsxs("select", { value: config.activeFeed, onChange: (e) => setConfig({ ...config, activeFeed: e.target.value }), className: "border rounded p-2 w-full dark:bg-slate-800 dark:border-slate-600", children: [_jsx("option", { value: "sansad_tv", children: "\uD83D\uDCFA Sansad TV" }), _jsx("option", { value: "dd_news", children: "\uD83D\uDCE1 DD News" }), _jsx("option", { value: "event", children: "\uD83C\uDFAF Custom Event" })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "font-semibold text-lg mb-2", children: "\uD83C\uDFAF Custom Event Configuration" }), _jsx("label", { className: "block mb-1", children: "Event Title:" }), _jsx("input", { type: "text", value: config.customEvent.title, onChange: (e) => setConfig({
                            ...config,
                            customEvent: { ...config.customEvent, title: e.target.value },
                        }), className: "border rounded p-2 w-full mb-2 dark:bg-slate-800 dark:border-slate-600" }), _jsx("label", { className: "block mb-1", children: "Event URL:" }), _jsx("input", { type: "text", value: config.customEvent.url, onChange: (e) => setConfig({
                            ...config,
                            customEvent: { ...config.customEvent, url: e.target.value },
                        }), className: "border rounded p-2 w-full mb-2 dark:bg-slate-800 dark:border-slate-600" }), _jsxs("label", { className: "inline-flex items-center", children: [_jsx("input", { type: "checkbox", checked: config.customEvent.enabled, onChange: (e) => setConfig({
                                    ...config,
                                    customEvent: { ...config.customEvent, enabled: e.target.checked },
                                }), className: "mr-2" }), "Enable Custom Event"] })] }), _jsx("div", { className: "mb-6", children: _jsxs("label", { className: "inline-flex items-center", children: [_jsx("input", { type: "checkbox", checked: config.autoSwitch, onChange: (e) => setConfig({ ...config, autoSwitch: e.target.checked }), className: "mr-2" }), "\uD83D\uDD01 Enable Auto Feed Switching (based on schedule)"] }) }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "font-semibold text-lg mb-2", children: "\uD83D\uDDD3\uFE0F Feed Schedule Preview" }), _jsxs("div", { className: "bg-gray-100 dark:bg-slate-800 rounded-lg p-4 text-sm", children: [config.schedule.length > 0 ? (config.schedule.map((item, idx) => (_jsxs("div", { className: "mb-2", children: [_jsxs("span", { className: "font-medium", children: [item.day, ":"] }), " ", item.start, " \u2013 ", item.end, " \u2192", ' ', _jsx("span", { className: "text-blue-600", children: item.feed })] }, idx)))) : (_jsx("p", { className: "text-gray-500 italic", children: "No schedule found." })), _jsx("p", { className: "text-gray-500 text-xs mt-2 italic", children: "* Edit support coming soon" })] })] }), _jsxs("button", { onClick: handleSave, disabled: saving, className: `bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${saving ? 'opacity-60 cursor-not-allowed' : ''}`, children: ["\uD83D\uDCBE ", saving ? 'Saving...' : 'Save Settings'] })] }));
};
export default LiveFeedManager;
