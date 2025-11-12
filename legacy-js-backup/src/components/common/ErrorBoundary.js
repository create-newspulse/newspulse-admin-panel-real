import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
export default class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        // Optionally log to monitoring here
        if (typeof window !== 'undefined') {
            console.error('[ErrorBoundary]', error, info);
        }
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (_jsxs("div", { className: "p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded", children: [_jsx("div", { className: "font-semibold text-red-700 dark:text-red-300 mb-1", children: this.props.title || 'Panel crashed' }), _jsx("div", { className: "text-xs text-red-600 dark:text-red-400", children: this.state.error?.message || 'Unknown error' })] }));
        }
        return this.props.children;
    }
}
