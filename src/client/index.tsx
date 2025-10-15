import React from 'react';
import ReactDOM from 'react-dom/client';
import { DrawingPost } from './posts/drawing-post/DrawingPost';
import { PinnedPost } from './posts/pinned-post/PinnedPost';
import { WeeklyLeaderboardPost } from './posts/weekly-leaderboard-post/WeeklyLeaderboardPost';
import { trpc } from './trpc/client';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { context } from '@devvit/web/client';
import type {
  WeeklyLeaderboardPostData,
  DrawingPostDataExtended,
} from '../shared/schema';
import './index.css';
import { Background } from './components/Background';
import { ToastProvider } from './components/ToastManager';
import { ToastErrorBoundary } from './components/ToastErrorBoundary';

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: '/api/trpc' })],
});

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ToastErrorBoundary
          onError={(error, errorInfo) => {
            console.error('Toast system error:', error, errorInfo);
            // Could send to error tracking service here
          }}
        >
          <ToastProvider
            maxToasts={5}
            defaultPosition="top-right"
            defaultDuration={4000}
          >
            {children}
          </ToastProvider>
        </ToastErrorBoundary>
      </QueryClientProvider>
    </trpc.Provider>
  );
};

// Global error handler
window.addEventListener('error', (event) => {
  console.error('🚨 Global Error Handler:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled Promise Rejection:', {
    reason: event.reason,
    promise: event.promise,
  });
});

const App = () => {
  try {
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
      case 'weekly-leaderboard':
        return (
          <WeeklyLeaderboardPost
            postData={postData as WeeklyLeaderboardPostData}
          />
        );
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
  } catch (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl font-bold mb-2">
            Application Error
          </div>
          <div className="text-gray-600">{(error as Error).message}</div>
        </div>
      </div>
    );
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <Background />
      <App />
    </Providers>
  </React.StrictMode>
);
