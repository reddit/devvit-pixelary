import React, { Component, ErrorInfo, ReactNode } from 'react';
import { PixelFont } from './PixelFont';
import { Button } from './Button';

interface RootErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface RootErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Root-level error boundary that catches all unhandled React errors
 * Displays a full-page error screen with pixel art styling
 */
export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Root Error Boundary caught an error:', error, errorInfo);
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
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            {/* Main Error Card */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)] p-8">
              {/* Error Icon */}
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">⚠️</div>
                <PixelFont scale={3} className="text-red-600">
                  Oops! Something went wrong
                </PixelFont>
              </div>

              {/* Error Message */}
              <div className="text-center mb-8">
                <PixelFont scale={2} className="text-gray-700 mb-4">
                  The application encountered an unexpected error.
                </PixelFont>
                {this.state.error && (
                  <div className="bg-gray-100 border-2 border-gray-300 p-4 rounded">
                    <PixelFont
                      scale={1}
                      className="text-red-600 font-mono text-left"
                    >
                      {this.state.error.message}
                    </PixelFont>
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
                    <PixelFont scale={1} className="text-gray-600">
                      Show Error Details (Development)
                    </PixelFont>
                  </summary>
                  <div className="bg-gray-900 text-green-400 p-4 rounded border-2 border-gray-600 font-mono text-xs overflow-auto max-h-64">
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
              <PixelFont scale={1} className="text-gray-500">
                If this problem persists, please contact support.
              </PixelFont>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
