import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 📝 ENTERPRISE STORY MANAGER - Advanced News Editorial Suite
// Professional Writing Environment with Version Control & Multilingual Support
import { useState, useEffect, useRef } from 'react';
import { Save, Calendar, Edit3, History, Lock, Unlock, Star, Bold, Italic, Underline, List, Link, Settings } from 'lucide-react';
const EnterpriseStoryManager = () => {
    const [currentLanguage, setCurrentLanguage] = useState('en');
    const [storyTitle, setStoryTitle] = useState({
        en: 'Breaking: Major Development Unfolds',
        hi: 'ब्रेकिंग: महत्वपूर्ण विकास का खुलासा',
        gu: 'બ્રેકિંગ: મુખ્ય વિકાસ સામે આવ્યો'
    });
    const [storyContent, setStoryContent] = useState({
        en: 'In a significant development that has captured national attention...',
        hi: 'एक महत्वपूर्ण विकास में जिसने राष्ट्रीय ध्यान आकर्षित किया है...',
        gu: 'એક મહત્વપૂર્ણ વિકાસમાં જેણે રાષ્ટ્રીય ધ્યાન આકર્ષ્યું છે...'
    });
    const [metadata, setMetadata] = useState({
        category: 'Breaking News',
        tags: ['politics', 'government', 'policy'],
        priority: 'high',
        location: 'New Delhi',
        byline: 'NewsPulse Editorial Team',
        seoKeywords: ['breaking news', 'development', 'national']
    });
    const [versions, setVersions] = useState([
        {
            id: '1',
            title: 'Initial Draft',
            content: storyContent[currentLanguage],
            timestamp: new Date(Date.now() - 3600000),
            author: 'Editor1',
            status: 'draft',
            language: currentLanguage,
            wordCount: 245,
            changes: ['Initial creation']
        }
    ]);
    const [headlineTests] = useState([
        {
            id: '1',
            headlines: [
                'Breaking: Major Development Unfolds',
                'Exclusive: Significant News Emerges',
                'Alert: Important Update Revealed'
            ],
            metrics: [
                { ctr: 4.2, engagement: 78, shareability: 85 },
                { ctr: 3.8, engagement: 82, shareability: 79 },
                { ctr: 5.1, engagement: 74, shareability: 88 }
            ],
            winner: 2,
            status: 'completed'
        }
    ]);
    const [editorMode, setEditorMode] = useState('write');
    const [autoSave] = useState(true);
    const [lastSaved, setLastSaved] = useState(new Date());
    const [wordCount, setWordCount] = useState(245);
    const [readingTime, setReadingTime] = useState(2);
    const [isEmbargoed, setIsEmbargoed] = useState(false);
    const [showVersions, setShowVersions] = useState(false);
    const [showMetadata, setShowMetadata] = useState(false);
    const editorRef = useRef(null);
    // Auto-save functionality
    useEffect(() => {
        if (autoSave) {
            const saveTimer = setInterval(() => {
                handleAutoSave();
            }, 30000); // Auto-save every 30 seconds
            return () => clearInterval(saveTimer);
        }
        return undefined;
    }, [autoSave, storyContent, storyTitle]);
    // Word count and reading time calculation
    useEffect(() => {
        const content = storyContent[currentLanguage];
        const words = content.trim().split(/\s+/).length;
        setWordCount(words);
        setReadingTime(Math.ceil(words / 200)); // 200 words per minute average
    }, [storyContent, currentLanguage]);
    const handleAutoSave = () => {
        setLastSaved(new Date());
        // In real implementation, this would save to backend
        console.log('Auto-saved at:', new Date().toLocaleTimeString());
    };
    const handleLanguageSwitch = (lang) => {
        setCurrentLanguage(lang);
    };
    const handleTitleChange = (value) => {
        setStoryTitle(prev => ({
            ...prev,
            [currentLanguage]: value
        }));
    };
    const handleContentChange = (value) => {
        setStoryContent(prev => ({
            ...prev,
            [currentLanguage]: value
        }));
    };
    const saveVersion = () => {
        const newVersion = {
            id: Date.now().toString(),
            title: `Version ${versions.length + 1}`,
            content: storyContent[currentLanguage],
            timestamp: new Date(),
            author: 'Current User',
            status: 'draft',
            language: currentLanguage,
            wordCount,
            changes: ['Manual save']
        };
        setVersions(prev => [...prev, newVersion]);
        setLastSaved(new Date());
    };
    const schedulePublishing = () => {
        // Implementation for scheduled publishing
        console.log('Scheduling publication...');
    };
    const getLanguageDisplay = (lang) => {
        switch (lang) {
            case 'en': return { name: 'English', flag: '🇺🇸' };
            case 'hi': return { name: 'हिंदी', flag: '🇮🇳' };
            case 'gu': return { name: 'ગુજરાતી', flag: '🇮🇳' };
        }
    };
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'breaking': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700';
            case 'low': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
            default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700';
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800", children: [_jsx("div", { className: "bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm", children: _jsx("div", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "p-2 bg-blue-600/10 rounded-lg", children: _jsx(Edit3, { className: "w-6 h-6 text-blue-600 dark:text-blue-400" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-900 dark:text-white", children: "\uD83D\uDCDD Enterprise Story Manager" }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: "Professional Editorial Suite \u2022 Version Control \u2022 Multilingual" })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: "flex items-center space-x-2 text-sm text-slate-500", children: [autoSave && _jsx("div", { className: "w-2 h-2 bg-green-500 rounded-full animate-pulse" }), _jsxs("span", { children: ["Last saved: ", lastSaved.toLocaleTimeString()] })] }), _jsx("div", { className: "flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1", children: ['en', 'hi', 'gu'].map((lang) => {
                                            const display = getLanguageDisplay(lang);
                                            return (_jsxs("button", { onClick: () => handleLanguageSwitch(lang), className: `px-3 py-2 rounded-md text-sm font-medium transition-all ${currentLanguage === lang
                                                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`, children: [_jsx("span", { className: "mr-1", children: display.flag }), display.name] }, lang));
                                        }) })] })] }) }) }), _jsxs("div", { className: "flex", children: [_jsxs("div", { className: "w-80 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-screen overflow-y-auto", children: [_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "font-semibold text-slate-900 dark:text-white", children: "Story Details" }), _jsx("button", { onClick: () => setShowMetadata(!showMetadata), className: "p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded", children: _jsx(Settings, { className: "w-4 h-4 text-slate-500" }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2", children: "Priority" }), _jsxs("select", { value: metadata.priority, onChange: (e) => setMetadata(prev => ({ ...prev, priority: e.target.value })), className: "w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white", children: [_jsx("option", { value: "low", children: "Low Priority" }), _jsx("option", { value: "medium", children: "Medium Priority" }), _jsx("option", { value: "high", children: "High Priority" }), _jsx("option", { value: "breaking", children: "\uD83D\uDEA8 Breaking News" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2", children: "Category" }), _jsxs("select", { value: metadata.category, onChange: (e) => setMetadata(prev => ({ ...prev, category: e.target.value })), className: "w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white", children: [_jsx("option", { value: "Breaking News", children: "Breaking News" }), _jsx("option", { value: "Politics", children: "Politics" }), _jsx("option", { value: "Business", children: "Business" }), _jsx("option", { value: "Technology", children: "Technology" }), _jsx("option", { value: "Sports", children: "Sports" }), _jsx("option", { value: "Entertainment", children: "Entertainment" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2", children: "Location" }), _jsx("input", { type: "text", value: metadata.location, onChange: (e) => setMetadata(prev => ({ ...prev, location: e.target.value })), className: "w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white", placeholder: "Story location" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("label", { className: "text-sm font-medium text-slate-700 dark:text-slate-300", children: "Embargo" }), _jsx("button", { onClick: () => setIsEmbargoed(!isEmbargoed), className: `p-2 rounded-lg transition-colors ${isEmbargoed
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`, children: isEmbargoed ? _jsx(Lock, { className: "w-4 h-4" }) : _jsx(Unlock, { className: "w-4 h-4" }) })] })] })] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-200 dark:border-slate-700", children: [_jsx("h3", { className: "font-semibold text-slate-900 dark:text-white mb-4", children: "Stats" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600 dark:text-blue-400", children: wordCount }), _jsx("div", { className: "text-xs text-slate-500", children: "Words" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-green-600 dark:text-green-400", children: readingTime }), _jsx("div", { className: "text-xs text-slate-500", children: "Min Read" })] })] })] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-200 dark:border-slate-700", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "font-semibold text-slate-900 dark:text-white", children: "Versions" }), _jsx("button", { onClick: () => setShowVersions(!showVersions), className: "p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded", children: _jsx(History, { className: "w-4 h-4 text-slate-500" }) })] }), showVersions && (_jsx("div", { className: "space-y-2 max-h-64 overflow-y-auto", children: versions.slice().reverse().map((version) => (_jsxs("div", { className: "p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-sm font-medium text-slate-900 dark:text-white", children: version.title }), _jsxs("span", { className: "text-xs text-slate-500", children: [version.wordCount, " words"] })] }), _jsxs("div", { className: "text-xs text-slate-500", children: [version.timestamp.toLocaleString(), " \u2022 ", version.author] })] }, version.id))) }))] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-200 dark:border-slate-700", children: [_jsx("h3", { className: "font-semibold text-slate-900 dark:text-white mb-4", children: "A/B Testing" }), headlineTests.map((test) => (_jsxs("div", { className: "mb-4", children: [_jsx("div", { className: "text-sm text-slate-600 dark:text-slate-400 mb-2", children: "Headline Performance" }), test.headlines.map((headline, index) => (_jsxs("div", { className: `p-2 mb-1 rounded text-xs ${test.winner === index
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`, children: [headline, test.winner === index && _jsx(Star, { className: "w-3 h-3 inline ml-1" })] }, index)))] }, test.id)))] })] }), _jsxs("div", { className: "flex-1 flex flex-col", children: [_jsx("div", { className: "bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1", children: ['write', 'preview', 'compare'].map((mode) => (_jsx("button", { onClick: () => setEditorMode(mode), className: `px-3 py-2 rounded text-sm font-medium transition-all capitalize ${editorMode === mode
                                                            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`, children: mode }, mode))) }), _jsxs("div", { className: "flex items-center space-x-2 border-l border-slate-200 dark:border-slate-600 pl-4", children: [_jsx("button", { className: "p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded", children: _jsx(Bold, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" }) }), _jsx("button", { className: "p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded", children: _jsx(Italic, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" }) }), _jsx("button", { className: "p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded", children: _jsx(Underline, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" }) }), _jsx("button", { className: "p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded", children: _jsx(List, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" }) }), _jsx("button", { className: "p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded", children: _jsx(Link, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" }) })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("button", { onClick: saveVersion, className: "flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors", children: [_jsx(Save, { className: "w-4 h-4" }), _jsx("span", { children: "Save Version" })] }), _jsxs("button", { onClick: schedulePublishing, className: "flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors", children: [_jsx(Calendar, { className: "w-4 h-4" }), _jsx("span", { children: "Schedule" })] })] })] }) }), _jsxs("div", { className: "flex-1 p-6", children: [editorMode === 'write' && (_jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsx("input", { type: "text", value: storyTitle[currentLanguage], onChange: (e) => handleTitleChange(e.target.value), className: "w-full text-3xl font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none resize-none placeholder-slate-400", placeholder: "Enter story headline..." }), _jsx("div", { className: `inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${getPriorityColor(metadata.priority)}`, children: metadata.priority.charAt(0).toUpperCase() + metadata.priority.slice(1) })] }), _jsx("textarea", { ref: editorRef, value: storyContent[currentLanguage], onChange: (e) => handleContentChange(e.target.value), className: "w-full h-96 text-lg text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-600 rounded-lg p-4 resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "Start writing your story..." })] })), editorMode === 'preview' && (_jsx("div", { className: "max-w-4xl mx-auto", children: _jsxs("article", { className: "prose prose-lg dark:prose-invert max-w-none", children: [_jsx("h1", { children: storyTitle[currentLanguage] }), _jsxs("div", { className: "text-slate-600 dark:text-slate-400 mb-6", children: ["By ", metadata.byline, " \u2022 ", metadata.location, " \u2022 ", readingTime, " min read"] }), _jsx("div", { className: "whitespace-pre-wrap leading-relaxed", children: storyContent[currentLanguage] })] }) })), editorMode === 'compare' && (_jsx("div", { className: "grid grid-cols-3 gap-6 max-w-7xl mx-auto", children: ['en', 'hi', 'gu'].map((lang) => {
                                            const display = getLanguageDisplay(lang);
                                            return (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-4", children: [_jsx("span", { className: "text-lg", children: display.flag }), _jsx("h3", { className: "font-semibold text-slate-900 dark:text-white", children: display.name })] }), _jsx("h4", { className: "font-bold text-lg mb-2 text-slate-900 dark:text-white", children: storyTitle[lang] }), _jsxs("div", { className: "text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap", children: [storyContent[lang].substring(0, 200), "..."] })] }, lang));
                                        }) }))] })] })] })] }));
};
export default EnterpriseStoryManager;
