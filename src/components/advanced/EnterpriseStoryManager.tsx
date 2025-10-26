// 📝 ENTERPRISE STORY MANAGER - Advanced News Editorial Suite
// Professional Writing Environment with Version Control & Multilingual Support

import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Calendar, Edit3, History, Lock, Unlock, Star,
  Bold, Italic, Underline, List, Link, Settings
} from 'lucide-react';

interface StoryVersion {
  id: string;
  title: string;
  content: string;
  timestamp: Date;
  author: string;
  status: 'draft' | 'review' | 'approved' | 'published';
  language: 'en' | 'hi' | 'gu';
  wordCount: number;
  changes: string[];
}

interface HeadlineTest {
  id: string;
  headlines: string[];
  metrics: {
    ctr: number;
    engagement: number;
    shareability: number;
  }[];
  winner?: number;
  status: 'running' | 'completed' | 'paused';
}

interface StoryMetadata {
  category: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'breaking';
  embargoDate?: Date;
  publishDate?: Date;
  location: string;
  byline: string;
  seoKeywords: string[];
}

const EnterpriseStoryManager: React.FC = () => {
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'hi' | 'gu'>('en');
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

  const [metadata, setMetadata] = useState<StoryMetadata>({
    category: 'Breaking News',
    tags: ['politics', 'government', 'policy'],
    priority: 'high',
    location: 'New Delhi',
    byline: 'NewsPulse Editorial Team',
    seoKeywords: ['breaking news', 'development', 'national']
  });

  const [versions, setVersions] = useState<StoryVersion[]>([
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

  const [headlineTests] = useState<HeadlineTest[]>([
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

  const [editorMode, setEditorMode] = useState<'write' | 'preview' | 'compare'>('write');
  const [autoSave] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [wordCount, setWordCount] = useState(245);
  const [readingTime, setReadingTime] = useState(2);
  const [isEmbargoed, setIsEmbargoed] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);

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

  const handleLanguageSwitch = (lang: 'en' | 'hi' | 'gu') => {
    setCurrentLanguage(lang);
  };

  const handleTitleChange = (value: string) => {
    setStoryTitle(prev => ({
      ...prev,
      [currentLanguage]: value
    }));
  };

  const handleContentChange = (value: string) => {
    setStoryContent(prev => ({
      ...prev,
      [currentLanguage]: value
    }));
  };

  const saveVersion = () => {
    const newVersion: StoryVersion = {
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

  const getLanguageDisplay = (lang: 'en' | 'hi' | 'gu') => {
    switch (lang) {
      case 'en': return { name: 'English', flag: '🇺🇸' };
      case 'hi': return { name: 'हिंदी', flag: '🇮🇳' };
      case 'gu': return { name: 'ગુજરાતી', flag: '🇮🇳' };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'breaking': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700';
      case 'low': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-600/10 rounded-lg">
                <Edit3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  📝 Enterprise Story Manager
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Professional Editorial Suite • Version Control • Multilingual
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Auto-save indicator */}
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                {autoSave && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
              </div>

              {/* Language tabs */}
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                {(['en', 'hi', 'gu'] as const).map((lang) => {
                  const display = getLanguageDisplay(lang);
                  return (
                    <button
                      key={lang}
                      onClick={() => handleLanguageSwitch(lang)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        currentLanguage === lang
                          ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="mr-1">{display.flag}</span>
                      {display.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-80 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-screen overflow-y-auto">
          {/* Story Metadata */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Story Details</h3>
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <Settings className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Priority
                </label>
                <select
                  value={metadata.priority}
                  onChange={(e) => setMetadata(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="breaking">🚨 Breaking News</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Category
                </label>
                <select
                  value={metadata.category}
                  onChange={(e) => setMetadata(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="Breaking News">Breaking News</option>
                  <option value="Politics">Politics</option>
                  <option value="Business">Business</option>
                  <option value="Technology">Technology</option>
                  <option value="Sports">Sports</option>
                  <option value="Entertainment">Entertainment</option>
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={metadata.location}
                  onChange={(e) => setMetadata(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="Story location"
                />
              </div>

              {/* Embargo */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Embargo
                </label>
                <button
                  onClick={() => setIsEmbargoed(!isEmbargoed)}
                  className={`p-2 rounded-lg transition-colors ${
                    isEmbargoed 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  {isEmbargoed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Story Stats */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{wordCount}</div>
                <div className="text-xs text-slate-500">Words</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{readingTime}</div>
                <div className="text-xs text-slate-500">Min Read</div>
              </div>
            </div>
          </div>

          {/* Version History */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Versions</h3>
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <History className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            
            {showVersions && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {versions.slice().reverse().map((version) => (
                  <div
                    key={version.id}
                    className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {version.title}
                      </span>
                      <span className="text-xs text-slate-500">
                        {version.wordCount} words
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {version.timestamp.toLocaleString()} • {version.author}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* A/B Headline Testing */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">A/B Testing</h3>
            {headlineTests.map((test) => (
              <div key={test.id} className="mb-4">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Headline Performance
                </div>
                {test.headlines.map((headline, index) => (
                  <div
                    key={index}
                    className={`p-2 mb-1 rounded text-xs ${
                      test.winner === index 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {headline}
                    {test.winner === index && <Star className="w-3 h-3 inline ml-1" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main Editor */}
        <div className="flex-1 flex flex-col">
          {/* Editor Toolbar */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Mode Switcher */}
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                  {(['write', 'preview', 'compare'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setEditorMode(mode)}
                      className={`px-3 py-2 rounded text-sm font-medium transition-all capitalize ${
                        editorMode === mode
                          ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Formatting Tools */}
                <div className="flex items-center space-x-2 border-l border-slate-200 dark:border-slate-600 pl-4">
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                    <Bold className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                    <Italic className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                    <Underline className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                    <List className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                    <Link className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={saveVersion}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Version</span>
                </button>
                
                <button
                  onClick={schedulePublishing}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Schedule</span>
                </button>
              </div>
            </div>
          </div>

          {/* Editor Content */}
          <div className="flex-1 p-6">
            {editorMode === 'write' && (
              <div className="max-w-4xl mx-auto">
                {/* Title Editor */}
                <div className="mb-6">
                  <input
                    type="text"
                    value={storyTitle[currentLanguage]}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full text-3xl font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none resize-none placeholder-slate-400"
                    placeholder="Enter story headline..."
                  />
                  <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${getPriorityColor(metadata.priority)}`}>
                    {metadata.priority.charAt(0).toUpperCase() + metadata.priority.slice(1)}
                  </div>
                </div>

                {/* Content Editor */}
                <textarea
                  ref={editorRef}
                  value={storyContent[currentLanguage]}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="w-full h-96 text-lg text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-600 rounded-lg p-4 resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Start writing your story..."
                />
              </div>
            )}

            {editorMode === 'preview' && (
              <div className="max-w-4xl mx-auto">
                <article className="prose prose-lg dark:prose-invert max-w-none">
                  <h1>{storyTitle[currentLanguage]}</h1>
                  <div className="text-slate-600 dark:text-slate-400 mb-6">
                    By {metadata.byline} • {metadata.location} • {readingTime} min read
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {storyContent[currentLanguage]}
                  </div>
                </article>
              </div>
            )}

            {editorMode === 'compare' && (
              <div className="grid grid-cols-3 gap-6 max-w-7xl mx-auto">
                {(['en', 'hi', 'gu'] as const).map((lang) => {
                  const display = getLanguageDisplay(lang);
                  return (
                    <div key={lang} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <span className="text-lg">{display.flag}</span>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{display.name}</h3>
                      </div>
                      <h4 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">
                        {storyTitle[lang]}
                      </h4>
                      <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                        {storyContent[lang].substring(0, 200)}...
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseStoryManager;