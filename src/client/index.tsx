import React from 'react';
import ReactDOM from 'react-dom/client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';

import { Background } from '@components/Background';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { LevelUpManager } from '@components/LevelUpManager';
import { Text } from '@components/PixelFont';
import { ToastProvider } from '@components/ToastManager';

import { TelemetryProvider } from '@hooks/useTelemetry';

import { CollectionPost } from '@client/posts/collection-post/CollectionPost';
import { DrawingPost } from '@client/posts/drawing-post/DrawingPost';
import { PinnedPost } from '@client/posts/pinned-post/PinnedPost';
import { TournamentPost } from '@client/posts/tournament-post/TournamentPost';

import { getPostData } from '@utils/context';

import { trpc } from '@client/trpc/client';

import type { PostType } from '@shared/types';

import './index.css';

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
        <Text>Error:</Text>
        <Text>Unknown Post Type</Text>
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
