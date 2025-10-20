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
    (
      eventType: TelemetryEventType,
      metadata?: Record<string, string | number>
    ) => {
      console.log('🔍 useTelemetry.track called:', {
        eventType,
        metadata,
        metadataType: typeof metadata,
      });

      // Defensive check for metadata
      let payload: {
        eventType: TelemetryEventType;
        metadata?: Record<string, string | number>;
      };

      if (
        metadata &&
        typeof metadata === 'object' &&
        Object.keys(metadata).length > 0
      ) {
        payload = { eventType, metadata };
      } else {
        payload = { eventType };
      }

      console.log(
        '🔍 useTelemetry: About to call mutate with payload:',
        payload
      );

      // Fire-and-forget tracking - never blocks the UI
      try {
        trackMutation.mutate(payload, {
          onError: (error) => {
            // Silently log errors - telemetry should never break the app
            console.warn('🔍 Telemetry tracking failed:', error);
            console.warn('🔍 Error details:', {
              errorMessage: error.message,
              errorStack: error instanceof Error ? error.stack : undefined,
              payload,
            });
          },
          onSuccess: (result) => {
            console.log('🔍 Telemetry tracking success:', result);
          },
        });
      } catch (error) {
        console.warn('🔍 useTelemetry: Error calling mutate:', error);
      }
    },
    [trackMutation]
  );

  return { track };
}
