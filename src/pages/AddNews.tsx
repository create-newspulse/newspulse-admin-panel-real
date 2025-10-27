import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '@lib/api';
import toast from 'react-hot-toast';
import { useLockdownCheck } from '@hooks/useLockdownCheck';

// Reusable FormInput component for better organization and styling
interface FormInputProps {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  rows?: number; // For textarea type
}

const FormInput: React.FC<FormInputProps> = ({ label, type, placeholder, value, onChange, required, rows }) => (
  <div>
    {/* Screen reader only label for accessibility */}
    <label htmlFor={label} className="sr-only">
      {label}
    </label>
    {type === 'textarea' ? (
      <textarea
        id={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        required={required}
      />
    ) : (
      <input
        id={label}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        required={required}
      />
    )}
  </div>
);

const AddNews: React.FC = () => {
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [language, setLanguage] = useState<string>('English');
  const [loading, setLoading] = useState<boolean>(false);
  const [settings, setSettings] = useState<{ lockdown: boolean }>({ lockdown: false });

  // Use useCallback for memoizing the fetchSettings function
  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiClient.get('/settings/load');
      setSettings(res.data ?? res);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Fallback to default settings in case of an error
      setSettings({ lockdown: false });
    }
  }, []); // Empty dependency array means this function is created once

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]); // Depend on fetchSettings, which is memoized by useCallback

  useLockdownCheck(settings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trim inputs to ensure fields aren't just whitespace
    if (!title.trim() || !content.trim() || !category.trim()) {
      toast.error('❌ Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/news/add', {
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        language,
        aiScore: 0, // Default value
        pushSent: false, // Default value
      });

      const data = (res as any)?.data ?? res;
      if (data?.success === false) {
        // Use the message from the server if available, otherwise a generic error
        throw new Error(data?.message || 'Server rejected the request.');
      }

      toast.success('✅ News article added successfully!');
      // Clear form fields on successful submission
      setTitle('');
      setContent('');
      setCategory('');
      setLanguage('English');
    } catch (error: any) {
      console.error('Error adding news:', error);
      toast.error(`❌ Failed to add news: ${error.message || 'An unknown error occurred.'}`);
    } finally {
      setLoading(false);
    }
  };

  if (settings.lockdown) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400 font-semibold text-lg">
        🔒 News submission is currently locked by the administrator.
      </div>
    );
  }

  return (
    // ✅ CRITICAL UPDATE HERE: Added bg-white and dark:bg-slate-800 to this wrapper div
    // Removed min-h-screen from here, as it belongs to the global layout/root.
    <div className="max-w-3xl mx-auto p-6 text-gray-900 dark:text-white bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700">
      <h1 className="text-3xl font-extrabold mb-8 text-center text-blue-700 dark:text-blue-400">
        📝 Add New News Article
      </h1>

      <form
        onSubmit={handleSubmit}
        // The form itself already had good dark mode classes
        className="space-y-6" // bg and border handled by parent now, keep spacing/layout
      >
        <FormInput
          label="News Title"
          type="text"
          placeholder="Enter the news article title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <FormInput
          label="Content"
          type="textarea"
          placeholder="Write the detailed content of the news article here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          required
        />

        <FormInput
          label="Category"
          type="text"
          placeholder="e.g., Politics, Technology, Sports, Local"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />

        <div>
          <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Language:
          </label>
          <select
            id="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="English">🌐 English</option>
            <option value="Hindi">📰 Hindi</option>
            <option value="Gujarati">🗞 Gujarati</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition duration-300 ease-in-out flex items-center justify-center space-x-2"
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving News...
            </>
          ) : (
            <>
              ➕ Add News
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AddNews;