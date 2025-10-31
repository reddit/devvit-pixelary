import ReactDOM from 'react-dom/client';
import React from 'react';
import { DrawingPost } from './posts/drawing-post/DrawingPost';
import { PinnedPost } from './posts/pinned-post/PinnedPost';
import { CollectionPost } from './posts/collection-post/CollectionPost';
import { TournamentPost } from './posts/tournament-post/TournamentPost';
import { trpc } from './trpc/client';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getPostData } from './utils/context';
import './index.css';
import { Background } from './components/Background';
import { ToastProvider } from './components/ToastManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TelemetryProvider } from './hooks/useTelemetry';
import { PixelFont } from './components/PixelFont';
import { LevelUpManager } from './components/LevelUpManager';
import { PostType } from '@src/shared/types';

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: '/api/trpc' })],
});

// Providers component that wraps the app in the necessary providers
function Providers(props: React.PropsWithChildren) {
  const { children } = props;
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider
          maxToasts={5}
          defaultPosition="top-right"
          defaultDuration={4000}
        >
          <TelemetryProvider>
            <ErrorBoundary
              onError={(_error, _errorInfo) => {
                // Error boundary caught error
              }}
            >
              <LevelUpManager>{children}</LevelUpManager>
            </ErrorBoundary>
          </TelemetryProvider>
        </ToastProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

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

// Main app component that displays the current post based on the post data
function App() {
  const postData = getPostData();
  const currentPostType = (postData?.type as PostType) ?? 'unknown';

  const postTypes = {
    drawing: <DrawingPost />,
    pinned: <PinnedPost />,
    collection: <CollectionPost />,
    tournament: <TournamentPost />,
    unknown: (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <PixelFont>Error:</PixelFont>
        <PixelFont>Unknown Post Type</PixelFont>
      </div>
    ),
  };

  return (
    <React.Fragment>
      <Background />
      {postTypes[currentPostType]}
    </React.Fragment>
  );
}

// Render the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
);
