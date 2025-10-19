import React, { createContext, useContext, useState, useCallback } from 'react';
import { trpc } from '@client/trpc/client';

interface SlateContextType {
  slateId: string | null;
  setSlateId: (slateId: string | null) => void;
  trackSlateAction: (
    action: 'impression' | 'click' | 'publish',
    word?: string
  ) => void;
}

const SlateContext = createContext<SlateContextType | null>(null);

export function SlateProvider({ children }: { children: React.ReactNode }) {
  const [slateId, setSlateId] = useState<string | null>(null);

  const trackSlateAction = useCallback(
    async (action: 'impression' | 'click' | 'publish', word?: string) => {
      if (!slateId) return;

      try {
        await trpc.app.slate.trackAction.mutate({
          slateId,
          action,
          word,
        });
      } catch (error) {
        // Silently ignore errors - telemetry should never break the app
        console.warn('Failed to track slate action:', error);
      }
    },
    [slateId]
  );

  return (
    <SlateContext.Provider value={{ slateId, setSlateId, trackSlateAction }}>
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
