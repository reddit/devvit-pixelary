import { Component, ErrorInfo, ReactNode } from 'react';
import { Text } from './PixelFont';
import { Button } from './Button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | undefined;
  errorInfo: ErrorInfo | undefined;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Root-level error boundary that catches all unhandled React errors
 * Displays a full-page error screen with pixel art styling
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: undefined, errorInfo: undefined };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: undefined };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  override render() {
    if (this.state.hasError) {
      const isDevelopment = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            {/* Main Error Card */}
            <div className="bg-white border-4 border-black shadow-pixel-lg p-8">
              {/* Error Icon */}
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">⚠️</div>
                <Text scale={3} className="text-error">
                  Oops! Something went wrong
                </Text>
              </div>

              {/* Error Message */}
              <div className="text-center mb-8">
                <Text scale={2} className="text-gray-700 mb-4">
                  The application encountered an unexpected error.
                </Text>
                {this.state.error && (
                  <div className="bg-gray-100 border-2 border-gray-300 p-4 rounded">
                    <Text scale={1} className="text-error font-mono text-left">
                      {this.state.error.message}
                    </Text>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={this.handleRetry} variant="secondary">
                  Try Again
                </Button>
                <Button onClick={this.handleReload}>Reload Page</Button>
              </div>

              {/* Development Stack Trace */}
              {isDevelopment && this.state.errorInfo && (
                <details className="mt-8">
                  <summary className="cursor-pointer mb-4">
                    <Text scale={1} className="text-gray-600">
                      Show Error Details (Development)
                    </Text>
                  </summary>
                  <div className="bg-gray-900 text-success p-4 rounded border-2 border-gray-600 font-mono text-xs overflow-auto max-h-64">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error?.toString()}
                    </div>
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-2">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
            </div>

            {/* Footer */}
            <div className="text-center mt-6">
              <Text scale={1} className="text-gray-500">
                If this problem persists, please contact support.
              </Text>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
