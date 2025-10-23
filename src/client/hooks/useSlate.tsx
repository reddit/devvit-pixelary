import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { trpc } from '@client/trpc/client';
import type { SlateAction } from '@shared/types';

interface SlateContextType {
  slateId: string | null;
  setSlateId: (slateId: string | null) => void;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
}

const SlateContext = createContext<SlateContextType | null>(null);

export function SlateProvider({ children }: { children: React.ReactNode }) {
  const [slateId, setSlateId] = useState<string | null>(null);
  const trackSlateActionMutation = trpc.app.slate.trackAction.useMutation();

  // Debug slateId changes
  useEffect(() => {
    console.log('SlateProvider: slateId changed', { slateId });
  }, [slateId]);

  const trackSlateAction = useCallback(
    async (
      action: SlateAction,
      word?: string,
      metadata?: Record<string, string | number>
    ) => {
      console.log('🔍 useSlate: trackSlateAction called', {
        action,
        word,
        slateId,
      });
      if (!slateId) {
        console.warn(
          '🔍 useSlate: trackSlateAction called but slateId is not set',
          { action, word }
        );
        return;
      }

      console.log('🔍 useSlate: tracking slate action', {
        slateId,
        action,
        word,
      });
      await trackSlateActionMutation.mutateAsync({
        slateId,
        action,
        word,
        metadata,
      });
    },
    [slateId, trackSlateActionMutation]
  );

  const memoizedSetSlateId = useCallback(
    (newSlateId: string | null) => {
      console.log('useSlate: setSlateId called', {
        newSlateId,
        currentSlateId: slateId,
      });
      setSlateId(newSlateId);
    },
    [slateId]
  );

  return (
    <SlateContext.Provider
      value={{ slateId, setSlateId: memoizedSetSlateId, trackSlateAction }}
    >
      {children}
    </SlateContext.Provider>
  );
}

export function useSlate() {
  const context = useContext(SlateContext);
  if (!context) {
    throw new Error('useSlate must be used within a SlateProvider');
  }
  return context;
}
