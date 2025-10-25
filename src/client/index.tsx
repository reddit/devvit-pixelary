import React from 'react';
import ReactDOM from 'react-dom/client';
import { DrawingPost } from './posts/drawing-post/DrawingPost';
import { PinnedPost } from './posts/pinned-post/PinnedPost';
import { trpc } from './trpc/client';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getPostData } from './utils/context';
import type { DrawingPostDataExtended } from '../shared/schema';
import './index.css';
import { Background } from './components/Background';
import { ToastProvider } from './components/ToastManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TelemetryProvider } from './hooks/useTelemetry';
import { PixelFont } from './components/PixelFont';

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: '/api/trpc' })],
});

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider
          maxToasts={5}
          defaultPosition="top-right"
          defaultDuration={4000}
        >
          <TelemetryProvider>{children}</TelemetryProvider>
        </ToastProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
};

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise,
  });
});

const App = () => {
  const postData = getPostData();

  switch (postData?.type) {
    case 'drawing':
      return <DrawingPost />;
    case 'pinned':
      return <PinnedPost />;
    default:
      return (
        <div className="flex items-center justify-center h-full w-full">
          <PixelFont>Unknown post type</PixelFont>
        </div>
      );
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <ErrorBoundary
        onError={(_error, _errorInfo) => {
          // Error boundary caught error
        }}
      >
        <Background />
        <App />
      </ErrorBoundary>
    </Providers>
  </React.StrictMode>
);
