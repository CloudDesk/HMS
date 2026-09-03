import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Uncaught error in Patient Web ErrorBoundary:', error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main
          className="error-boundary-fallback"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            backgroundColor: '#f8fafc',
            color: '#0f172a',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              padding: '2.5rem',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 1.5rem',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
              }}
            >
              <i className="ph ph-warning-circle" aria-hidden="true" />
            </div>

            <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
              Something went wrong
            </h1>

            <p style={{ margin: '0 0 1.75rem', fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
              An unexpected error occurred while rendering the portal. You can try recovering the view or reloading the page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre
                style={{
                  margin: '0 0 1.5rem',
                  padding: '0.75rem',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#e11d48',
                  textAlign: 'left',
                  overflowX: 'auto',
                  maxHeight: '120px',
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
