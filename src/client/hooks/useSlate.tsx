import React, { createContext, useContext, useState, useCallback } from 'react';
import { trpc } from '@client/trpc/client';

interface SlateContextType {
  slateId: string | null;
  setSlateId: (slateId: string | null) => void;
  trackSlateAction: (
    action: 'impression' | 'click' | 'publish' | 'start',
    word?: string
  ) => void;
}

const SlateContext = createContext<SlateContextType | null>(null);

export function SlateProvider({ children }: { children: React.ReactNode }) {
  const [slateId, setSlateId] = useState<string | null>(null);

  const trackSlateAction = useCallback(
    (action: 'impression' | 'click' | 'publish' | 'start', word?: string) => {
      if (!slateId) {
        return;
      }

      // Use direct fetch instead of tRPC mutation to avoid hook issues
      const trackSlateEvent = async () => {
        try {
          const response = await fetch('/api/trpc/app.slate.trackAction', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              slateId,
              action,
              word,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log('Slate tracking success:', data);
        } catch (error) {
          // Silently log errors - slate tracking should never break the app
          console.warn('Slate tracking failed:', error);
        }
      };

      // Fire-and-forget tracking - never blocks the UI
      void trackSlateEvent();
    },
    [slateId]
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
