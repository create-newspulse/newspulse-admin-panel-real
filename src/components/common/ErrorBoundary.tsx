import React from 'react';

declare global { interface Window { __EB_LOGGED?: Set<string>; __EB_COUNTS?: Record<string, number>; } }

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  error: any;
};

// Single ErrorBoundary implementation (previous duplicate definitions removed)
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    if (typeof window !== 'undefined') {
      window.__EB_LOGGED = window.__EB_LOGGED || new Set<string>();
      window.__EB_COUNTS = window.__EB_COUNTS || {};
      const key = (error?.message || String(error)) + '::' + (error?.stack ? String(error.stack).split('\n')[0] : '');
      if (!window.__EB_LOGGED.has(key)) {
        window.__EB_LOGGED.add(key);
        console.error('[ErrorBoundary]', error, info);
      } else {
        window.__EB_COUNTS[key] = (window.__EB_COUNTS[key] || 1) + 1;
        const c = window.__EB_COUNTS[key];
        if (c === 25 || c === 100 || c === 500) {
          console.warn('[ErrorBoundary] repeated error x' + c, error?.message || error);
        }
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
          <div className="font-semibold text-red-700 dark:text-red-300 mb-1">{this.props.title || 'Panel crashed'}</div>
          <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {(this.state.error?.message as string) || 'Unknown error'}
          </div>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-red-600 dark:text-red-400">Stack trace</summary>
            <pre className="mt-1 overflow-auto max-h-40">{String(this.state.error?.stack || '').split('\n').slice(0,12).join('\n')}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
