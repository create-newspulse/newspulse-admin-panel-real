import React from 'react';

declare global { interface Window { __EB_LOGGED?: Set<string>; __EB_COUNTS?: Record<string, number>; } }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; title?: string }, { error?: any }> {
  state = { error: undefined as any };
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) {
    // Dedupe noisy repeated errors in dev to prevent console flood
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      window.__EB_LOGGED = window.__EB_LOGGED || new Set<string>();
      window.__EB_COUNTS = window.__EB_COUNTS || {};
      const key = (error?.message || String(error)) + '::' + (error?.stack ? String(error.stack).split('\n')[0] : '');
      if (!window.__EB_LOGGED.has(key)) {
        window.__EB_LOGGED.add(key);
        console.error('UI ErrorBoundary:', error, info);
      } else {
        window.__EB_COUNTS[key] = (window.__EB_COUNTS[key] || 1) + 1;
        const c = window.__EB_COUNTS[key];
        if (c === 25 || c === 100 || c === 500) {
          console.warn('[ErrorBoundary] repeated error x' + c, error?.message || error);
        }
      }
    } else {
      console.error('UI ErrorBoundary:', error, info);
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16 }} data-error-boundary>
          <h2 style={{ fontWeight: 600, marginBottom: 8 }}>{this.props.title || 'Something went wrong.'}</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#1e1e1e', color: '#fff', padding: 12, borderRadius: 4 }}>
            {String(this.state.error)}
          </pre>
          <button onClick={() => this.setState({ error: undefined })} style={{ marginTop: 12, padding: '6px 12px' }}>Reset</button>
        </div>
      );
    }
    return this.props.children as any;
  }
}

export default ErrorBoundary;