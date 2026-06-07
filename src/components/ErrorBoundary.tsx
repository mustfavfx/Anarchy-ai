import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../utils/logger';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Uncaught error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // You can also log to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  private readonly handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  private readonly handleReload = () => {
    globalThis.location.reload();
  };

  private readonly handleGoHome = () => {
    globalThis.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">
              <AlertTriangle size={48} />
            </div>
            
            <h1 className="error-title">Something went wrong</h1>
            
            <p className="error-message">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>

            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-stack">
                  {this.state.error?.stack}
                  {'\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="error-actions">
              <button 
                className="error-btn primary"
                onClick={this.handleReset}
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              
              <button 
                className="error-btn secondary"
                onClick={this.handleReload}
              >
                Reload Page
              </button>
              
              <button 
                className="error-btn secondary"
                onClick={this.handleGoHome}
              >
                <Home size={16} />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setHasError(false);
    setError(null);
  }, []);

  const throwError = React.useCallback((err: Error) => {
    setHasError(true);
    setError(err);
  }, []);

  return { hasError, error, resetError, throwError };
}
