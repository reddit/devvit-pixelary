import React, { createContext, useContext, useCallback } from 'react';
import { trpc } from '@client/trpc/client';
import type { TelemetryEventType } from '@shared/types';

type TelemetryContextType = {
  track: (
    eventType: TelemetryEventType,
    metadata?: Record<string, string | number>
  ) => Promise<{ ok: boolean }>;
};

const TelemetryContext = createContext<TelemetryContextType | null>(null);

/**
 * Provider for telemetry tracking
 * Provides tRPC-based tracking that can be awaited when needed
 * Post type is automatically detected from server context
 */
export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const trackMutation = trpc.app.telemetry.track.useMutation();

  const track = useCallback(
    async (
      eventType: TelemetryEventType,
      metadata?: Record<string, string | number>
    ) => {
      const payload: Record<string, unknown> = { eventType };

      if (metadata && Object.keys(metadata).length > 0) {
        payload.metadata = metadata;
      }

      return trackMutation.mutateAsync(
        payload as {
          eventType: string;
          metadata?: Record<string, string | number>;
        }
      );
    },
    [trackMutation]
  );

  return (
    <TelemetryContext.Provider value={{ track }}>
      {children}
    </TelemetryContext.Provider>
  );
}

/**
 * Hook for telemetry tracking
 * Must be used within TelemetryProvider
 */
export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
