import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import apiClient from '@lib/api';
import toast from 'react-hot-toast';
import { useLockdownCheck } from '@hooks/useLockdownCheck';
const FormInput = ({ label, type, placeholder, value, onChange, required, rows }) => (_jsxs("div", { children: [_jsx("label", { htmlFor: label, className: "sr-only", children: label }), type === 'textarea' ? (_jsx("textarea", { id: label, placeholder: placeholder, value: value, onChange: onChange, rows: rows, className: "w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white", required: required })) : (_jsx("input", { id: label, type: type, placeholder: placeholder, value: value, onChange: onChange, className: "w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white", required: required }))] }));
const AddNews = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('');
    const [language, setLanguage] = useState('English');
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({ lockdown: false });
    // Use useCallback for memoizing the fetchSettings function
    const fetchSettings = useCallback(async () => {
        try {
            const res = await apiClient.get('/settings/load');
            setSettings(res.data ?? res);
        }
        catch (error) {
            console.error('Failed to load settings:', error);
            // Fallback to default settings in case of an error
            setSettings({ lockdown: false });
        }
    }, []); // Empty dependency array means this function is created once
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]); // Depend on fetchSettings, which is memoized by useCallback
    useLockdownCheck(settings);
    const handleSubmit = async (e) => {
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
            const data = res?.data ?? res;
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
        }
        catch (error) {
            console.error('Error adding news:', error);
            toast.error(`❌ Failed to add news: ${error.message || 'An unknown error occurred.'}`);
        }
        finally {
            setLoading(false);
        }
    };
    if (settings.lockdown) {
        return (_jsx("div", { className: "p-6 text-center text-red-600 dark:text-red-400 font-semibold text-lg", children: "\uD83D\uDD12 News submission is currently locked by the administrator." }));
    }
    return (
    // ✅ CRITICAL UPDATE HERE: Added bg-white and dark:bg-slate-800 to this wrapper div
    // Removed min-h-screen from here, as it belongs to the global layout/root.
    _jsxs("div", { className: "max-w-3xl mx-auto p-6 text-gray-900 dark:text-white bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700", children: [_jsx("h1", { className: "text-3xl font-extrabold mb-8 text-center text-blue-700 dark:text-blue-400", children: "\uD83D\uDCDD Add New News Article" }), _jsxs("form", { onSubmit: handleSubmit, 
                // The form itself already had good dark mode classes
                className: "space-y-6" // bg and border handled by parent now, keep spacing/layout
                , children: [_jsx(FormInput, { label: "News Title", type: "text", placeholder: "Enter the news article title", value: title, onChange: (e) => setTitle(e.target.value), required: true }), _jsx(FormInput, { label: "Content", type: "textarea", placeholder: "Write the detailed content of the news article here...", value: content, onChange: (e) => setContent(e.target.value), rows: 8, required: true }), _jsx(FormInput, { label: "Category", type: "text", placeholder: "e.g., Politics, Technology, Sports, Local", value: category, onChange: (e) => setCategory(e.target.value), required: true }), _jsxs("div", { children: [_jsx("label", { htmlFor: "language-select", className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2", children: "Select Language:" }), _jsxs("select", { id: "language-select", value: language, onChange: (e) => setLanguage(e.target.value), className: "w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white", children: [_jsx("option", { value: "English", children: "\uD83C\uDF10 English" }), _jsx("option", { value: "Hindi", children: "\uD83D\uDCF0 Hindi" }), _jsx("option", { value: "Gujarati", children: "\uD83D\uDDDE Gujarati" })] })] }), _jsx("button", { type: "submit", className: "w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition duration-300 ease-in-out flex items-center justify-center space-x-2", disabled: loading, children: loading ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-3 h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Saving News..."] })) : (_jsx(_Fragment, { children: "\u2795 Add News" })) })] })] }));
};
export default AddNews;
