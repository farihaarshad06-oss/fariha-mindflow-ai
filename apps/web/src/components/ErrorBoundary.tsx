import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] React render error:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            padding: '2rem',
            maxWidth: '640px',
            margin: '4rem auto',
          }}
        >
          <h1 style={{ color: '#b91c1c', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#374151', marginBottom: '1rem' }}>
            The application encountered an unexpected error. Please reload to try again.
          </p>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Startup stage: renderer-bootstrap
          </p>
          <pre
            style={{
              background: '#f3f4f6',
              borderRadius: '6px',
              padding: '1rem',
              overflowX: 'auto',
              fontSize: '0.8rem',
              color: '#111827',
            }}
          >
            {this.state.error?.toString()}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            style={{
              marginTop: '1.5rem',
              padding: '0.5rem 1.25rem',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
