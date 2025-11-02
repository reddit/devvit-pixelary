import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';

import { ToastProvider } from '@components/ToastManager';
import { TelemetryProvider } from '@hooks/useTelemetry';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { LevelUpProvider } from '@components/LevelUpProvider';

import { trpc } from '@client/trpc/client';

export function Providers(props: React.PropsWithChildren): React.ReactElement {
  const { children } = props;

  const queryClient = React.useMemo(() => new QueryClient(), []);
  const trpcClient = React.useMemo(
    () => trpc.createClient({ links: [httpBatchLink({ url: '/api/trpc' })] }),
    []
  );

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
