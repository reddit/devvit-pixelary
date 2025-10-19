import { trpc } from '@client/trpc/client';
import type { TelemetryEventType } from '@shared/types';
import { useCallback } from 'react';

/**
 * Hook for telemetry tracking
 * Provides fire-and-forget tracking that never blocks the UI
 * Post type is automatically detected from server context
 */
export function useTelemetry() {
  const trackMutation = trpc.app.telemetry.track.useMutation();

  const track = useCallback(
    (eventType: TelemetryEventType) => {
      // Fire-and-forget tracking - never blocks the UI
      trackMutation.mutate(
        { eventType },
        {
          onError: (error) => {
            // Silently log errors - telemetry should never break the app
            console.warn('Telemetry tracking failed:', error);
          },
        }
      );
    },
    [trackMutation]
  );

  return { track };
}
