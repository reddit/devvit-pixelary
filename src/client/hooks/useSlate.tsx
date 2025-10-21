import React, { createContext, useContext, useState, useCallback } from 'react';
import { trpc } from '@client/trpc/client';

interface SlateContextType {
  slateId: string | null;
  setSlateId: (slateId: string | null) => void;
  trackSlateAction: (
    action: 'impression' | 'click' | 'publish' | 'start',
    word?: string
  ) => Promise<void>;
}

const SlateContext = createContext<SlateContextType | null>(null);

export function SlateProvider({ children }: { children: React.ReactNode }) {
  const [slateId, setSlateId] = useState<string | null>(null);
  const trackSlateActionMutation = trpc.app.slate.trackAction.useMutation();

  const trackSlateAction = useCallback(
    async (
      action: 'impression' | 'click' | 'publish' | 'start',
      word?: string
    ) => {
      if (!slateId) {
        return;
      }

      return trackSlateActionMutation.mutateAsync({
        slateId,
        action,
        word,
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
