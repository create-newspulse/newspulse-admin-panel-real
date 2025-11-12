import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; title?: string }, { error?: any }> {
  state = { error: undefined as any };
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) { console.error('UI ErrorBoundary:', error, info); }
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