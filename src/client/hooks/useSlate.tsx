import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { trpc } from '@client/trpc/client';
import type { SlateAction } from '@shared/types';

type SlateContextType = {
  slateId: string | null;
  setSlateId: (slateId: string | null) => void;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
};

const SlateContext = createContext<SlateContextType | null>(null);

export function SlateProvider({ children }: { children: React.ReactNode }) {
  const [slateId, setSlateId] = useState<string | null>(null);
  const trackSlateActionMutation = trpc.app.slate.trackAction.useMutation();

  // Debug slateId changes
  useEffect(() => {
    // SlateId changed
  }, [slateId]);

  const trackSlateAction = useCallback(
    async (
      action: SlateAction,
      word?: string,
      metadata?: Record<string, string | number>
    ) => {
      if (!slateId) {
        return;
      }

      await trackSlateActionMutation.mutateAsync({
        slateId,
        action,
        word,
        metadata,
      });
    },
    [slateId, trackSlateActionMutation]
  );

  const memoizedSetSlateId = useCallback((newSlateId: string | null) => {
    setSlateId(newSlateId);
  }, []);

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
