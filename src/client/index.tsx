import React from 'react';
import ReactDOM from 'react-dom/client';
import { DrawingPost } from './posts/drawing-post/DrawingPost';
import { PinnedPost } from './posts/pinned-post/PinnedPost';
import { trpc } from './trpc/client';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { context } from '@devvit/web/client';
import type { DrawingPostDataExtended } from '../shared/schema';
import './index.css';
import { Background } from './components/Background';
import { ToastProvider } from './components/ToastManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TelemetryProvider } from './hooks/useTelemetry';

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
  // Global error handling
});

window.addEventListener('unhandledrejection', (event) => {
  // Unhandled promise rejection handling
});

const App = () => {
  const postData = context.postData;

  if (!postData?.type) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-gray-600">Loading post data...</div>
        </div>
      </div>
    );
  }

  switch (postData.type) {
    case 'drawing':
      return <DrawingPost postData={postData as DrawingPostDataExtended} />;
    case 'pinned':
      return <PinnedPost />;
    default:
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-red-600 text-xl font-bold mb-2">
              Unknown Post Type
            </div>
            <div className="text-gray-600">
              Post type "{String(postData.type)}" is not supported
            </div>
          </div>
        </div>
      );
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          // Error boundary caught error
        }}
      >
        <Background />
        <App />
      </ErrorBoundary>
    </Providers>
  </React.StrictMode>
);
