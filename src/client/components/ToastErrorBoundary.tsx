import { Component, ErrorInfo, ReactNode } from 'react';

interface ToastErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ToastErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Error boundary specifically for toast system
 * Prevents toast errors from crashing the entire application
 */
export class ToastErrorBoundary extends Component<
  ToastErrorBoundaryProps,
  ToastErrorBoundaryState
> {
  constructor(props: ToastErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ToastErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Toast Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="fixed top-4 right-4 z-50 bg-red-500 text-white p-4 rounded border-2 border-red-600">
            <div className="font-bold">Toast System Error</div>
            <div className="text-sm">Please refresh the page</div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
