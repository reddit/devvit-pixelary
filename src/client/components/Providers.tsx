import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { loggerLink } from '@trpc/client/links/loggerLink';

import { ToastProvider } from '@components/ToastManager';
import { TelemetryProvider } from '@hooks/useTelemetry';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { LevelUpProvider } from '@components/LevelUpProvider';
import { useUserProfileRealtime } from '@client/hooks/useUserProfileRealtime';

import { trpc } from '@client/trpc/client';

export function Providers(props: React.PropsWithChildren): React.ReactElement {
  const { children } = props;

  function GlobalRealtimeSync(): React.ReactElement | null {
    useUserProfileRealtime();
    return null;
  }

  const queryClient = React.useMemo(() => new QueryClient(), []);
  const trpcClient = React.useMemo(
    () =>
      trpc.createClient({
        links: [
          loggerLink({
            enabled: (opts) =>
              import.meta.env.DEV ||
              (opts.direction === 'down' && opts.result instanceof Error),
          }),
          httpBatchLink({ url: '/api/trpc' }),
        ],
      }),
    []
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GlobalRealtimeSync />
        <ToastProvider
          maxToasts={5}
          defaultPosition="top-right"
          defaultDuration={4000}
        >
          <TelemetryProvider>
            <ErrorBoundary
              onError={(_error: unknown, _errorInfo: unknown) => {
                // Error boundary caught error
              }}
            >
              <LevelUpProvider>{children}</LevelUpProvider>
            </ErrorBoundary>
          </TelemetryProvider>
        </ToastProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
