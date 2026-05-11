import React, { ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);

    // Log to CloudWatch
    this.logErrorToCloudWatch(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  private logErrorToCloudWatch = (error: Error, errorInfo: React.ErrorInfo) => {
    const errorData = {
      message: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // Send to backend for CloudWatch logging
    fetch('/api/v1/logs/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData),
    }).catch(err => console.error('Failed to log error:', err));
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-boundary">
            <div className="error-boundary__content">
              <h2 className="error-boundary__title">Oops! Something went wrong</h2>
              <p className="error-boundary__message">
                We're sorry for the inconvenience. The error has been logged and our team will be notified.
              </p>
              {import.meta.env.DEV && (
                <details className="error-boundary__details">
                  <summary>Error Details (Development Only)</summary>
                  <pre className="error-boundary__stack">
                    {this.state.error?.toString()}
                    {'\n\n'}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              <button
                className="error-boundary__button"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
