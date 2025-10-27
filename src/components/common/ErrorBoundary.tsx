import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  error: any;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Optionally log to monitoring here
    if (typeof window !== 'undefined') {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
          <div className="font-semibold text-red-700 dark:text-red-300 mb-1">{this.props.title || 'Panel crashed'}</div>
          <div className="text-xs text-red-600 dark:text-red-400">
            {(this.state.error?.message as string) || 'Unknown error'}
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}
