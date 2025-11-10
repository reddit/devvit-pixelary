import { useEffect, useRef, useCallback } from 'react';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';

type UseDrawTelemetryParams = {
  word: string;
  slateId: string | null;
  trackSlateAction?: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
};

export function useDrawTelemetry(params: UseDrawTelemetryParams) {
  const { word, slateId, trackSlateAction } = params;
  const { track } = useTelemetry();

  const hasTrackedViewRef = useRef(false);
  useEffect(() => {
    if (!hasTrackedViewRef.current) {
      void track('view_draw_step');
      void track('drawing_start');
      hasTrackedViewRef.current = true;
    }
  }, [track, word, slateId, trackSlateAction]);

  const hasTrackedFirstPixelRef = useRef(false);
  const trackFirstPixelOnce = useCallback(() => {
    if (!hasTrackedFirstPixelRef.current) {
      void track('first_pixel_drawn');
      void track('drawing_first_pixel');
      hasTrackedFirstPixelRef.current = true;
    }
  }, [track]);

  return { track, trackFirstPixelOnce };
}
